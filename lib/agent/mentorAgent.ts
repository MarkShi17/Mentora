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
    turnId: string
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
      const context = contextBuilder.buildContext(session, highlightedObjectIds);

      // Generate system prompt
      const systemPrompt = this.buildSystemPrompt(session, context, mode);

      // Generate user prompt
      const userPrompt = this.buildUserPrompt(question, context);

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
        turnId
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

  private buildSystemPrompt(session: Session, context: any, mode: TeachingMode): string {
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

    return `You are Mentora, an AI tutor working on an infinite canvas workspace.

CANVAS STATE:
${context.canvasState}

${context.highlightedObjects ? `STUDENT HIGHLIGHTED:\n${context.highlightedObjects}\n` : ''}

TEACHING STYLE (${mode} mode):
${teachingStyle}

VISUAL CREATION:
- Create visual objects to explain concepts (LaTeX equations, graphs, code blocks, diagrams, text notes)
- Reference existing canvas objects naturally in your explanation
- Position new objects spatially relative to existing ones
- Use directional language: "as shown in the equation above", "let's place this below"

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
        "fontSize": 16 (for text)
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
    turnId: string
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

      // Generate object
      const obj = objectGenerator.generateObject(
        {
          type: request.type,
          content: request.content,
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
