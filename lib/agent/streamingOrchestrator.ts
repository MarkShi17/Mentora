/**
 * Streaming Orchestrator
 *
 * Coordinates Claude streaming responses with real-time TTS generation.
 * Ensures OpenAI TTS speaks Claude's contextually-aware narration as it's generated.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Session } from '@/types/session';
import { CanvasObject, ObjectPlacement, ObjectReference } from '@/types/canvas';
import { TeachingMode, StreamEvent } from '@/types/api';
import { contextBuilder } from './contextBuilder';
import { objectGenerator } from '@/lib/canvas/objectGenerator';
import { layoutEngine } from '@/lib/canvas/layoutEngine';
import { ttsService } from '@/lib/voice/ttsService';
import { SentenceParser } from '@/lib/utils/sentenceParser';
import { logger } from '@/lib/utils/logger';
import { mcpManager } from '@/lib/mcp';
import { initializeMCP } from '@/lib/mcp/init';
import { MCP_TOOLS_FOR_CLAUDE, TOOL_TO_SERVER_MAP, isVisualizationTool } from './mcpTools';
import type { Brain } from '@/types/brain';

interface StreamingContext {
  sessionId: string;
  turnId: string;
  voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer';
  existingObjects: CanvasObject[];
  userQuestion: string;
}

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

export class StreamingOrchestrator {
  private anthropic: Anthropic;
  private abortControllers: Map<string, AbortController>;

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
    this.abortControllers = new Map();
  }

  /**
   * Cancel a specific streaming response
   */
  public cancelStream(turnId: string): void {
    const controller = this.abortControllers.get(turnId);
    if (controller) {
      logger.info('🛑 Cancelling stream for turn', { turnId });
      controller.abort();
      this.abortControllers.delete(turnId);
    }
  }

  /**
   * Cancel all active streams
   */
  public cancelAllStreams(): void {
    logger.info('🛑 Cancelling all active streams', { count: this.abortControllers.size });
    this.abortControllers.forEach((controller, turnId) => {
      controller.abort();
    });
    this.abortControllers.clear();
  }

  /**
   * Stream a teaching response with real-time TTS and MCP tool integration
   */
  async *streamResponse(
    question: string,
    session: Session,
    highlightedObjectIds: string[] = [],
    mode: TeachingMode = 'guided',
    turnId: string,
    voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'nova',
    context?: {
      recentConversation?: string[];
      topics?: string[];
      conversationHistory?: string[];
    },
    userSettings?: {
      userName?: string;
      explanationLevel?: 'beginner' | 'intermediate' | 'advanced';
    },
    cachedIntroPlayed?: {
      text: string;
      id: string;
    } | null,
    selectedBrain?: Brain
  ): AsyncGenerator<StreamEvent, void, unknown> {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('🎬 STREAMING ORCHESTRATOR STARTED');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('Session ID', { sessionId: session.id });
    logger.info('Question', { question });
    logger.info('Mode', { mode });
    logger.info('Turn ID', { turnId });
    logger.info('Existing canvas objects', { count: session.canvasObjects.length });

    // Create abort controller for this stream
    const abortController = new AbortController();
    this.abortControllers.set(turnId, abortController);

    const streamingContext: StreamingContext = {
      sessionId: session.id,
      turnId,
      voice,
      existingObjects: session.canvasObjects,
      userQuestion: question
    };

    try {
      // Initialize MCP system
      await initializeMCP();

      // Send metadata first
      yield {
        type: 'metadata',
        timestamp: Date.now(),
        data: {
          turnId,
          totalSentences: 0, // Will be updated
          sessionId: session.id
        }
      };

      // Filter MCP tools based on selected brain
      const availableTools = selectedBrain && selectedBrain.mcpTools && selectedBrain.mcpTools.length > 0
        ? MCP_TOOLS_FOR_CLAUDE.filter(tool => selectedBrain.mcpTools.includes(tool.name))
        : [];

      logger.info('MCP tools available for this brain', {
        brainType: selectedBrain?.type || 'none',
        tools: availableTools.map(t => t.name)
      });

      // Build context from session
      const sessionContext = contextBuilder.buildContext(session, highlightedObjectIds);

      // Generate system and user prompts with user settings
      const systemPrompt = this.buildSystemPrompt(session, sessionContext, mode, context, userSettings, cachedIntroPlayed, selectedBrain);
      const userPrompt = this.buildUserPrompt(question, sessionContext);

      // Get model from selected brain
      const model = selectedBrain?.model || 'claude-sonnet-4-5-20250929';

      // NOTE: Tools parameter is commented out for now because:
      // 1. The streaming orchestrator doesn't handle tool_use blocks yet
      // 2. MCP servers need to be running to execute tool calls
      // 3. The brain's promptEnhancement is sufficient to guide JSON responses
      // TODO: Add tool execution handling to streaming orchestrator
      // const tools = selectedBrain ? this.getToolsForBrain(selectedBrain) : MCP_TOOLS_FOR_CLAUDE;

      // MCP tool execution loop
      let messages: Anthropic.MessageParam[] = [
        {
          role: 'user',
          content: userPrompt
        }
      ];

      let finalResponseText = '';
      const toolGeneratedObjects: CanvasObject[] = [];
      const maxIterations = 5; // Prevent infinite tool use loops
      let iteration = 0;

      // Multi-turn conversation loop for MCP tool use
      while (iteration < maxIterations) {
        iteration++;

        logger.info('🧠 Calling Claude API', {
          model: 'claude-sonnet-4-5-20250929',
          maxTokens: 4096,
          iteration,
          hasTools: availableTools.length > 0
        });

        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-5-20250929',
          max_tokens: selectedBrain?.type === 'math' ? 2048 : 4096, // Reduce tokens for Math brain to enforce conciseness
          system: systemPrompt,
          tools: availableTools.length > 0 ? availableTools : undefined,
          messages
        });

        logger.info('Claude response received', {
          stopReason: response.stop_reason,
          iteration,
          contentBlocks: response.content.length
        });

        // If Claude wants to use tools
        if (response.stop_reason === 'tool_use') {
          const toolUses = response.content.filter(block => block.type === 'tool_use');
          const textBlocks = response.content.filter(block => block.type === 'text');

          // Store any text explanation
          if (textBlocks.length > 0 && !finalResponseText) {
            finalResponseText = textBlocks.map((block: any) => block.text).join('\n');
          }

          // Add assistant's message with tool use to conversation
          messages.push({
            role: 'assistant',
            content: response.content
          });

          // Execute all tool calls
          const toolResultsContent: Anthropic.ToolResultBlockParam[] = [];

          for (const toolUse of toolUses) {
            if (toolUse.type !== 'tool_use') continue;

            logger.info('Executing MCP tool', {
              toolName: toolUse.name,
              toolId: toolUse.id
            });

            const toolStartTime = Date.now();

            try {
              const serverId = TOOL_TO_SERVER_MAP[toolUse.name];
              if (!serverId) {
                throw new Error(`Unknown tool: ${toolUse.name}`);
              }

              // Emit tool_start event
              yield {
                type: 'mcp_tool_start',
                timestamp: Date.now(),
                data: {
                  toolName: toolUse.name,
                  serverId,
                  description: MCP_TOOLS_FOR_CLAUDE.find(t => t.name === toolUse.name)?.description || ''
                }
              };

              // Call MCP server
              const mcpResult = await mcpManager.callTool({
                serverId,
                toolName: toolUse.name,
                arguments: toolUse.input as Record<string, any>
              });

              logger.info('MCP tool result received', {
                toolName: toolUse.name,
                serverId,
                success: mcpResult.success,
                contentLength: mcpResult.content?.length || 0
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
                  toolGeneratedObjects,
                  turnId
                );
                toolGeneratedObjects.push(...mcpObjects);
                generatedObjectsCount = mcpObjects.length;

                // Stream each generated object immediately
                for (const obj of mcpObjects) {
                  streamingContext.existingObjects.push(obj);

                  const placement: ObjectPlacement = {
                    objectId: obj.id,
                    position: obj.position,
                    animateIn: 'fade',
                    timing: toolGeneratedObjects.length * 300
                  };

                  yield {
                    type: 'canvas_object',
                    timestamp: Date.now(),
                    data: {
                      object: obj,
                      placement
                    }
                  };
                }
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
                content: resultText || 'Tool executed successfully'
              });

              // Emit tool_complete event
              yield {
                type: 'mcp_tool_complete',
                timestamp: Date.now(),
                data: {
                  toolName: toolUse.name,
                  serverId,
                  success: true,
                  duration: Date.now() - toolStartTime
                }
              };

              logger.info('MCP tool executed successfully', {
                toolName: toolUse.name,
                objectsCreated: generatedObjectsCount,
                duration: Date.now() - toolStartTime
              });

            } catch (error) {
              const serverId = TOOL_TO_SERVER_MAP[toolUse.name] || 'unknown';

              logger.error('MCP tool execution failed', {
                toolName: toolUse.name,
                error
              });

              toolResultsContent.push({
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: `Error: ${error instanceof Error ? error.message : String(error)}`,
                is_error: true
              });

              // Emit tool_complete event with error
              yield {
                type: 'mcp_tool_complete',
                timestamp: Date.now(),
                data: {
                  toolName: toolUse.name,
                  serverId,
                  success: false,
                  duration: Date.now() - toolStartTime,
                  error: error instanceof Error ? error.message : String(error)
                }
              };
            }
          }

          // Add tool results to conversation
          messages.push({
            role: 'user',
            content: toolResultsContent
          });

          // Continue conversation loop to get final response
          continue;
        }

        // Claude finished without using tools or after using tools
        const textContent = response.content
          .filter(block => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n');

        finalResponseText = textContent;
        break;
      }

      logger.info('✅ MCP tool loop completed', {
        iterations: iteration,
        toolObjectsCreated: toolGeneratedObjects.length,
        hasFinalResponse: !!finalResponseText
      });

      // DEBUG: Log the raw response text to see what Claude returned
      logger.info('📄 Raw Claude response (first 500 chars):', {
        responseLength: finalResponseText.length,
        responsePreview: finalResponseText.substring(0, 500)
      });

      // Now stream the final response with TTS
      const sentenceParser = new SentenceParser();
      let totalObjects = toolGeneratedObjects.length; // Start with MCP objects
      let totalReferences = 0;

      // Parse the final response to get narration and additional objects
      const agentResponse = this.parseResponse(finalResponseText);

      // DEBUG: Log parsed response details
      logger.info('🔍 Parsed response details:', {
        hasNarration: !!agentResponse.narration,
        narrationLength: agentResponse.narration?.length || 0,
        objectsCount: agentResponse.objects?.length || 0,
        objectTypes: agentResponse.objects?.map(obj => obj.type) || [],
        referencesCount: agentResponse.references?.length || 0
      });

      // Separate objects into priority (latex, graph) and regular for early rendering
      const priorityObjects = agentResponse.objects.filter(obj =>
        obj.type === 'latex' || obj.type === 'graph'
      );
      const regularObjects = agentResponse.objects.filter(obj =>
        obj.type !== 'latex' && obj.type !== 'graph'
      );

      // Emit priority objects BEFORE TTS starts for immediate visual feedback
      if (priorityObjects.length > 0) {
        logger.info('🎯 Emitting priority objects before TTS', {
          priorityObjectCount: priorityObjects.length,
          types: priorityObjects.map(obj => obj.type)
        });

        for (const request of priorityObjects) {
          const position = layoutEngine.calculatePosition(
            {
              existingObjects: streamingContext.existingObjects.map(obj => ({
                id: obj.id,
                position: obj.position,
                size: obj.size
              }))
            },
            { width: 400, height: 200 }
          );

          const canvasObject = objectGenerator.generateObject(
            {
              type: request.type,
              content: request.content,
              referenceName: request.referenceName,
              metadata: request.metadata
            },
            position,
            turnId
          );

          streamingContext.existingObjects.push(canvasObject);

          const placement: ObjectPlacement = {
            objectId: canvasObject.id,
            position: canvasObject.position,
            animateIn: 'fade',
            timing: totalObjects * 300
          };

          yield {
            type: 'canvas_object',
            timestamp: Date.now(),
            data: { object: canvasObject, placement }
          };

          totalObjects++;
        }
      }

      // Stream narration sentence-by-sentence with TTS
      if (agentResponse.narration && agentResponse.narration.trim().length > 0) {
        logger.info('🗣️ Streaming narration with TTS', {
          narrationLength: agentResponse.narration.length
        });

        // Split narration into sentences
        const sentences = sentenceParser.addChunk(agentResponse.narration);

        // Process each sentence
        for (const sentence of sentences) {
          logger.debug('Processing narration sentence', {
            sentenceIndex: sentence.index,
            text: sentence.text.substring(0, 100)
          });

          // Send text chunk event
          yield {
            type: 'text_chunk',
            timestamp: Date.now(),
            data: {
              text: sentence.text,
              sentenceIndex: sentence.index
            }
          };

          // Generate TTS for the sentence
          try {
            const audioResult = await ttsService.generateSentenceSpeech(
              sentence.text,
              voice,
              sentence.index
            );

            yield {
              type: 'audio_chunk',
              timestamp: Date.now(),
              data: audioResult
            };
          } catch (error) {
            logger.warn('TTS generation failed for sentence', {
              sentenceIndex: sentence.index,
              error: error instanceof Error ? error.message : 'Unknown'
            });
          }
        }

        // Flush any remaining sentence
        const finalSentence = sentenceParser.flush();
        if (finalSentence) {
          yield {
            type: 'text_chunk',
            timestamp: Date.now(),
            data: {
              text: finalSentence.text,
              sentenceIndex: finalSentence.index
            }
          };

          try {
            const audioResult = await ttsService.generateSentenceSpeech(
              finalSentence.text,
              voice,
              finalSentence.index
            );

            yield {
              type: 'audio_chunk',
              timestamp: Date.now(),
              data: audioResult
            };
          } catch (error) {
            logger.warn('TTS generation failed for final sentence', { error });
          }
        }
      }

      // Generate remaining canvas objects (non-priority) from Claude's response
      if (regularObjects && regularObjects.length > 0) {
        logger.info('Generating regular canvas objects from Claude response', {
          objectCount: regularObjects.length
        });

        for (const request of regularObjects) {
          const position = layoutEngine.calculatePosition(
            {
              existingObjects: streamingContext.existingObjects.map(obj => ({
                id: obj.id,
                position: obj.position,
                size: obj.size
              }))
            },
            { width: 400, height: 200 }
          );

          let enhancedContent = request.content;
          if (request.type === 'diagram') {
            enhancedContent = `${request.content} - Context: ${question}`;
          }

          const canvasObject = objectGenerator.generateObject(
            {
              type: request.type,
              content: enhancedContent,
              referenceName: request.referenceName,
              metadata: request.metadata
            },
            position,
            turnId
          );

          streamingContext.existingObjects.push(canvasObject);

          const placement: ObjectPlacement = {
            objectId: canvasObject.id,
            position: canvasObject.position,
            animateIn: 'fade',
            timing: totalObjects * 300
          };

          yield {
            type: 'canvas_object',
            timestamp: Date.now(),
            data: {
              object: canvasObject,
              placement
            }
          };

          totalObjects++;
        }
      }

      // Stream references
      if (agentResponse.references && agentResponse.references.length > 0) {
        for (const ref of agentResponse.references) {
          const objectReference = this.generateReferences(
            [ref],
            streamingContext.existingObjects,
            []
          )[0];

          if (objectReference) {
            yield {
              type: 'reference',
              timestamp: Date.now(),
              data: objectReference
            };

            totalReferences++;
          }
        }
      }
      // Send completion event
      yield {
        type: 'complete',
        timestamp: Date.now(),
        data: {
          success: true,
          totalSentences: sentenceParser.getSentenceCount(),
          totalObjects,
          totalReferences
        }
      };

      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('✅ STREAMING COMPLETE');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('Total sentences:', sentenceParser.getSentenceCount());
      logger.info('Total objects:', totalObjects);
      logger.info('Total references:', totalReferences);
    } catch (error) {
      // Check if this was an abort/cancellation
      if (error instanceof Error && error.name === 'AbortError') {
        logger.info('Stream cancelled by client', { turnId });
        yield {
          type: 'interrupted',
          timestamp: Date.now(),
          data: {
            message: 'Response generation was stopped',
            code: 'USER_CANCELLED'
          }
        };
      } else {
        // Log the full error details
        console.error('❌ STREAMING ERROR DETAILS:', {
          message: error instanceof Error ? error.message : String(error),
          name: error instanceof Error ? error.name : 'Unknown',
          stack: error instanceof Error ? error.stack : undefined,
          fullError: error
        });
        logger.error('Streaming error:', error);
        yield {
          type: 'error',
          timestamp: Date.now(),
          data: {
            message: error instanceof Error ? error.message : 'Unknown error occurred'
          }
        };
      }
    } finally {
      // Clean up abort controller
      this.abortControllers.delete(turnId);
      logger.debug('Cleaned up abort controller for turn', { turnId });
    }
  }

  /**
   * Build system prompt (reused from mentorAgent)
   */
  private buildSystemPrompt(
    session: Session,
    context: any,
    mode: TeachingMode,
    conversationContext?: {
      recentConversation?: string[];
      topics?: string[];
      conversationHistory?: string[];
    },
    userSettings?: {
      userName?: string;
      explanationLevel?: 'beginner' | 'intermediate' | 'advanced';
    },
    cachedIntroPlayed?: {
      text: string;
      id: string;
    } | null,
    selectedBrain?: Brain
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

    const userName = userSettings?.userName || '';
    const explanationLevel = userSettings?.explanationLevel || 'intermediate';

    // Adjust explanation depth based on level
    const levelGuidance = explanationLevel === 'beginner'
      ? 'Use simple language, provide many examples, and explain technical terms when you use them.'
      : explanationLevel === 'advanced'
      ? 'Use technical terminology freely, focus on depth and nuance, assume strong foundational knowledge.'
      : 'Balance clarity with depth, explain complex concepts but assume basic familiarity.';

    const cachedIntroInfo = cachedIntroPlayed
      ? `\nCRITICAL INSTRUCTION: An introductory phrase has already been spoken: "${cachedIntroPlayed.text}"
DO NOT repeat this greeting or acknowledgment. Start your [NARRATION] by going DIRECTLY to the main content.
Skip phrases like "Let me help", "I can explain", "Sure", etc. Jump straight into teaching.\n`
      : '';

    return `You are Mentora, an AI tutor working on an infinite canvas workspace. You are an always-on, contextually aware AI that continuously listens and builds understanding from all conversations.
${userName ? `\nSTUDENT NAME: ${userName} - Address them by name occasionally to personalize the interaction.\n` : ''}
EXPLANATION LEVEL: ${explanationLevel}
${levelGuidance}
${cachedIntroInfo}
CANVAS STATE:
${context.canvasState}

${context.highlightedObjects ? `STUDENT HIGHLIGHTED:\n${context.highlightedObjects}\n` : ''}${contextualInfo}

CONTEXTUAL AWARENESS:
- You have been listening to the user's ongoing conversation and building context
- Use the conversation history and topics to provide more relevant and personalized responses
- Reference previous discussions when appropriate to show continuity
- Build upon previous explanations and concepts discussed
- Be intellectually sophisticated and demonstrate deep understanding of the conversation flow

TEACHING STYLE (${mode} mode):
${teachingStyle}

COMPREHENSION CHECKING:
- Ask follow-up questions to ensure understanding
- Check if the student grasps key concepts before moving on
- Encourage the student to explain concepts back to you
- Adjust your explanation depth based on their responses

VISUAL CREATION:
- Create visual objects to explain concepts (LaTeX equations, graphs, code blocks, diagrams, text notes)
- Reference existing canvas objects naturally in your explanation
- Position new objects spatially relative to existing ones
- Use directional language: "as shown in the equation above", "let's place this below"
- Make text objects detailed and well-formatted with bullet points and clear structure
- Ensure content is comprehensive but concise - avoid overly short explanations
- Use proper line breaks and formatting in text content
- For diagrams: Create meaningful visualizations that demonstrate the concept being discussed
- Use diagrams to show: tree structures for recursion, flowcharts for processes, data structures for algorithms
- Make diagrams contextually relevant to the specific question or concept being explained

RESPONSE FORMAT:
Stream your response using these markers. Start with text immediately, then define objects as they become relevant:

[NARRATION]: Start your spoken response here immediately
[OBJECT_START type="latex|graph|code|text|diagram" id="obj_1"]: Begin defining an object
[OBJECT_CONTENT]: The actual content for the object
[OBJECT_META key="value"]: Optional metadata (language, equation, etc.)
[OBJECT_END]: Complete the object definition
[NARRATION]: Continue with more explanation
[REFERENCE mention="as shown above" objectId="obj_xyz"]: Reference existing objects

Example:
[NARRATION]: Let me help you understand quadratic equations.
[NARRATION]: A quadratic equation has the general form where the highest power is 2.
[OBJECT_START type="latex" id="eq_1"]: Starting equation
[OBJECT_CONTENT]: ax^2 + bx + c = 0
[OBJECT_META referenceName="general form"]:
[OBJECT_END]:
[NARRATION]: As you can see in the general form above, we have three coefficients.
[OBJECT_START type="graph" id="graph_1"]: Creating visualization
[OBJECT_CONTENT]: y = x^2 - 4x + 3
[OBJECT_META equation="x^2 - 4x + 3"]:
[OBJECT_END]:
[NARRATION]: This parabola shows how the equation creates a U-shaped curve.

IMPORTANT:
- Start with [NARRATION] immediately - don't wait to plan objects
- Stream text naturally and define objects inline as they become relevant
- Keep narration conversational and natural
- Objects can be defined while you continue explaining

Subject: ${session.subject}

Be canvas-aware and create appropriate visuals for the subject area.

${selectedBrain?.promptEnhancement ? `\n\nSPECIALIZED BRAIN INSTRUCTIONS:\n${selectedBrain.promptEnhancement}` : ''}`;
  }

  private buildUserPrompt(question: string, context: any): string {
    let prompt = `Student question: ${question}\n\n`;

    if (context.conversationHistory && context.conversationHistory !== 'No previous conversation.') {
      prompt += `Previous conversation:\n${context.conversationHistory}\n\n`;
    }

    prompt += 'Generate your response using the streaming format with [NARRATION], [OBJECT_START], etc. markers.';

    return prompt;
  }

  private parseResponse(responseText: string): AgentResponse {
    try {
      // First check if this is the new marker format
      if (responseText.includes('[NARRATION]') || responseText.includes('[OBJECT_START')) {
        return this.parseMarkerFormat(responseText);
      }

      // Fallback to JSON format for backward compatibility
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);

        // STRICT: Only return narration if it exists and is clean
        const hasValidNarration = parsed.narration &&
                                  typeof parsed.narration === 'string' &&
                                  parsed.narration.length > 0 &&
                                  !parsed.narration.startsWith('{') && // Not raw JSON
                                  !parsed.narration.includes('"explanation"') && // Not JSON string
                                  !parsed.narration.includes('"objects"'); // Not JSON string

        return {
          explanation: parsed.explanation || '',
          narration: hasValidNarration ? parsed.narration : '',  // Empty if invalid - DON'T speak yet
          objects: parsed.objects || [],
          references: parsed.references || []
        };
      }

      // No valid format found
      logger.debug('No valid response format found', { textLength: responseText.length });
      return {
        explanation: '',
        narration: '',
        objects: [],
        references: []
      };
    } catch (error) {
      // Parse error - return empty narration (don't speak malformed JSON)
      logger.debug('Parse error (normal during streaming)', {
        error: error instanceof Error ? error.message : 'Unknown',
        textSnippet: responseText.substring(0, 100)
      });
      return {
        explanation: '',
        narration: '',
        objects: [],
        references: []
      };
    }
  }

  private parseMarkerFormat(responseText: string): AgentResponse {
    // Extract narration sections
    const narrationMatches = responseText.matchAll(/\[NARRATION\]:\s*([^\[]*)/g);
    const narrationParts = [];
    for (const match of narrationMatches) {
      if (match[1] && match[1].trim()) {
        narrationParts.push(match[1].trim());
      }
    }
    const narration = narrationParts.join(' ');

    // Extract objects
    const objects = [];
    const objectMatches = responseText.matchAll(/\[OBJECT_START\s+type="(\w+)"\s+id="([^"]+)"\].*?\[OBJECT_CONTENT\]:\s*([^\[]*?)(?:\[OBJECT_META[^\]]*\]:\s*([^\[]*?))?\[OBJECT_END\]/gs);
    for (const match of objectMatches) {
      const [_, type, id, content, meta] = match;
      if (type && content) {
        const obj: any = {
          type,
          content: content.trim()
        };

        // Parse metadata if present
        if (meta) {
          const metaMatch = meta.match(/(\w+)="([^"]+)"/);
          if (metaMatch) {
            obj.referenceName = metaMatch[2];
          }
        }

        objects.push(obj);
      }
    }

    // Extract references
    const references = [];
    const referenceMatches = responseText.matchAll(/\[REFERENCE\s+mention="([^"]+)"\s+objectId="([^"]+)"\]/g);
    for (const match of referenceMatches) {
      references.push({
        mention: match[1],
        objectId: match[2]
      });
    }

    logger.debug('Parsed marker format response', {
      narrationLength: narration.length,
      objectCount: objects.length,
      referenceCount: references.length
    });

    return {
      explanation: narration, // Use narration as explanation too
      narration,
      objects,
      references
    };
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

        return {
          objectId: ref.objectId,
          mention: ref.mention,
          timestamp: 0
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
        const position = layoutEngine.calculatePosition(
          {
            existingObjects: [...existingObjects, ...currentToolResults, ...objects].map(obj => ({
              id: obj.id,
              position: obj.position,
              size: obj.size,
            })),
          },
          { width: 600, height: 400 }
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
          size: { width: 600, height: 400 },
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
          const position = layoutEngine.calculatePosition(
            {
              existingObjects: [...existingObjects, ...currentToolResults, ...objects].map(obj => ({
                id: obj.id,
                position: obj.position,
                size: obj.size,
              })),
            },
            { width: 600, height: 400 }
          );

          // CRITICAL: Always prefer base64 data URLs to prevent stale file:// URI caching
          let url: string;
          if (resource.text && resource.text.length > 0) {
            // Use base64 data URL - this ensures fresh content every time
            url = `data:${resource.mimeType};base64,${resource.text}`;
            logger.info('Using base64 data URL for video', {
              toolName,
              base64Length: resource.text.length,
              mimeType: resource.mimeType
            });
          } else {
            // Fallback to URI - log warning as this may cause caching issues
            url = resource.uri;
            logger.warn('⚠️ Using file:// URI for video - may cause caching!', {
              toolName,
              uri: resource.uri,
              reason: 'base64 data missing from MCP response'
            });
          }

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
              size: { width: 600, height: 400 },
              zIndex: 1,
              metadata: {
                createdAt: Date.now(),
                turnId,
                tags: ['mcp', toolName, 'animation'],
                source: 'mcp',
                toolName,
                mimeType: resource.mimeType,
                uri: resource.uri,
                usedBase64: !!resource.text,  // Track if we used base64
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
              size: { width: 600, height: 400 },
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

export const streamingOrchestrator = new StreamingOrchestrator();
