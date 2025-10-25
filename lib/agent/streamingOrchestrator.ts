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

  constructor() {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is required');
    }
    this.anthropic = new Anthropic({ apiKey });
  }

  /**
   * Stream a teaching response with real-time TTS
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
    }
  ): AsyncGenerator<StreamEvent, void, unknown> {
    logger.info('Starting streaming response', {
      sessionId: session.id,
      mode,
      turnId
    });

    const streamingContext: StreamingContext = {
      sessionId: session.id,
      turnId,
      voice,
      existingObjects: session.canvasObjects,
      userQuestion: question
    };

    try {
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

      // Build context from session
      const sessionContext = contextBuilder.buildContext(session, highlightedObjectIds);

      // Generate system and user prompts
      const systemPrompt = this.buildSystemPrompt(session, sessionContext, mode, context);
      const userPrompt = this.buildUserPrompt(question, sessionContext);

      // Start Claude streaming
      const stream = await this.anthropic.messages.stream({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      let fullResponse = '';
      const sentenceParser = new SentenceParser();
      let totalObjects = 0;
      let totalReferences = 0;

      // Process Claude's streaming response
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const textChunk = chunk.delta.text;
          fullResponse += textChunk;

          // Extract complete sentences
          const sentences = sentenceParser.addChunk(textChunk);

          // Generate TTS for each complete sentence
          for (const sentence of sentences) {
            logger.debug('Complete sentence detected', {
              sentenceIndex: sentence.index,
              text: sentence.text
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

            // Generate TTS asynchronously and stream audio
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
              logger.warn('TTS generation failed for sentence, continuing', {
                sentenceIndex: sentence.index,
                error: error instanceof Error ? error.message : 'Unknown'
              });
              // Continue without audio for this sentence
            }
          }
        }
      }

      // Flush any remaining sentence
      const finalSentence = sentenceParser.flush();
      if (finalSentence) {
        logger.debug('Flushing final sentence', {
          sentenceIndex: finalSentence.index,
          text: finalSentence.text
        });

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

      // Parse full response for canvas objects and references
      const agentResponse = this.parseResponse(fullResponse);

      // Generate and stream canvas objects
      const canvasObjects = this.generateCanvasObjects(
        agentResponse.objects,
        streamingContext.existingObjects,
        turnId,
        question
      );

      for (const obj of canvasObjects) {
        const placement: ObjectPlacement = {
          objectId: obj.id,
          position: obj.position,
          animateIn: 'fade',
          timing: totalObjects * 500
        };

        yield {
          type: 'canvas_object',
          timestamp: Date.now(),
          data: {
            object: obj,
            placement
          }
        };

        totalObjects++;
      }

      // Stream references
      const references = this.generateReferences(
        agentResponse.references,
        streamingContext.existingObjects,
        canvasObjects
      );

      for (const ref of references) {
        yield {
          type: 'reference',
          timestamp: Date.now(),
          data: ref
        };

        totalReferences++;
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

      logger.info('Streaming response completed', {
        totalSentences: sentenceParser.getSentenceCount(),
        totalObjects,
        totalReferences
      });
    } catch (error) {
      logger.error('Streaming response failed', { error });

      yield {
        type: 'error',
        timestamp: Date.now(),
        data: {
          message: error instanceof Error ? error.message : 'Unknown error occurred',
          code: 'STREAMING_ERROR'
        }
      };
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
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          explanation: parsed.explanation || responseText,
          narration: parsed.narration || parsed.explanation || responseText,
          objects: parsed.objects || [],
          references: parsed.references || []
        };
      }

      return {
        explanation: responseText,
        narration: responseText,
        objects: [],
        references: []
      };
    } catch (error) {
      logger.warn('Failed to parse JSON response', { error });
      return {
        explanation: responseText,
        narration: responseText,
        objects: [],
        references: []
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

      const position = layoutEngine.calculatePosition(
        {
          existingObjects: [...existingObjects, ...objects].map(obj => ({
            id: obj.id,
            position: obj.position,
            size: obj.size
          }))
        },
        { width: 400, height: 200 }
      );

      let enhancedContent = request.content;
      if (request.type === 'diagram') {
        enhancedContent = `${request.content} - Context: ${userQuestion}`;
      }

      const obj = objectGenerator.generateObject(
        {
          type: request.type,
          content: enhancedContent,
          referenceName: request.referenceName,
          metadata: request.metadata
        },
        position,
        turnId
      );

      objects.push(obj);
    }

    return objects;
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
}

export const streamingOrchestrator = new StreamingOrchestrator();
