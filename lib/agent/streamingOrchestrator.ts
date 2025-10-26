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
    },
    userSettings?: {
      userName?: string;
      explanationLevel?: 'beginner' | 'intermediate' | 'advanced';
    },
    cachedIntroPlayed?: {
      text: string;
      id: string;
    } | null
  ): AsyncGenerator<StreamEvent, void, unknown> {
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('🎬 STREAMING ORCHESTRATOR STARTED');
    logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    logger.info('Session ID', { sessionId: session.id });
    logger.info('Question', { question });
    logger.info('Mode', { mode });
    logger.info('Turn ID', { turnId });
    logger.info('Existing canvas objects', { count: session.canvasObjects.length });

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

      // Generate system and user prompts with user settings
      const systemPrompt = this.buildSystemPrompt(session, sessionContext, mode, context, userSettings, cachedIntroPlayed);
      const userPrompt = this.buildUserPrompt(question, sessionContext);

      // Start Claude streaming
      logger.info('🧠 Calling Claude API', {
        model: 'claude-sonnet-4-5-20250929',
        maxTokens: 4096
      });

      const stream = await this.anthropic.messages.stream({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      });

      logger.info('✅ Claude stream started');

      let fullResponse = '';
      const sentenceParser = new SentenceParser();
      let totalObjects = 0;
      let totalReferences = 0;

      // Track parsing state for streaming format
      let currentObjectDef: any = null;
      let currentObjectMetadata: any = {};
      let accumulatedNarration = '';
      const processedObjects = new Set<string>();

      // Process Claude's streaming response with event-based parsing
      for await (const chunk of stream) {
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const textChunk = chunk.delta.text;
          fullResponse += textChunk;
          accumulatedNarration += textChunk;

          // Parse streaming markers in real-time
          const lines = accumulatedNarration.split('\n');
          accumulatedNarration = lines[lines.length - 1]; // Keep incomplete line

          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim();

            // Parse [NARRATION]: markers - stream text immediately
            if (line.startsWith('[NARRATION]:')) {
              const narrationText = line.substring('[NARRATION]:'.length).trim();

              if (narrationText) {
                logger.info('🗣️ Streaming narration', { text: narrationText.substring(0, 50) + '...' });

                // Extract complete sentences
                const sentences = sentenceParser.addChunk(narrationText + ' ');

                for (const sentence of sentences) {
                  // Send text chunk immediately
                  yield {
                    type: 'text_chunk',
                    timestamp: Date.now(),
                    data: {
                      text: sentence.text,
                      sentenceIndex: sentence.index
                    }
                  };

                  // Generate TTS asynchronously
                  try {
                    const audioResult = await ttsService.generateSentenceSpeech(
                      sentence.text,
                      voice,
                      sentence.index
                    );

                    if (audioResult && audioResult.audio) {
                      yield {
                        type: 'audio_chunk',
                        timestamp: Date.now(),
                        data: {
                          audio: audioResult.audio,
                          text: sentence.text,
                          sentenceIndex: sentence.index
                        }
                      };

                      logger.debug('Audio chunk generated', {
                        sentenceIndex: sentence.index,
                        textPreview: sentence.text.substring(0, 50)
                      });
                    }
                  } catch (error) {
                    logger.warn('TTS generation failed', { error, sentence: sentence.text });
                  }
                }
              }
            }

            // Parse [OBJECT_START]: markers - send placeholder immediately
            else if (line.includes('[OBJECT_START')) {
              const match = line.match(/\[OBJECT_START type="([^"]+)" id="([^"]+)"\]/);
              if (match) {
                const [, objType, objId] = match;

                // Send placeholder object immediately
                const placeholder = {
                  id: objId,
                  type: objType,
                  position: layoutEngine.calculatePosition(
                    { existingObjects: streamingContext.existingObjects.map(obj => ({
                      id: obj.id,
                      position: obj.position,
                      size: obj.size
                    }))},
                    { width: 400, height: 200 }
                  ),
                  size: { width: 400, height: 200 },
                  generationState: 'generating',
                  placeholder: true,
                  turnId,
                  metadata: {}
                };

                // Start tracking this object
                currentObjectDef = {
                  id: objId,
                  type: objType,
                  content: '',
                  metadata: {}
                };

                // Send placeholder event
                yield {
                  type: 'canvas_object',
                  timestamp: Date.now(),
                  data: {
                    object: placeholder,
                    placement: {
                      objectId: objId,
                      position: placeholder.position,
                      animateIn: 'fade',
                      timing: totalObjects * 200
                    }
                  }
                };

                logger.info('📦 Object placeholder sent', { type: objType, id: objId });
              }
            }

            // Parse [OBJECT_CONTENT]: markers
            else if (line.startsWith('[OBJECT_CONTENT]:') && currentObjectDef) {
              currentObjectDef.content = line.substring('[OBJECT_CONTENT]:'.length).trim();
            }

            // Parse [OBJECT_META]: markers
            else if (line.includes('[OBJECT_META') && currentObjectDef) {
              const match = line.match(/\[OBJECT_META ([^=]+)="([^"]*)"\]/);
              if (match) {
                const [, key, value] = match;
                currentObjectDef.metadata[key] = value;
              }
            }

            // Parse [OBJECT_END]: markers - generate complete object
            else if (line.includes('[OBJECT_END]') && currentObjectDef) {
              // Generate the complete object
              const canvasObject = objectGenerator.generateObject(
                {
                  type: currentObjectDef.type,
                  content: currentObjectDef.content,
                  referenceName: currentObjectDef.metadata.referenceName,
                  metadata: currentObjectDef.metadata
                },
                layoutEngine.calculatePosition(
                  { existingObjects: streamingContext.existingObjects.map(obj => ({
                    id: obj.id,
                    position: obj.position,
                    size: obj.size
                  }))},
                  { width: 400, height: 200 }
                ),
                turnId
              );

              // Override ID to match placeholder
              canvasObject.id = currentObjectDef.id;
              canvasObject.generationState = 'complete';

              // Add to existing objects
              streamingContext.existingObjects.push(canvasObject);

              // Send complete object (replaces placeholder)
              yield {
                type: 'canvas_object',
                timestamp: Date.now(),
                data: {
                  object: canvasObject,
                  placement: {
                    objectId: canvasObject.id,
                    position: canvasObject.position,
                    animateIn: 'none',
                    timing: 0
                  }
                }
              };

              totalObjects++;
              processedObjects.add(currentObjectDef.id);
              logger.info('✅ Object completed', { type: canvasObject.type, id: canvasObject.id });

              currentObjectDef = null;
            }

            // Parse [REFERENCE]: markers
            else if (line.includes('[REFERENCE')) {
              const match = line.match(/\[REFERENCE mention="([^"]+)" objectId="([^"]+)"\]/);
              if (match) {
                const [, mention, objectId] = match;

                yield {
                  type: 'reference',
                  timestamp: Date.now(),
                  data: {
                    mention,
                    objectId
                  }
                };

                totalReferences++;
                logger.debug('🔗 Reference streamed', { mention, objectId });
              }
            }
          }
        }
      }

      // Process any remaining narration in the buffer
      if (accumulatedNarration.trim()) {
        const line = accumulatedNarration.trim();
        if (line.startsWith('[NARRATION]:')) {
          const narrationText = line.substring('[NARRATION]:'.length).trim();
          if (narrationText) {
            const sentences = sentenceParser.addChunk(narrationText);
            for (const sentence of sentences) {
              yield {
                type: 'text_chunk',
                timestamp: Date.now(),
                data: {
                  text: sentence.text,
                  sentenceIndex: sentence.index
                }
              };
            }
          }
        }
      }

      // Send final sentences from the sentence parser
      const finalSentences = sentenceParser.flush();
      for (const sentence of finalSentences) {
        yield {
          type: 'text_chunk',
          timestamp: Date.now(),
          data: {
            text: sentence.text,
            sentenceIndex: sentence.index
          }
        };

        // Generate TTS for final sentences
        try {
          const audioResult = await ttsService.generateSentenceSpeech(
            sentence.text,
            voice,
            sentence.index
          );

          if (audioResult && audioResult.audio) {
            yield {
              type: 'audio_chunk',
              timestamp: Date.now(),
              data: {
                audio: audioResult.audio,
                text: sentence.text,
                sentenceIndex: sentence.index
              }
            };

            logger.debug('Audio chunk generated for final sentence', {
              sentenceIndex: sentence.index
            });
          }
        } catch (error) {
          logger.warn('TTS generation failed for final sentence', { error });
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
      logger.error('Streaming error:', error);
      yield {
        type: 'error',
        timestamp: Date.now(),
        data: {
          message: error instanceof Error ? error.message : 'Unknown error occurred'
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
    },
    userSettings?: {
      userName?: string;
      explanationLevel?: 'beginner' | 'intermediate' | 'advanced';
    },
    cachedIntroPlayed?: {
      text: string;
      id: string;
    } | null
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

Be canvas-aware and create appropriate visuals for the subject area.`;
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

      // Incomplete JSON - return empty narration (don't speak partial JSON)
      logger.debug('No complete JSON found yet', { textLength: responseText.length });
      return {
        explanation: '',
        narration: '',
        objects: [],
        references: []
      };
    } catch (error) {
      // Parse error - return empty narration (don't speak malformed JSON)
      logger.debug('JSON parse error (normal during streaming)', {
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
