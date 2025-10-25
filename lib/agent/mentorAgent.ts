import Anthropic from '@anthropic-ai/sdk';
import { Session } from '@/types/session';
import { CanvasObject, ObjectPlacement, ObjectReference } from '@/types/canvas';
import { TeachingMode } from '@/types/api';
import { contextBuilder } from './contextBuilder';
import { objectGenerator } from '@/lib/canvas/objectGenerator';
import { layoutEngine } from '@/lib/canvas/layoutEngine';
import { logger } from '@/lib/utils/logger';
import { ExternalServiceError } from '@/lib/utils/errors';

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
    }
  ): Promise<{
    text: string;
    narration: string;
    canvasObjects: CanvasObject[];
    objectPlacements: ObjectPlacement[];
    references: ObjectReference[];
  }> {
    try {
      logger.info('Generating teaching response', { question, mode, sessionId: session.id });

      // Build context from session history and canvas
      const sessionContext = contextBuilder.buildContext(session, highlightedObjectIds);

      // Generate system prompt
      const systemPrompt = this.buildSystemPrompt(session, sessionContext, mode, context);

      // Generate user prompt
      const userPrompt = this.buildUserPrompt(question, sessionContext);

      // Call Claude API
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt,
          },
        ],
      });

      // Parse response
      const responseText = response.content[0].type === 'text' ? response.content[0].text : '';
      const agentResponse = this.parseResponse(responseText);

      // Generate canvas objects
      const canvasObjects = this.generateCanvasObjects(
        agentResponse.objects,
        session.canvasObjects,
        turnId,
        question
      );

      // Generate object placements
      const objectPlacements = this.generateObjectPlacements(canvasObjects);

      // Generate references with timestamps
      const references = this.generateReferences(
        agentResponse.references,
        session.canvasObjects,
        canvasObjects
      );

      logger.info('Teaching response generated successfully', {
        objectsCreated: canvasObjects.length,
        references: references.length,
      });

      return {
        text: agentResponse.explanation,
        narration: agentResponse.narration,
        canvasObjects,
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
    }
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

    return `You are Mentora, an AI tutor working on an infinite canvas workspace. You are an always-on, contextually aware AI that continuously listens and builds understanding from all conversations.

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
- When creating diagrams, provide specific descriptions that relate to the user's question
- For tree recursion: describe the actual tree structure being discussed
- For algorithms: describe the specific steps or data flow
- For processes: describe the actual workflow or decision points

RESPONSE FORMAT:
You must respond with a JSON object in the following format:
{
  "explanation": "Full text explanation of the concept",
  "narration": "What to say aloud, including spatial references like 'above', 'below', 'to the right'",
  "objects": [
    {
      "type": "latex|graph|code|text|diagram",
      "content": "The actual content (LaTeX string, equation, code, etc.)",
      "referenceName": "equation 1" or "graph A" (optional),
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

Subject: ${session.subject}

Be canvas-aware and create appropriate visuals for the subject area.`;
  }

  private buildUserPrompt(question: string, context: any): string {
    let prompt = `Student question: ${question}\n\n`;

    if (context.conversationHistory && context.conversationHistory !== 'No previous conversation.') {
      prompt += `Previous conversation:\n${context.conversationHistory}\n\n`;
    }

    prompt += 'Generate your response as a JSON object following the specified format.';

    return prompt;
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

    for (let i = 0; i < objectRequests.length; i++) {
      const request = objectRequests[i];

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
}

export const mentorAgent = new MentorAgent();
