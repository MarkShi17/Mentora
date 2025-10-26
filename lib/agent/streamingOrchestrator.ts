/**
 * Streaming Orchestrator
 *
 * Coordinates Claude streaming responses with real-time TTS generation.
 * Ensures OpenAI TTS speaks Claude's contextually-aware narration as it's generated.
 */

import Anthropic from '@anthropic-ai/sdk';
import { Session } from '@/types/session';
import { CanvasObject, ObjectPlacement, ObjectReference } from '@/types/canvas';
import { TeachingMode, StreamEvent, VoiceOption } from '@/types/api';
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
  voice: VoiceOption;
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
    voice: VoiceOption = 'alloy',
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

      // Build context from session (now async due to RAG)
      const sessionContext = await contextBuilder.buildContext(session, highlightedObjectIds);

      // Generate system and user prompts with user settings (include RAG context)
      const systemPrompt = this.buildSystemPrompt(session, sessionContext, mode, context, userSettings, cachedIntroPlayed, selectedBrain);
      const userPrompt = this.buildUserPrompt(question, sessionContext, userSettings);

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
      let preToolComponents: any[] = []; // Components from initial response before tool execution
      const maxIterations = 5; // Prevent infinite tool use loops
      let iteration = 0;

      // Multi-turn conversation loop for MCP tool use
      while (iteration < maxIterations) {
        iteration++;

        logger.info('🔁 Loop iteration started', {
          iteration,
          maxIterations,
          messagesCount: messages.length,
          messagesStructure: messages.map((m, idx) => ({
            index: idx,
            role: m.role,
            hasContent: !!m.content
          }))
        });

        logger.info('🧠 Calling Claude API', {
          model: 'claude-sonnet-4-5-20250929',
          maxTokens: 4096,
          iteration,
          hasTools: availableTools.length > 0,
          messagesCount: messages.length,
          messagesStructure: messages.map((m, idx) => ({
            index: idx,
            role: m.role,
            contentBlocks: Array.isArray(m.content) ? m.content.length : 1,
            contentTypes: Array.isArray(m.content) ? m.content.map((c: any) => c.type) : [typeof m.content],
            toolUseIds: Array.isArray(m.content) ? m.content.filter((c: any) => c.type === 'tool_use').map((c: any) => c.id) : []
          }))
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

          // STREAM NARRATION IMMEDIATELY BEFORE EXECUTING TOOLS
          // This allows user to hear response while tools execute
          // Also extract components to stream after tools complete
          if (textBlocks.length > 0) {
            const narrationText = textBlocks.map((block: any) => block.text).join('\n');

            // Store for later use
            if (!finalResponseText) {
              finalResponseText = narrationText;
            }

            logger.info('🎤 Streaming narration BEFORE tool execution', {
              narrationLength: narrationText.length,
              toolCount: toolUses.length
            });

            // Parse and stream the narration immediately
            // Also extract components to stream after tools
            const agentResponse = this.parseResponse(narrationText);

            // Store components for after tool execution
            if (agentResponse.objects && agentResponse.objects.length > 0) {
              preToolComponents = agentResponse.objects;
              logger.info('📦 Found components in pre-tool response', {
                componentCount: preToolComponents.length,
                types: preToolComponents.map(c => c.type),
                brainType: selectedBrain?.type,
                narrationTextLength: narrationText.length,
                narrationPreview: narrationText.substring(0, 300)
              });
            } else {
              logger.warn('⚠️ No objects found in pre-tool response', {
                brainType: selectedBrain?.type,
                hasNarrationText: narrationText.length > 0,
                narrationTextLength: narrationText.length,
                hasMarkers: narrationText.includes('[OBJECT_START'),
                narrationPreview: narrationText.substring(0, 300)
              });
            }

            if (agentResponse.narration && agentResponse.narration.trim().length > 0) {
              const sentenceParser = new SentenceParser();
              const sentences = sentenceParser.addChunk(agentResponse.narration);

              // OPTIMIZATION: Skip pre-tool TTS to make objects arrive faster
              // Stream text chunks immediately without waiting for TTS
              logger.info('⚡ Streaming text without TTS for faster object rendering', {
                sentenceCount: sentences.length
              });

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

              // Flush final sentence
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
              }

              // TTS will be generated later with final narration to avoid duplication
            }

            logger.info('✅ Narration streamed, now executing tools');
          }

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

              // Emit tool_start event with visual placeholder
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
                  toolUse.input as Record<string, any>,
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
                content: [
                  {
                    type: 'text',
                    text: resultText || 'Tool executed successfully'
                  }
                ]
              } as Anthropic.ToolResultBlockParam);

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

          // Add assistant's message with FULL response content (per Anthropic API spec)
          // Must include both text and tool_use blocks from Claude's response
          try {
            logger.info('📨 Adding messages to conversation array before iteration 2', {
              iteration,
              currentMessagesCount: messages.length,
              responseContentBlocks: response.content.length,
              toolResultsCount: toolResultsContent.length
            });

            messages.push({
              role: 'assistant',
              content: response.content  // Contains FULL response (text + tool_use blocks)
            });

            logger.info('✅ Added assistant message', {
              messagesCount: messages.length,
              lastMessageRole: messages[messages.length - 1].role
            });

            // Add user message with tool results (per Anthropic API spec)
            messages.push({
              role: 'user',
              content: toolResultsContent  // Contains tool_result blocks
            });

            logger.info('✅ Added user message with tool results', {
              messagesCount: messages.length,
              lastMessageRole: messages[messages.length - 1].role,
              toolResultsContentCount: toolResultsContent.length
            });

            logger.info('🔄 About to continue to iteration 2', {
              currentIteration: iteration,
              nextIteration: iteration + 1,
              maxIterations,
              willContinue: iteration < maxIterations
            });

            // Continue conversation loop to get final response
            continue;
          } catch (error) {
            logger.error('❌ ERROR adding messages or continuing loop', {
              error: error instanceof Error ? error.message : String(error),
              stack: error instanceof Error ? error.stack : undefined,
              iteration
            });
            throw error;
          }
        }

        // Claude finished without using tools or after using tools
        logger.info('📋 Processing final response from Claude', {
          iteration,
          contentBlocks: response.content.length,
          blockTypes: response.content.map((b: any) => b.type),
          hasTextBlocks: response.content.some((b: any) => b.type === 'text')
        });

        const textContent = response.content
          .filter(block => block.type === 'text')
          .map((block: any) => block.text)
          .join('\n');

        logger.info('📝 Extracted text content', {
          textLength: textContent.length,
          textPreview: textContent.substring(0, 200)
        });

        finalResponseText = textContent;
        break;
      }

      logger.info('✅ MCP tool loop completed', {
        iterations: iteration,
        toolObjectsCreated: toolGeneratedObjects.length,
        hasFinalResponse: !!finalResponseText
      });

      // Create canvas objects from pre-tool components (markdown notes, etc.)
      if (preToolComponents.length > 0) {
        logger.info('🎨 Creating canvas objects from pre-tool components', {
          componentCount: preToolComponents.length,
          types: preToolComponents.map(c => c.type)
        });

        for (const request of preToolComponents) {
          try {
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
              timing: toolGeneratedObjects.length * 300
            };

            yield {
              type: 'canvas_object',
              timestamp: Date.now(),
              data: { object: canvasObject, placement }
            };

            logger.info('✅ Pre-tool component created as canvas object', {
              type: canvasObject.type,
              label: canvasObject.label
            });
          } catch (error) {
            // Skip empty text objects or other generation errors
            logger.warn('⚠️ Skipping object due to generation error', {
              type: request.type,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            continue;
          }
        }
      }

      // Now stream the final response with TTS
      const sentenceParser = new SentenceParser();
      let totalObjects = toolGeneratedObjects.length + preToolComponents.length; // Include pre-tool objects
      let totalReferences = 0;

      // Parse the final response to get narration and additional objects
      logger.info('🔍 About to parse final response text', {
        textLength: finalResponseText.length,
        textPreview: finalResponseText.substring(0, 300)
      });

      const agentResponse = this.parseResponse(finalResponseText);

      logger.info('📊 Parsed agent response', {
        narrationLength: agentResponse.narration.length,
        objectsCount: agentResponse.objects.length,
        objectTypes: agentResponse.objects.map(o => o.type),
        referencesCount: agentResponse.references.length,
        brainType: selectedBrain?.type,
        hasMarkerFormat: finalResponseText.includes('[OBJECT_START'),
        hasNarrationMarker: finalResponseText.includes('[NARRATION]')
      });

      // CRITICAL WARNING for Math brain
      if (selectedBrain?.type === 'math' && agentResponse.objects.length < 2) {
        logger.warn('⚠️ MATH BRAIN VIOLATION: Insufficient objects generated', {
          objectsGenerated: agentResponse.objects.length,
          minimumRequired: 2,
          toolsUsed: toolGeneratedObjects.length,
          responsePreview: finalResponseText.substring(0, 500)
        });
      }

      // Separate objects into priority (latex, graph, text/markdown) and regular for early rendering
      // For Code Brain: include 'code' and 'image'/'diagram' in priority, and enforce specific order
      const isCodeBrain = selectedBrain?.type === 'code';

      let priorityObjects, regularObjects;

      if (isCodeBrain) {
        // Code Brain: priority includes code, image, diagram, text
        // Order: code → image/diagram → text
        priorityObjects = agentResponse.objects.filter(obj =>
          obj.type === 'code' || obj.type === 'image' || obj.type === 'diagram' || obj.type === 'text'
        );
        regularObjects = agentResponse.objects.filter(obj =>
          obj.type !== 'code' && obj.type !== 'image' && obj.type !== 'diagram' && obj.type !== 'text'
        );

        // Reorder priority objects for Code Brain: code → image/diagram → text
        const codeObjects = priorityObjects.filter(o => o.type === 'code');
        const imageObjects = priorityObjects.filter(o => o.type === 'image' || o.type === 'diagram');
        const textObjects = priorityObjects.filter(o => o.type === 'text');
        priorityObjects = [...codeObjects, ...imageObjects, ...textObjects];

        logger.info('🧠 Code Brain: Reordered objects', {
          order: 'code → image/diagram → text',
          codeCount: codeObjects.length,
          imageCount: imageObjects.length,
          textCount: textObjects.length
        });
      } else {
        // Other brains: original priority logic
        priorityObjects = agentResponse.objects.filter(obj =>
          obj.type === 'latex' || obj.type === 'graph' || obj.type === 'text'
        );
        regularObjects = agentResponse.objects.filter(obj =>
          obj.type !== 'latex' && obj.type !== 'graph' && obj.type !== 'text'
        );
      }

      // OPTIMIZATION: Pre-calculate all priority objects before yielding
      // This batches layout calculations and allows rapid-fire yielding
      if (priorityObjects.length > 0) {
        logger.info('🎯 Pre-calculating priority objects for batch emission', {
          priorityObjectCount: priorityObjects.length,
          types: priorityObjects.map(obj => obj.type)
        });

        const preparedObjects: Array<{ canvasObject: CanvasObject; placement: ObjectPlacement }> = [];

        // Pre-calculate all positions and generate all objects first
        for (const request of priorityObjects) {
          try {
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
              timing: totalObjects * 50  // Reduced from 300ms to 50ms for rapid succession
            };

            preparedObjects.push({ canvasObject, placement });
            totalObjects++;
          } catch (error) {
            // Skip empty text objects or other generation errors
            logger.warn('⚠️ Skipping priority object due to generation error', {
              type: request.type,
              error: error instanceof Error ? error.message : 'Unknown error'
            });
            continue;
          }
        }

        // Now yield all prepared objects in rapid succession (no blocking operations)
        logger.info('⚡ Yielding all priority objects in rapid succession', {
          objectCount: preparedObjects.length
        });

        for (const { canvasObject, placement } of preparedObjects) {
          yield {
            type: 'canvas_object',
            timestamp: Date.now(),
            data: { object: canvasObject, placement }
          };
        }

        logger.info('✅ All priority objects yielded', {
          objectCount: preparedObjects.length
        });
      }

      // Stream narration sentence-by-sentence with TTS
      if (agentResponse.narration && agentResponse.narration.trim().length > 0) {
        logger.info('🗣️ Streaming narration with TTS', {
          narrationLength: agentResponse.narration.length
        });

        // Split narration into sentences
        const sentences = sentenceParser.addChunk(agentResponse.narration);
        const finalSentence = sentenceParser.flush();
        if (finalSentence) {
          sentences.push(finalSentence);
        }

        // OPTIMIZATION: Generate TTS in parallel batches of 3 sentences
        const BATCH_SIZE = 3;
        logger.info('⚡ Generating TTS in parallel batches', {
          totalSentences: sentences.length,
          batchSize: BATCH_SIZE
        });

        for (let i = 0; i < sentences.length; i += BATCH_SIZE) {
          const batch = sentences.slice(i, i + BATCH_SIZE);

          // First, yield all text chunks immediately (non-blocking)
          for (const sentence of batch) {
            yield {
              type: 'text_chunk',
              timestamp: Date.now(),
              data: {
                text: sentence.text,
                sentenceIndex: sentence.index
              }
            };
          }

          // Then generate TTS for all sentences in batch in parallel
          try {
            const audioPromises = batch.map(sentence =>
              ttsService.generateSentenceSpeech(sentence.text, voice, sentence.index)
                .catch(error => {
                  logger.warn('TTS generation failed for sentence', {
                    sentenceIndex: sentence.index,
                    error: error instanceof Error ? error.message : 'Unknown'
                  });
                  return null;
                })
            );

            const audioResults = await Promise.all(audioPromises);

            // Yield audio chunks for successfully generated TTS
            for (const audioResult of audioResults) {
              if (audioResult) {
                yield {
                  type: 'audio_chunk',
                  timestamp: Date.now(),
                  data: audioResult
                };
              }
            }
          } catch (error) {
            logger.warn('Batch TTS generation failed', { error });
          }
        }
      }

      // Generate additional canvas objects from Claude's response (if any)
      // Priority objects (latex, text, graph) are already rendered above
      // For regular objects: render code objects always, but skip diagrams if visualization tools were used
      if (agentResponse.objects && agentResponse.objects.length > 0 && regularObjects.length > 0) {
        logger.info('Processing regular canvas objects from Claude response', {
          totalObjectCount: agentResponse.objects.length,
          regularObjectCount: regularObjects.length,
          toolsUsed: toolGeneratedObjects.length > 0
        });

        for (const request of regularObjects) {
          // Skip diagrams if visualization tools were used (to avoid spurious/redundant diagrams)
          // But always render code objects even when tools were used
          if (request.type === 'diagram' && toolGeneratedObjects.length > 0) {
            logger.info('Skipping diagram object (visualization tool already used)', {
              type: request.type
            });
            continue;
          }

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

      // Auto-ingest to ChromaDB if RAG is enabled
      if (process.env.ENABLE_RAG === 'true' && process.env.RAG_AUTO_INGEST !== 'false') {
        try {
          const { safeAutoIngest } = await import('@/lib/rag/safeRagService');

          // Get all new objects created in this turn
          const newObjects = streamingContext.existingObjects.filter(
            obj => obj.metadata?.turnId === turnId
          );

          logger.info('🔄 Auto-ingesting to ChromaDB', {
            objectCount: newObjects.length,
            turnId,
            sessionId: session.id
          });

          // Ingest in background (don't block streaming)
          await safeAutoIngest(
            session.id,
            turnId,
            newObjects,
            question,
            finalResponseText,
            session.subject || 'general'
          );

          logger.info('✅ ChromaDB ingestion complete', { turnId });
        } catch (error) {
          logger.warn('RAG module not available or ingestion failed', { error });
        }
      }

      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('✅ STREAMING COMPLETE');
      logger.info('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      logger.info('Total sentences:', sentenceParser.getSentenceCount());
      logger.info('Total objects:', totalObjects);
      logger.info('Total references:', totalReferences);
    } catch (error) {
  let event;

  if (error instanceof Error && error.name === 'AbortError') {
    logger.info('Stream cancelled by client', { turnId });
    event = {
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
    event = {
      type: 'error',
      timestamp: Date.now(),
      data: {
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    };
  }
}
finally {
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
        : `Provide concise direct explanations:
- Start with brief 3-4 sentence summaries (5 sentence MAX)
- Create visualizations to supplement brevity
- Save detailed explanations for follow-up questions
- Be clear but encourage further exploration`;

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

${context.highlightedObjects ? `STUDENT HIGHLIGHTED:\n${context.highlightedObjects}\n` : ''}${context.ragContext ? `${context.ragContext}\n` : ''}${contextualInfo}

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
- Keep initial explanations brief (3-4 sentences, 5 MAX) - let visuals do the teaching
- Save comprehensive details for follow-up questions
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

Example (Math):
[NARRATION]: Let me help you understand quadratic equations.
[NARRATION]: A quadratic equation has the general form where the highest power is 2.
[OBJECT_START type="latex" id="eq_1"]
[OBJECT_CONTENT]:
ax^2 + bx + c = 0
[OBJECT_META referenceName="general form"]
[OBJECT_END]
[NARRATION]: As you can see in the general form above, we have three coefficients.

Example (Code):
[NARRATION]: Here's how to implement binary search in Python.
[OBJECT_START type="code" id="code_1"]
[OBJECT_CONTENT]:
def binary_search(arr, target):
    left, right = 0, len(arr) - 1
    while left <= right:
        mid = (left + right) // 2
        if arr[mid] == target:
            return mid
        elif arr[mid] < target:
            left = mid + 1
        else:
            right = mid - 1
    return -1
[OBJECT_META language="python"]
[OBJECT_END]
[NARRATION]: This efficiently finds elements in sorted arrays.

IMPORTANT:
- Start with [NARRATION] immediately - don't wait to plan objects
- Stream text naturally and define objects inline as they become relevant
- Keep narration conversational and natural
- Objects can be defined while you continue explaining

CRITICAL STREAMING PATTERN FOR TOOL USE:
- When you want to use tools (like sequential_thinking), ALWAYS generate [NARRATION] text FIRST
- Your response should be: [NARRATION] text + tool_use blocks
- NOT: tool_use only without narration first
- This ensures the user hears your explanation immediately while tools execute in the background
- Example: Start with [NARRATION], explain the concept, THEN use sequential_thinking to deepen analysis

${selectedBrain?.type === 'math' ? `
⚠️ CRITICAL FOR MATH BRAIN - COMPONENT REQUIREMENT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

**WHEN USING render_animation TOOL:**
You MUST include BOTH:
1. [NARRATION] text (as usual)
2. [OBJECT_START] markers for 2+ LaTeX objects (REQUIRED - DO NOT SKIP)
3. render_animation tool call

Example structure:
[NARRATION]: The derivative measures instantaneous rate of change.
[OBJECT_START type="latex" id="eq_1"]
[OBJECT_CONTENT]: f'(x) = \\lim_{h \\to 0} \\frac{f(x+h) - f(x)}{h}
[OBJECT_META referenceName="derivative definition"]
[OBJECT_END]
[NARRATION]: For f(x)=x², we apply the definition.
[OBJECT_START type="latex" id="eq_2"]
[OBJECT_CONTENT]: f(x) = x^2, \\quad f'(x) = 2x
[OBJECT_META referenceName="example"]
[OBJECT_END]
[NARRATION]: The animation shows how the slope changes. Can you see why?
(ALSO call render_animation tool)

**VALIDATION - YOU MUST HAVE ALL THREE:**
✓ [NARRATION] sections with text
✓ 2+ [OBJECT_START]...[OBJECT_END] blocks with LaTeX
✓ render_animation tool call
= TOTAL: 3+ components ✓

**COMMON MISTAKE TO AVOID:**
❌ WRONG: [NARRATION] + render_animation ONLY (missing LaTeX markers!)
✅ CORRECT: [NARRATION] + [OBJECT_START]×2+ + render_animation

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

Subject: ${session.subject}

${selectedBrain && selectedBrain.promptEnhancement ? `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPECIALIZED BRAIN INSTRUCTIONS (${selectedBrain.name.toUpperCase()}):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${selectedBrain.promptEnhancement}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
` : ''}

Be canvas-aware and create appropriate visuals for the subject area.`;
  }

  private buildUserPrompt(
    question: string,
    context: any,
    userSettings?: {
      userName?: string;
      explanationLevel?: 'beginner' | 'intermediate' | 'advanced';
    }
  ): string {
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

    // Extract objects (using [\s\S] to match any character including newlines for multiline code)
    const objects = [];
    // Updated regex: capture metadata from INSIDE [OBJECT_META ...], not after it
    const objectMatches = responseText.matchAll(/\[OBJECT_START\s+type="(\w+)"\s+id="([^"]+)"\].*?\[OBJECT_CONTENT\]:\s*([^\[]*?)(?:\[OBJECT_META\s+([^\]]+)\])?\s*\[OBJECT_END\]/gs);
    for (const match of objectMatches) {
      const [_, type, id, content, meta] = match;
      if (type && content) {
        const obj: any = {
          type,
          content: content.trim()
        };

        // Parse metadata if present (can have multiple key="value" pairs)
        if (meta) {
          const metaMatches = meta.matchAll(/(\w+)="([^"]+)"/g);
          const metadataObj: Record<string, string> = {};
          let hasReferenceName = false;

          for (const metaMatch of metaMatches) {
            const key = metaMatch[1];
            const value = metaMatch[2];

            // referenceName goes directly on obj, everything else goes in metadata
            if (key === 'referenceName') {
              obj.referenceName = value;
              hasReferenceName = true;
            } else {
              metadataObj[key] = value;
            }
          }

          // Only add metadata object if there's something in it
          if (Object.keys(metadataObj).length > 0) {
            obj.metadata = metadataObj;
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
    toolInput: Record<string, any>,
    existingObjects: CanvasObject[],
    currentToolResults: CanvasObject[],
    turnId: string
  ): CanvasObject[] {
    const objects: CanvasObject[] = [];

    if (!mcpResult.content || !Array.isArray(mcpResult.content)) {
      logger.warn('MCP result has no content array', { toolName });
      return objects;
    }

    // Generate meaningful label from tool name and parameters
    const generateLabel = (): string => {
      switch (toolName) {
        case 'render_biology_diagram':
          const diagramType = toolInput.diagram_type || '';
          const title = toolInput.title || '';
          if (title) return title;
          // Convert diagram_type to readable label: "crispr_mechanism" -> "CRISPR Mechanism"
          return diagramType
            .split('_')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');

        case 'generate':
          return toolInput.title || 'Pathway Diagram';

        case 'visualize_molecule':
          const pdbId = toolInput.pdb_id || '';
          return pdbId ? `${pdbId.toUpperCase()} Structure` : 'Molecular Structure';

        case 'render_animation':
          return toolInput.title || 'Math Animation';

        case 'execute_python':
          return toolInput.title || 'Data Visualization';

        default:
          return 'Visualization';
      }
    };

    const label = generateLabel();

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
      // Require minimum 100 bytes to filter out blank/empty images (typical blank PNG is 40-80 bytes)
      if (content.type === 'image' && content.data && content.data.trim().length > 100 && content.mimeType) {
        // Use dimensions from MCP response if available (Python MCP sends actual pixel dimensions)
        // Add padding to account for component chrome (header ~50px + padding 32px)
        const HEADER_HEIGHT = 50;
        const PADDING = 32;
        const imageWidth = (content.width || 1600) + PADDING;
        const imageHeight = (content.height || 1200) + HEADER_HEIGHT + PADDING;

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
          label,
          data: {
            type: 'image',
            url: `data:${content.mimeType};base64,${content.data}`,
            alt: label,
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
          // Add padding to account for component chrome (header ~50px + padding 32px)
          const HEADER_HEIGHT = 50;
          const PADDING = 32; // 16px on each side

          let resourceWidth: number;
          let resourceHeight: number;

          if (isImage) {
            // For images from content (Python MCP sends actual dimensions)
            // Add padding to the actual content dimensions
            resourceWidth = (content.width || 1600) + PADDING;
            resourceHeight = (content.height || 1200) + HEADER_HEIGHT + PADDING;
          } else {
            // Videos (Manim): Default 1280×720 + padding
            resourceWidth = 1280 + PADDING;
            resourceHeight = 720 + HEADER_HEIGHT + PADDING;
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
              label,
              data: {
                type: 'video',
                url,
                alt: label,
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
                usedBase64: !!resource.text,  // Track if we used base64
              },
            };
            objects.push(videoObject);
          } else {
            const imageObject: CanvasObject = {
              id: `obj_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`,
              type: 'image',
              label,
              data: {
                type: 'image',
                url,
                alt: label,
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

export const streamingOrchestrator = new StreamingOrchestrator();
