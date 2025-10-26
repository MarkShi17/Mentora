import Anthropic from '@anthropic-ai/sdk';
import { Session } from '@/types/session';
import { CanvasObject, ObjectPlacement, ObjectReference } from '@/types/canvas';
import { TeachingMode, VoiceOption } from '@/types/api';
import { contextBuilder } from './contextBuilder';
import { objectGenerator } from '@/lib/canvas/objectGenerator';
import { layoutEngine } from '@/lib/canvas/layoutEngine';
import { logger } from '@/lib/utils/logger';
import { ExternalServiceError } from '@/lib/utils/errors';
import { mcpManager } from '@/lib/mcp';
import { initializeMCP } from '@/lib/mcp/init';
import { MCP_TOOLS_FOR_CLAUDE, TOOL_TO_SERVER_MAP, isVisualizationTool } from './mcpTools';
import { brainSelector } from './brainSelector';
import { multimodalRAG } from '@/lib/memory/multimodalRAG';

interface AgentResponse {
  explanation: string;
  narration: string;
  objects: Array<{
    type: 'latex' | 'graph' | 'code' | 'text' | 'diagram';
    content: string;
    referenceName?: string;
    metadata?: Record<string, unknown>;
  }>;
  references: Array<{
    mention: string;
    objectId: string;
  }>;
}

type UserSettings = {
  userName?: string;
  explanationLevel?: 'beginner' | 'intermediate' | 'advanced';
  voice?: VoiceOption;
};

const CANVAS_TYPE_PRIORITY: Record<string, number> = {
  text: 0,
  latex: 1,
  code: 2,
  diagram: 3,
  graph: 4,
  image: 5,
  video: 6,
};

export class MentorAgent {
  private anthropic: Anthropic;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  async generateResponse(
    question: string,
    session: Session,
    highlightedObjectIds: string[] = [],
    mode: TeachingMode = 'guided',
    turnId: string,
    context?: {
      recentConversation?: string[];
      topics?: string[];
      conversationHistory?: string[];
    },
    userSettings?: UserSettings
  ): Promise<{
    text: string;
    narration: string;
    canvasObjects: CanvasObject[];
    objectPlacements: ObjectPlacement[];
    references: ObjectReference[];
  }> {
    try {
      logger.info('Generating teaching response with MCP tools', { question, mode, sessionId: session.id });

      // Ensure MCP and RAG are initialized
      await initializeMCP();
      await multimodalRAG.initialize();

      // Select appropriate brain for this question
      const brainResult = await brainSelector.selectBrain(question, {
        recentTopics: context?.topics,
        canvasObjects: session.canvasObjects,
      });

      logger.info('Brain selected for question', {
        brain: brainResult.selectedBrain.type,
        confidence: brainResult.confidence,
        reasoning: brainResult.reasoning,
      });

      // Retrieve relevant memories from RAG
      const memoryContext = await multimodalRAG.buildMemoryContext(
        question,
        session.id,
        brainResult.selectedBrain.type
      );

      // Build context from session history and canvas
      const sessionContext = contextBuilder.buildContext(session, highlightedObjectIds);

      // Generate system prompt with brain-specific enhancements
      const systemPrompt = this.buildSystemPrompt(
        session,
        sessionContext,
        mode,
        context,
        brainResult.selectedBrain,
        memoryContext,
        userSettings
      );

      // Generate user prompt
      const userPrompt = this.buildUserPrompt(question, sessionContext, userSettings);

      // Call Claude API with MCP tools
      let messages: Anthropic.MessageParam[] = [
        {
          role: 'user',
          content: userPrompt,
        },
      ];

      let finalResponse: any = null;
      let toolResults: CanvasObject[] = [];
      const maxIterations = 5; // Prevent infinite loops
      let iteration = 0;

      while (iteration < maxIterations) {
        iteration++;

        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: 4096,
          system: systemPrompt,
          tools: this.getToolsForBrain(brainResult.selectedBrain),
          messages,
        });

        logger.info('Claude response', {
          stopReason: response.stop_reason,
          iteration,
          contentBlocks: response.content.length
        });

        // If Claude wants to use tools
        if (response.stop_reason === 'tool_use') {
          const toolUses = response.content.filter(block => block.type === 'tool_use');
          const textBlocks = response.content.filter(block => block.type === 'text');

          // Store any text explanation
          if (textBlocks.length > 0 && !finalResponse) {
            finalResponse = textBlocks;
          }

          // Add assistant's message with tool use to conversation
          messages.push({
            role: 'assistant',
            content: response.content,
          });

          // Execute all tool calls
          const toolResultsContent: Anthropic.ToolResultBlockParam[] = [];

          for (const toolUse of toolUses) {
            if (toolUse.type !== 'tool_use') continue;

            logger.info('Executing MCP tool', {
              toolName: toolUse.name,
              toolId: toolUse.id
            });

            try {
              const serverId = TOOL_TO_SERVER_MAP[toolUse.name];
              if (!serverId) {
                throw new Error(`Unknown tool: ${toolUse.name}`);
              }

              // Call MCP server
              const mcpResult = await mcpManager.callTool({
                serverId,
                toolName: toolUse.name,
                arguments: toolUse.input as Record<string, any>,
              });

              logger.info('MCP tool result received', {
                toolName: toolUse.name,
                serverId,
                success: mcpResult.success,
                contentLength: mcpResult.content?.length || 0,
                content: mcpResult.content,
                error: mcpResult.error,
                isError: mcpResult.isError
              });

              if (!mcpResult.success) {
                throw new Error(mcpResult.error || 'MCP tool call failed');
              }

              // Convert MCP result to canvas objects if it's a visualization tool
              let generatedObjectsCount = 0;
              if (isVisualizationTool(toolUse.name)) {
                const mcpObjects = this.convertMCPResultToCanvasObjects(
                  mcpResult,
                  toolUse.name,
                  session.canvasObjects,
                  toolResults,
                  turnId
                );
                toolResults.push(...mcpObjects);
                generatedObjectsCount = mcpObjects.length;
              }

              // Format result for Claude
              const resultText = mcpResult.content
                .map((c: any) => {
                  if (c.type === 'text') return c.text;
                  if (c.type === 'image') return `[Image generated: ${c.mimeType}]`;
                  if (c.type === 'resource') return `[Resource: ${c.resource?.mimeType || 'unknown'}]`;
                  return `[${c.type}]`;
                })
                .join('\n');

              toolResultsContent.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: resultText || 'Tool executed successfully',
              });

              logger.info('MCP tool executed successfully', {
                toolName: toolUse.name,
                objectsCreated: generatedObjectsCount
              });

            } catch (error) {
              logger.error('MCP tool execution failed', {
                toolName: toolUse.name,
                error
              });

              toolResultsContent.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                is_error: true,
              });
            }
          }

          // Add tool results to conversation
          messages.push({
            role: 'user',
            content: toolResultsContent,
          });

          // Continue conversation loop to get final response
          continue;
        }

        // If Claude finished without using tools or after using tools
        finalResponse = response.content;
        break;
      }

      // Parse final response
      const responseText = finalResponse
        .filter((block: any) => block.type === 'text')
        .map((block: any) => block.text)
        .join('\n');

      const agentResponse = this.parseResponse(responseText);

      // Generate canvas objects from Claude's response
      const claudeObjects = this.generateCanvasObjects(
        agentResponse.objects,
        session.canvasObjects,
        turnId,
        question
      );

      // Combine MCP-generated objects with Claude-generated objects
      const allCanvasObjects = [...toolResults, ...claudeObjects];

      const sortedCanvasObjects = allCanvasObjects
        .map((object, index) => ({ object, index }))
        .sort((a, b) => {
          const priorityA = CANVAS_TYPE_PRIORITY[a.object.type] ?? 99;
          const priorityB = CANVAS_TYPE_PRIORITY[b.object.type] ?? 99;
          if (priorityA !== priorityB) {
            return priorityA - priorityB;
          }
          const createdA = typeof a.object.metadata?.createdAt === 'number' ? a.object.metadata.createdAt : 0;
          const createdB = typeof b.object.metadata?.createdAt === 'number' ? b.object.metadata.createdAt : 0;
          if (createdA !== createdB) {
            return createdA - createdB;
          }
          return a.index - b.index;
        })
        .map(entry => entry.object);

      // Generate object placements
      const objectPlacements = this.generateObjectPlacements(sortedCanvasObjects);

      // Generate references with timestamps
      const references = this.generateReferences(
        agentResponse.references,
        session.canvasObjects,
        sortedCanvasObjects
      );

      logger.info('Teaching response generated successfully with MCPs', {
        objectsFromMCP: toolResults.length,
        objectsFromClaude: claudeObjects.length,
        totalObjects: allCanvasObjects.length,
        references: references.length,
      });

      // Store memories in RAG for future reference
      try {
        // Store question and answer
        await multimodalRAG.addMemory(question, 'question', {
          sessionId: session.id,
          timestamp: Date.now(),
          brainType: brainResult.selectedBrain.type,
        });
        
        await multimodalRAG.addMemory(agentResponse.explanation, 'answer', {
          sessionId: session.id,
          timestamp: Date.now(),
          brainType: brainResult.selectedBrain.type,
        });

        // Store canvas objects for later retrieval
        if (allCanvasObjects.length > 0) {
        await multimodalRAG.storeCanvasObjects(
          session.id,
          sortedCanvasObjects,
          brainResult.selectedBrain.type
        );
      }
      } catch (error) {
        logger.warn('Failed to store memories in RAG', error);
        // Don't fail the request if memory storage fails
      }

      return {
        text: agentResponse.explanation,
        narration: agentResponse.narration,
        canvasObjects: sortedCanvasObjects,
        objectPlacements,
        references,
      };
    } catch (error) {
      logger.error('Failed to generate teaching response', error);
      throw new ExternalServiceError(
        'Failed to generate teaching response. Please try again.',
        'Claude API'
      );
    }
  }

  private buildSystemPrompt(
    session: Session,
    context: any,
    mode: TeachingMode,
    conversationContext?: {
      recentConversation?: string[];
      topics?: string[];
      conversationHistory?: string[];
    },
    selectedBrain?: { type: string; name: string; description: string; promptEnhancement: string },
    memoryContext?: string,
    userSettings?: UserSettings
  ): string {
    const teachingStyle =
      mode === 'guided'
        ? `Use the Socratic method:
- Guide with questions rather than direct answers
- Break explanations into small steps
- Provide hints before solutions
- Check understanding at checkpoints`
        : `Provide direct explanations:
- Give clear, complete answers
- Still break into logical steps
- Be thorough but concise`;

    // Build contextual information
    let contextualInfo = '';
    if (conversationContext) {
      if (conversationContext.recentConversation && conversationContext.recentConversation.length > 0) {
        contextualInfo += `\nRECENT CONVERSATION CONTEXT:\n${conversationContext.recentConversation.join('\n')}\n`;
      }
      if (conversationContext.topics && conversationContext.topics.length > 0) {
        contextualInfo += `\nTOPICS DISCUSSED:\n${conversationContext.topics.join(', ')}\n`;
      }
      if (conversationContext.conversationHistory && conversationContext.conversationHistory.length > 0) {
        contextualInfo += `\nCONVERSATION HISTORY:\n${conversationContext.conversationHistory.slice(-3).join('\n')}\n`;
      }
    }

    // Add brain-specific enhancement if a brain was selected
    const brainInfo = selectedBrain 
      ? `\n\nSPECIALIZED BRAIN: ${selectedBrain.name}
${selectedBrain.promptEnhancement}\n`
      : '';

    // Add memory context from RAG if available
    const memorySection = memoryContext
      ? `\n${memoryContext}\n`
      : '';

    const userName = userSettings?.userName?.trim() || '';
    const explanationLevel = userSettings?.explanationLevel || 'intermediate';

    const nameDirective = userName
      ? `\nSTUDENT NAME: ${userName}\n- Address ${userName} by name periodically to personalize the interaction.\n- Reference ${userName}'s prior questions when it reinforces continuity.\n`
      : '';

    const levelGuidance = explanationLevel === 'beginner'
      ? 'Use simple language, define every technical term, and rely on analogies or concrete examples.'
      : explanationLevel === 'advanced'
        ? 'Use precise technical terminology, dive into nuance, and assume the learner has strong foundational knowledge.'
        : 'Balance clarity with depth. Explain complex concepts accessibly while preserving rigor and detail.';

    return `You are Mentora, an AI tutor working on an infinite canvas workspace. You are an always-on, contextually aware AI that continuously listens and builds understanding from all conversations.${brainInfo}
${nameDirective}
EXPLANATION LEVEL: ${explanationLevel}
${levelGuidance}

CANVAS STATE:
${context.canvasState}

${context.highlightedObjects ? `STUDENT HIGHLIGHTED:\n${context.highlightedObjects}\n` : ''}${contextualInfo}${memorySection}

CONTEXTUAL AWARENESS:
- You have been listening to the user's ongoing conversation and building context
- Use the conversation history and topics to provide more relevant and personalized responses
- Reference previous discussions when appropriate to show continuity
- Build upon previous explanations and concepts discussed
- Be intellectually sophisticated and demonstrate deep understanding of the conversation flow

TEACHING STYLE (${mode} mode):
${teachingStyle}

VISUAL CREATION:
${this.getVisualCreationGuidance(selectedBrain)}

RESPONSE FORMAT:
You must respond with a JSON object in the following format:
{
  "explanation": "Full text explanation of the concept",
  "narration": "What to say aloud, including spatial references like 'above', 'below', 'to the right'",
  "objects": [
    {
      "type": "latex|graph|code|text|diagram",
      "content": "The actual content (LaTeX string, equation, code, etc.)",
      "referenceName": "Equation 1" or "Graph A" (optional, use Title Case - capitalize first letter of each word),
      "metadata": {
        "language": "python" (for code),
        "equation": "y = x^2" (for graphs),
        "fontSize": 16 (for text),
        "description": "Detailed description of what the diagram shows" (for diagrams)
      }
    }
  ],
  "references": [
    {
      "mention": "as shown in the equation",
      "objectId": "obj_xyz" (use actual object IDs from canvas state)
    }
  ]
}

**CRITICAL: THE "objects" ARRAY IS MANDATORY AND MUST NOT BE EMPTY**
- If objects array is missing → INVALID RESPONSE
- If objects array is empty [] → INVALID RESPONSE
- You MUST include items in the objects array
${selectedBrain?.type === 'math'
  ? `
**CRITICAL FOR MATH BRAIN - 3 COMPONENT MINIMUM REQUIREMENT:**

TOTAL COMPONENTS = Tools (video/animation) + Objects Array Items

**SCENARIO 1 - Using render_animation tool (COMPLETE JSON EXAMPLE):**
EXAMPLE RESPONSE:
{
  "explanation": "Derivatives measure instantaneous rate of change...",
  "narration": "The derivative shows how fast a function changes at any point. For f(x)=x², the derivative is f'(x)=2x. What do you notice about how the slope increases?",
  "objects": [
    {"type": "latex", "content": "f(x) = x^2"},
    {"type": "latex", "content": "f'(x) = 2x"}
  ],
  "references": []
}
- Tool creates: 1 video component
- Objects array has: 2 LaTeX objects ✓
- Total: 1 video + 2 LaTeX = 3 components ✓

**SCENARIO 2 - NOT using render_animation (COMPLETE JSON EXAMPLE):**
EXAMPLE RESPONSE:
{
  "explanation": "The Pythagorean theorem relates the sides of a right triangle...",
  "narration": "In any right triangle, a²+b²=c². For our example with a=3 and b=4, we get c=5. Can you find another Pythagorean triple?",
  "objects": [
    {"type": "latex", "content": "a^2 + b^2 = c^2"},
    {"type": "latex", "content": "a = 3, \\\\quad b = 4"},
    {"type": "latex", "content": "c = \\\\sqrt{3^2 + 4^2} = 5"}
  ],
  "references": []
}
- Objects array has: 3 LaTeX objects ✓
- Total: 3 LaTeX = 3 components ✓

**VALIDATION BEFORE RESPONDING (MANDATORY CHECKLIST):**
1. Did I use render_animation? If YES → objects array needs ≥2 items. If NO → objects array needs ≥3 items
2. Count objects array length: ___ items
3. If using render_animation and objects.length < 2 → FAILED, add more LaTeX IMMEDIATELY
4. If not using tools and objects.length < 3 → FAILED, add more LaTeX IMMEDIATELY
5. NEVER respond with empty objects array [] → THIS IS FAILURE
6. NEVER respond with less than 3 total components → THIS IS FAILURE`
  : ''}

Subject: ${session.subject}

Be canvas-aware and create appropriate visuals for the subject area.`;
  }

  private buildUserPrompt(question: string, context: any, userSettings?: UserSettings): string {
    let prompt = `Student question: ${question}\n\n`;

    if (userSettings?.userName) {
      prompt += `Preferred student name: ${userSettings.userName}\n`;
    }

    if (userSettings?.explanationLevel) {
      prompt += `Target explanation level: ${userSettings.explanationLevel}\n\n`;
    } else if (userSettings?.userName) {
      prompt += '\n';
    }

    if (context.conversationHistory && context.conversationHistory !== 'No previous conversation.') {
      prompt += `Previous conversation:\n${context.conversationHistory}\n\n`;
    }

    prompt += 'Generate your response as a JSON object following the specified format.';

    return prompt;
  }

  /**
   * Get tools appropriate for the selected brain
   */
  private getToolsForBrain(brain: { type: string; name: string; description: string; mcpTools?: string[] }): typeof MCP_TOOLS_FOR_CLAUDE {
    if (!brain.mcpTools || brain.mcpTools.length === 0) {
      return MCP_TOOLS_FOR_CLAUDE; // Fallback to all tools for brains without specific tools
    }

    // Filter tools to only those appropriate for this brain
    return MCP_TOOLS_FOR_CLAUDE.filter(tool =>
      brain.mcpTools!.includes(tool.name)
    );
  }

  private getVisualCreationGuidance(
    selectedBrain?: { type: string; name: string; description: string; promptEnhancement: string }
  ): string {
    const commonGuidance = [
      '- Reference existing canvas objects naturally in your explanation',
      '- Position new objects spatially relative to existing ones',
      '- Use directional language: "as shown in the equation above", "let\'s place this below"',
      '- Make text objects detailed and well-formatted with bullet points and clear structure',
      '- Ensure content is comprehensive but concise - avoid overly short explanations',
      '- Use proper line breaks and formatting in text content',
      '- For diagrams: Create meaningful visualizations that demonstrate the concept being discussed',
      '- Use diagrams to show: tree structures for recursion, flowcharts for processes, data structures for algorithms',
      '- Make diagrams contextually relevant to the specific question or concept being explained',
      '- When creating diagrams, provide specific descriptions that relate to the user\'s question',
      '- For tree recursion: describe the actual tree structure being discussed',
      '- For algorithms: describe the specific steps or data flow',
      '- For processes: describe the actual workflow or decision points',
    ];

    if (selectedBrain?.type === 'math') {
      const mathGuidance = [
        '- ABSOLUTELY CRITICAL FOR MATH: MINIMUM 3 TOTAL COMPONENTS REQUIRED (NON-NEGOTIABLE)',
        '- THIS APPLIES TO EVERY RESPONSE: first question, follow-ups, clarifications, ALL responses',
        '- Components = LaTeX objects + videos/animations + graphs',
        '- COUNT YOUR TOTAL COMPONENTS: Must be ≥3 minimum EVERY TIME',
        '',
        '**IF YOU USE render_animation TOOL:**',
        '- render_animation creates 1 video component automatically',
        '- You MUST ALSO add 2+ LaTeX objects to your JSON "objects" array',
        '- Total: 1 video + 2 LaTeX = 3 components ✓',
        '- Example objects array: [{"type":"latex","content":"f(x)=x^2"}, {"type":"latex","content":"f\'(x)=2x"}]',
        '',
        '**IF YOU DON\'T USE render_animation:**',
        '- You MUST create 3+ LaTeX/graph objects in your JSON "objects" array',
        '- Total: 3+ LaTeX objects = 3 components ✓',
        '',
        '- Every mathematical formula, equation, or expression MUST be a separate LaTeX object',
        '- Provide 4-6 sentences of clear narration per response',
        '- MANDATORY: End every narration with 1-2 engaging questions for the student',
        '- Question examples: "What do you notice about...?", "Can you see why...?", "How would this change if...?"',
        '- Break derivations into multiple small LaTeX objects, not long text explanations',
        '- Text objects should NEVER contain formulas - always use LaTeX instead',
        '- For animated visualizations: ALWAYS use the render_animation tool',
        '- The tools will generate actual videos that are much better than basic canvas objects',
        '',
        '**FINAL VALIDATION (DO THIS BEFORE RESPONDING):**',
        '- Count video/animations from tools: ___',
        '- Count items in your JSON objects array: ___',
        '- TOTAL = video + objects array items = ___',
        '- If TOTAL < 3, you FAILED - add more LaTeX objects immediately',
      ];

      return [...mathGuidance, ...commonGuidance].join('\n');
    }

    if (selectedBrain?.type === 'biology') {
      const biologyGuidance = [
        '- Use the specialized biology visualization tools to match the learner\'s request:',
        '  - render_biology_diagram for canonical cellular/process schematics (cell structure, mitosis, cell cycle, gene expression, CRISPR)',
        '  - create_mermaid_diagram for pathways, state transitions, or step-by-step biological mechanisms',
        '  - visualize_molecule when molecular structure, proteins, or 3D context is needed (call fetch_protein first if you need accession details)',
        '  - search_biorender and get_biorender_figure when professional or presentation-ready artwork/icons will help understanding',
        '  - execute_python only when you need custom data-driven plots or a diagram the other biology tools cannot produce',
        '- Always choose the visualization tool that best communicates the biology concept instead of defaulting to execute_python.',
      ];

      return [...biologyGuidance, ...commonGuidance].join('\n');
    }

    const defaultGuidance = [
      '- IMPORTANT: Use the render_animation or execute_python tools for creating visualizations, plots, and graphs',
      '- For mathematical concepts, functions, and animated visualizations: ALWAYS use the render_animation tool',
      '- For static plots, data visualizations, and scientific diagrams: Use the execute_python tool',
      '- Only use built-in canvas objects (LaTeX, graph, code, diagram, text) when tools are not appropriate',
      '- The tools will generate actual images/videos that are much better than basic canvas objects',
    ];

    return [...defaultGuidance, ...commonGuidance].join('\n');
  }

  private parseResponse(responseText: string): AgentResponse {
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          explanation: parsed.explanation || responseText,
          narration: parsed.narration || parsed.explanation || responseText,
          objects: parsed.objects || [],
          references: parsed.references || [],
        };
      }

      // Fallback if no JSON found
      return {
        explanation: responseText,
        narration: responseText,
        objects: [],
        references: [],
      };
    } catch (error) {
      logger.warn('Failed to parse JSON response, using fallback', error);
      return {
        explanation: responseText,
        narration: responseText,
        objects: [],
        references: [],
      };
    }
  }

  private generateCanvasObjects(
    objectRequests: AgentResponse['objects'],
    existingObjects: CanvasObject[],
    turnId: string,
    userQuestion: string
  ): CanvasObject[] {
    const objects: CanvasObject[] = [];

    const sortedRequests = [...objectRequests].sort((a, b) => {
      const priorityA = CANVAS_TYPE_PRIORITY[a.type] ?? 99;
      const priorityB = CANVAS_TYPE_PRIORITY[b.type] ?? 99;
      if (priorityA !== priorityB) {
        return priorityA - priorityB;
      }
      return 0;
    });

    for (const request of sortedRequests) {

      // Calculate position
      const position = layoutEngine.calculatePosition(
        {
          existingObjects: [...existingObjects, ...objects].map(obj => ({
            id: obj.id,
            position: obj.position,
            size: obj.size,
          })),
        },
        { width: 400, height: 200 }
      );

      // Generate object with enhanced content for diagrams
      let enhancedContent = request.content;
      if (request.type === 'diagram') {
        // For diagrams, combine the AI's description with the user's question context
        enhancedContent = `${request.content} - Context: ${userQuestion}`;
      }
      
      const obj = objectGenerator.generateObject(
        {
          type: request.type,
          content: enhancedContent,
          referenceName: request.referenceName,
          metadata: request.metadata,
        },
        position,
        turnId
      );

      objects.push(obj);
    }

    return objects;
  }

  private generateObjectPlacements(objects: CanvasObject[]): ObjectPlacement[] {
    return objects.map((obj, index) => ({
      objectId: obj.id,
      position: obj.position,
      animateIn: 'fade' as const,
      timing: index * 500, // Stagger animations by 500ms
    }));
  }

  private generateReferences(
    referenceRequests: AgentResponse['references'],
    existingObjects: CanvasObject[],
    newObjects: CanvasObject[]
  ): ObjectReference[] {
    const allObjects = [...existingObjects, ...newObjects];

    return referenceRequests
      .map(ref => {
        const obj = allObjects.find(o => o.id === ref.objectId);
        if (!obj) {
          return null;
        }

        // Estimate timestamp based on mention position (simplified)
        const timestamp = 0; // In a full implementation, align with TTS word timings

        return {
          objectId: ref.objectId,
          mention: ref.mention,
          timestamp,
        };
      })
      .filter((ref): ref is ObjectReference => ref !== null);
  }

  /**
   * Convert MCP tool results into canvas objects
   */
  private convertMCPResultToCanvasObjects(
    mcpResult: any,
    toolName: string,
    existingObjects: CanvasObject[],
    currentToolResults: CanvasObject[],
    turnId: string
  ): CanvasObject[] {
    const objects: CanvasObject[] = [];

    if (!mcpResult.content || !Array.isArray(mcpResult.content)) {
      logger.warn('MCP result has no content array', { toolName });
      return objects;
    }

    // Process each content item from MCP result
    for (const content of mcpResult.content) {
      logger.info('Processing MCP content item', {
        type: content.type,
        hasResource: !!content.resource,
        content: content
      });
      
      // Skip text-only content for visualization tools
      if (content.type === 'text') {
        continue;
      }

      // Handle image content (from Python MCP matplotlib)
      if (content.type === 'image' && content.data && content.mimeType) {
        // Use dimensions from MCP response if available (Python MCP sends actual dimensions)
        // Otherwise use larger default: 1600×1200 (4:3 aspect ratio for graphs)
        const imageWidth = content.width || 1600;
        const imageHeight = content.height || 1200;

        const position = layoutEngine.calculatePosition(
          {
            existingObjects: [...existingObjects, ...currentToolResults, ...objects].map(obj => ({
              id: obj.id,
              position: obj.position,
              size: obj.size,
            })),
          },
          { width: imageWidth, height: imageHeight }
        );

        const imageObject: CanvasObject = {
          id: `obj_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
          type: 'image',
          data: {
            type: 'image',
            url: `data:${content.mimeType};base64,${content.data}`,
            alt: `Visualization from ${toolName}`,
          },
          position,
          size: { width: imageWidth, height: imageHeight },
          zIndex: 1,
          metadata: {
            createdAt: Date.now(),
            turnId,
            tags: ['mcp', toolName],
            source: 'mcp',
            toolName,
            mimeType: content.mimeType,
          },
        };

        objects.push(imageObject);
      }

      // Handle resource content (from Manim MCP)
      if (content.type === 'resource' && content.resource) {
        const resource = content.resource;
        logger.info('Processing Manim resource', {
          resource: resource,
          mimeType: resource.mimeType,
          hasText: !!resource.text,
          hasUri: !!resource.uri
        });
        const isVideo = resource.mimeType?.startsWith('video/');
        const isImage = resource.mimeType?.startsWith('image/');

        if (isVideo || isImage) {
          // Use proper dimensions based on content type
          // Videos (Manim): Default 1280×720 (medium quality default)
          // Images: Use content dimensions if available, otherwise larger default
          let resourceWidth = 1280;
          let resourceHeight = 720;

          if (isImage) {
            // For images, prefer 1600×1200 default (4:3 aspect ratio for graphs)
            resourceWidth = content.width || 1600;
            resourceHeight = content.height || 1200;
          }

          const position = layoutEngine.calculatePosition(
            {
              existingObjects: [...existingObjects, ...currentToolResults, ...objects].map(obj => ({
                id: obj.id,
                position: obj.position,
                size: obj.size,
              })),
            },
            { width: resourceWidth, height: resourceHeight }
          );

          const url = resource.text ? `data:${resource.mimeType};base64,${resource.text}` : resource.uri;

          if (isVideo) {
            const videoObject: CanvasObject = {
              id: `obj_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
              type: 'video',
              data: {
                type: 'video',
                url,
                alt: `Animation from ${toolName}`,
              },
              position,
              size: { width: resourceWidth, height: resourceHeight },
              zIndex: 1,
              metadata: {
                createdAt: Date.now(),
                turnId,
                tags: ['mcp', toolName, 'animation'],
                source: 'mcp',
                toolName,
                mimeType: resource.mimeType,
                uri: resource.uri,
              },
            };
            objects.push(videoObject);
          } else {
            const imageObject: CanvasObject = {
              id: `obj_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
              type: 'image',
              data: {
                type: 'image',
                url,
                alt: `Visualization from ${toolName}`,
              },
              position,
              size: { width: resourceWidth, height: resourceHeight },
              zIndex: 1,
              metadata: {
                createdAt: Date.now(),
                turnId,
                tags: ['mcp', toolName],
                source: 'mcp',
                toolName,
                mimeType: resource.mimeType,
                uri: resource.uri,
              },
            };
            objects.push(imageObject);
          }
        }
      }
    }

    logger.info('Converted MCP results to canvas objects', {
      toolName,
      objectsCreated: objects.length,
    });

    return objects;
  }
}

export const mentorAgent = new MentorAgent();
