#!/usr/bin/env node

/**
 * Mentora Backend Tester - End-to-End Streaming Test
 *
 * Tests the complete backend pipeline:
 * - Brain selection (which specialized brain + model is chosen)
 * - Real-time text generation streaming
 * - Canvas component creation
 * - Audio synthesis
 */

const readline = require('readline');

// Example test questions (commented out for reference)
/*
const testQuestions = [
  // Math questions
  { question: 'What is the derivative of x^2?', expected: 'math' },
  { question: 'Explain the Pythagorean theorem', expected: 'math' },
  { question: 'Create a sin(x) plot from 0 to 2π', expected: 'math' },
  { question: 'How do you solve quadratic equations?', expected: 'math' },

  // Biology questions
  { question: 'Explain cell division', expected: 'biology' },
  { question: 'What is photosynthesis?', expected: 'biology' },
  { question: 'How does DNA replication work?', expected: 'biology' },
  { question: 'Describe the human circulatory system', expected: 'biology' },

  // Code questions
  { question: 'How do you implement a binary search?', expected: 'code' },
  { question: 'Explain object-oriented programming', expected: 'code' },
  { question: 'What is recursion?', expected: 'code' },
  { question: 'How do you debug JavaScript code?', expected: 'code' },

  // Design questions
  { question: 'What are the principles of good UI design?', expected: 'design' },
  { question: 'Explain color theory', expected: 'design' },
  { question: 'How do you create a responsive layout?', expected: 'design' },
  { question: 'What is typography?', expected: 'design' },

  // General questions
  { question: 'What is the capital of France?', expected: 'general' },
  { question: 'Explain the water cycle', expected: 'general' },
  { question: 'How does the stock market work?', expected: 'general' },
  { question: 'What is artificial intelligence?', expected: 'general' }
];
*/

// Color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
};

function formatBrain(brain) {
  const brainColors = {
    math: colors.blue,
    biology: colors.green,
    code: colors.yellow,
    design: colors.magenta,
    general: colors.cyan,
  };
  const color = brainColors[brain] || colors.white;
  return `${color}${colors.bright}${brain.toUpperCase()}${colors.reset}`;
}

async function testQuestionStreaming(question) {
  console.log(`\n${colors.bright}📝 Question:${colors.reset} "${question}"\n`);

  let textBuffer = '';
  let componentCount = 0;

  try {
    // Make streaming API call
    const response = await fetch('http://localhost:3000/api/qa-stream', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        question: question,
        sessionId: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        mode: 'guided'
      })
    });

    if (!response.ok) {
      console.log(`${colors.red}❌ API Error: ${response.status}${colors.reset}`);
      return;
    }

    // Parse SSE stream
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;

        const data = line.slice(6); // Remove 'data: ' prefix
        if (data === '[DONE]') {
          console.log(`\n${colors.green}✅ Stream complete${colors.reset}`);
          continue;
        }

        try {
          const event = JSON.parse(data);

          switch (event.type) {
            case 'brain_selected':
              console.log(`${colors.bright}🧠 Brain Selected:${colors.reset} ${formatBrain(event.data.brain)}`);
              console.log(`${colors.dim}   Model: ${event.data.model}${colors.reset}`);
              console.log(`${colors.dim}   Confidence: ${(event.data.confidence * 100).toFixed(1)}%${colors.reset}`);
              console.log(`${colors.dim}   Reasoning: ${event.data.reasoning}${colors.reset}\n`);
              break;

            case 'text_chunk':
              // Buffer text and print complete sentences
              textBuffer += event.data.text;
              // Print when we have complete sentences (ending with . ! ? or newline)
              if (event.data.text.match(/[.!?\n]/)) {
                process.stdout.write(textBuffer);
                textBuffer = '';
              }
              break;

            case 'canvas_object':
              componentCount++;
              const obj = event.data.object;
              console.log(`\n${colors.cyan}📦 Component #${componentCount}:${colors.reset} ${colors.bright}${obj.type.toUpperCase()}${colors.reset}`);
              console.log(`${colors.dim}   ID: ${obj.id}${colors.reset}`);
              console.log(`${colors.dim}   Label: ${obj.metadata?.referenceName || 'N/A'}${colors.reset}`);
              console.log(`${colors.dim}   Position: (${obj.position.x}, ${obj.position.y})${colors.reset}`);
              console.log(`${colors.dim}   Size: ${obj.size.width}x${obj.size.height}${colors.reset}`);

              // Show content preview
              if (obj.data.content) {
                const preview = obj.data.content.substring(0, 100);
                console.log(`${colors.dim}   Content: ${preview}${obj.data.content.length > 100 ? '...' : ''}${colors.reset}`);
              }
              console.log('');
              break;

            case 'audio_chunk':
              // Show that audio is being generated
              process.stdout.write(`${colors.yellow}🔊${colors.reset}`);
              break;

            case 'reference':
              console.log(`${colors.magenta}🔗 Reference:${colors.reset} ${event.data.mention} → ${event.data.objectId}`);
              break;

            case 'complete':
              // Flush any remaining text
              if (textBuffer) {
                process.stdout.write(textBuffer);
                textBuffer = '';
              }
              console.log(`\n\n${colors.green}${colors.bright}Summary:${colors.reset}`);
              console.log(`${colors.dim}  Components created: ${componentCount}${colors.reset}`);
              break;

            case 'error':
              console.log(`\n${colors.red}❌ Error: ${event.data.message}${colors.reset}`);
              break;
          }
        } catch (parseError) {
          // Ignore parse errors for incomplete JSON
        }
      }
    }

  } catch (error) {
    console.log(`\n${colors.red}❌ Error: ${error.message}${colors.reset}`);
  }
}

async function interactiveMode() {
  console.log(`${colors.bright}${colors.cyan}🔧 Mentora Backend Tester - End-to-End Streaming${colors.reset}\n`);
  console.log('Type a question and press Enter to see:');
  console.log('  • Which brain gets selected (+ model name)');
  console.log('  • Real-time narration as it\'s generated');
  console.log('  • Each canvas component as it\'s created');
  console.log('  • Audio generation progress\n');
  console.log('Type "exit" or "quit" to stop.\n');
  console.log(`${colors.dim}Example questions:${colors.reset}`);
  console.log(`${colors.dim}  - What is the derivative of x^2? (Math brain → Haiku)${colors.reset}`);
  console.log(`${colors.dim}  - Explain photosynthesis (Biology brain → Haiku)${colors.reset}`);
  console.log(`${colors.dim}  - How do you implement a binary search? (Code brain → Haiku)${colors.reset}`);
  console.log(`${colors.dim}  - What are design patterns? (General brain → Sonnet)${colors.reset}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: `${colors.bright}🤔 Your question: ${colors.reset}`
  });

  rl.prompt();

  rl.on('line', async (line) => {
    const input = line.trim();

    if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
      console.log(`\n${colors.cyan}👋 Goodbye!${colors.reset}`);
      rl.close();
      process.exit(0);
    }

    if (input.length === 0) {
      rl.prompt();
      return;
    }

    await testQuestionStreaming(input);
    console.log(`\n${'─'.repeat(80)}\n`);
    rl.prompt();
  });

  rl.on('close', () => {
    console.log(`\n${colors.cyan}👋 Goodbye!${colors.reset}`);
    process.exit(0);
  });
}

// Run interactive mode
interactiveMode().catch(console.error);