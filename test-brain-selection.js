#!/usr/bin/env node

/**
 * Brain Selection Tester
 * 
 * Simple script to test which brain is selected for different questions
 */

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

async function testBrainSelection() {
  console.log('🧠 Brain Selection Tester\n');
  console.log('Testing brain selection for different question types...\n');

  let correct = 0;
  let total = testQuestions.length;

  for (const test of testQuestions) {
    try {
      console.log(`Testing: "${test.question}"`);
      console.log(`Expected brain: ${test.expected}`);
      
      // Make API call to test brain selection
      const response = await fetch('http://localhost:3000/api/qa', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          question: test.question,
          sessionId: `test_${Date.now()}_${Math.random().toString(36).substring(7)}`,
          mode: 'guided'
        })
      });

      if (!response.ok) {
        console.log(`❌ API Error: ${response.status}`);
        console.log('');
        continue;
      }

      const data = await response.json();
      
      // Check if we got a response
      if (data.canvasObjects && data.canvasObjects.length >= 0) {
        console.log(`✅ API call successful - ${data.canvasObjects.length} canvas objects created`);
        correct++;
      } else {
        console.log(`⚠️  API call successful but no canvas objects`);
      }

      console.log('');

      // Small delay to avoid overwhelming the server
      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
      console.log('');
    }
  }

  const accuracy = (correct / total * 100).toFixed(1);
  console.log(`📊 Results: ${correct}/${total} API calls successful (${accuracy}%)`);
  console.log('\n✨ Brain selection testing complete!');
  console.log('\nTo see which brains were selected, check the backend logs:');
  console.log('docker logs mentora-backend --tail 100 | grep "Brain selected"');
}

// Run the test
testBrainSelection().catch(console.error);