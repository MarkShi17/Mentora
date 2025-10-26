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
import { MCP_TOOLS_FOR_CLAUDE } from './mcpTools';
import { Brain } from '@/types/brain';

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
   * Get tools appropriate for the selected brain
   */
  private getToolsForBrain(brain: Brain): typeof MCP_TOOLS_FOR_CLAUDE {
    if (!brain.mcpTools || brain.mcpTools.length === 0) {
      return MCP_TOOLS_FOR_CLAUDE; // Fallback to all tools for brains without specific tools
    }

    // Filter tools to only those appropriate for this brain
    return MCP_TOOLS_FOR_CLAUDE.filter(tool =>
      brain.mcpTools!.includes(tool.name)
    );
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
      const systemPrompt = this.buildSystemPrompt(session, sessionContext, mode, context, userSettings, selectedBrain);
      const userPrompt = this.buildUserPrompt(question, sessionContext);

      // Get model from selected brain
      const model = selectedBrain?.model || 'claude-sonnet-4-5-20250929';

      // NOTE: Tools parameter is commented out for now because:
      // 1. The streaming orchestrator doesn't handle tool_use blocks yet
      // 2. MCP servers need to be running to execute tool calls
      // 3. The brain's promptEnhancement is sufficient to guide JSON responses
      // TODO: Add tool execution handling to streaming orchestrator
      // const tools = selectedBrain ? this.getToolsForBrain(selectedBrain) : MCP_TOOLS_FOR_CLAUDE;

      // Start Claude streaming
      logger.info('🧠 Calling Claude API', {
        model,
        maxTokens: 4096,
        brainType: selectedBrain?.type || 'general',
        usingPromptEnhancement: !!selectedBrain?.promptEnhancement
      });

      const stream = await this.anthropic.messages.stream({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
        // tools parameter omitted - see note above
      });

      logger.info('✅ Claude stream started');

      let fullResponse = '';
      const sentenceParser = new SentenceParser();
      let totalObjects = 0;
      let totalReferences = 0;

      // Track parsing state for incremental JSON extraction
      let lastNarrationLength = 0;
      let lastObjectsCount = 0;
      const streamedObjects = new Set<number>();

      // Process Claude's streaming response with incremental JSON parsing
      let chunkCount = 0;
      for await (const chunk of stream) {
        chunkCount++;
        if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
          const textChunk = chunk.delta.text;
          fullResponse += textChunk;

          // DEBUG: Log first few chunks
          if (chunkCount <= 5) {
            logger.info(`📦 Chunk ${chunkCount}`, { text: textChunk.substring(0, 100) });
          }

          // Try to parse JSON incrementally
          try {
            const agentResponse = this.parseResponse(fullResponse);

            // NARRATION STREAMING: Extract new narration text
            if (agentResponse.narration && agentResponse.narration.length > lastNarrationLength) {
              const newNarration = agentResponse.narration.slice(lastNarrationLength);

              // SAFETY CHECK: Ensure it's clean narration, not JSON fragments
              const isCleanNarration = !newNarration.includes('{') &&
                                       !newNarration.includes('}') &&
                                       !newNarration.includes('"explanation"') &&
                                       !newNarration.includes('"objects"') &&
                                       !newNarration.includes('"narration"') &&
                                       !newNarration.includes('"references"');

              if (isCleanNarration && newNarration.trim().length > 0) {
                lastNarrationLength = agentResponse.narration.length;

                // Log what we're about to speak for debugging
                logger.info('🗣️ Speaking narration chunk', {
                  text: newNarration.substring(0, 100) + (newNarration.length > 100 ? '...' : '')
                });

                // Extract complete sentences from new narration
                const sentences = sentenceParser.addChunk(newNarration);

                // Generate TTS for each complete sentence
                for (const sentence of sentences) {
                  logger.debug('Complete narration sentence detected', {
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
              } else {
                logger.debug('Skipping non-narration text chunk', {
                  text: newNarration.substring(0, 100),
                  hasJSON: newNarration.includes('{') || newNarration.includes('}')
                });
              }
            }

            // CANVAS OBJECT STREAMING: Stream new objects one at a time
            if (agentResponse.objects && agentResponse.objects.length > lastObjectsCount) {
              const newObjects = agentResponse.objects.slice(lastObjectsCount);

              for (let i = 0; i < newObjects.length; i++) {
                const globalIndex = lastObjectsCount + i;

                // Skip if already streamed (safety check)
                if (streamedObjects.has(globalIndex)) continue;

                const request = newObjects[i];

                // Generate canvas object
                const existingCanvasObjects = streamingContext.existingObjects;
                const position = layoutEngine.calculatePosition(
                  {
                    existingObjects: existingCanvasObjects.map(obj => ({
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

                // Add to existing objects for next position calculation
                streamingContext.existingObjects.push(canvasObject);

                // Stream canvas object immediately
                const placement: ObjectPlacement = {
                  objectId: canvasObject.id,
                  position: canvasObject.position,
                  animateIn: 'fade',
                  timing: totalObjects * 300 // Stagger by 300ms
                };

                yield {
                  type: 'canvas_object',
                  timestamp: Date.now(),
                  data: {
                    object: canvasObject,
                    placement
                  }
                };

                streamedObjects.add(globalIndex);
                totalObjects++;

                logger.debug('Streamed canvas object', {
                  type: canvasObject.type,
                  index: globalIndex,
                  referenceName: request.referenceName
                });
              }

              lastObjectsCount = agentResponse.objects.length;
            }

            // REFERENCES: Stream references as they appear
            if (agentResponse.references && agentResponse.references.length > totalReferences) {
              const newReferences = agentResponse.references.slice(totalReferences);

              for (const ref of newReferences) {
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

          } catch (error) {
            // Incomplete JSON - continue accumulating
            // This is normal during streaming, only log at debug level
            logger.debug('Waiting for more JSON data', {
              bufferLength: fullResponse.length
            });
          }
        }
      }

      // Flush any remaining narration sentence
      const finalSentence = sentenceParser.flush();
      if (finalSentence) {
        logger.debug('Flushing final narration sentence', {
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

      // DEBUG: Log what Claude actually returned
      logger.info('📄 Full Claude response', {
        length: fullResponse.length,
        preview: fullResponse.substring(0, 500),
        hasJSON: fullResponse.includes('{') && fullResponse.includes('}')
      });

      // Final parse to catch any remaining objects/references
      const finalResponse = this.parseResponse(fullResponse);

      // Stream any remaining objects that weren't caught during streaming
      if (finalResponse.objects && finalResponse.objects.length > lastObjectsCount) {
        const remainingObjects = finalResponse.objects.slice(lastObjectsCount);

        for (let i = 0; i < remainingObjects.length; i++) {
          const globalIndex = lastObjectsCount + i;
          if (streamedObjects.has(globalIndex)) continue;

          const request = remainingObjects[i];
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

          yield {
            type: 'canvas_object',
            timestamp: Date.now(),
            data: {
              object: canvasObject,
              placement: {
                objectId: canvasObject.id,
                position: canvasObject.position,
                animateIn: 'fade',
                timing: totalObjects * 300
              }
            }
          };

          totalObjects++;
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
      logger.info('✅ STREAMING RESPONSE COMPLETED');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('Summary', {
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
    },
    userSettings?: {
      userName?: string;
      explanationLevel?: 'beginner' | 'intermediate' | 'advanced';
    },
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

    return `You are Mentora, an AI tutor working on an infinite canvas workspace. You are an always-on, contextually aware AI that continuously listens and builds understanding from all conversations.
${userName ? `\nSTUDENT NAME: ${userName} - Address them by name occasionally to personalize the interaction.\n` : ''}
EXPLANATION LEVEL: ${explanationLevel}
${levelGuidance}

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

Be canvas-aware and create appropriate visuals for the subject area.

${selectedBrain?.promptEnhancement ? `\n\nSPECIALIZED BRAIN INSTRUCTIONS:\n${selectedBrain.promptEnhancement}` : ''}`;
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
