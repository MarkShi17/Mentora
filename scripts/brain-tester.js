#!/usr/bin/env node

/**
 * Brain Selection Backend Tester
 * 
 * Directly tests the brain selector without making API calls
 */

const path = require('path');

// Add the project root to the module path
process.env.NODE_PATH = path.join(__dirname, '..');
require('module')._initPaths();

async function testBrainSelection() {
  console.log('🧠 Brain Selection Backend Tester\n');

  try {
    // Import the brain selector and registry
    const { brainSelector } = require('../lib/agent/brainSelector');
    const { getAllBrains } = require('../lib/agent/brainRegistry');

    console.log('Available brains:');
    const brains = getAllBrains();
    brains.forEach(brain => {
      console.log(`  - ${brain.name} (${brain.type}): ${brain.description}`);
    });
    console.log('');

    // Test questions
    const testCases = [
      { question: 'What is the derivative of x^2?', expected: 'math' },
      { question: 'Explain the Pythagorean theorem', expected: 'math' },
      { question: 'Create a sin(x) plot', expected: 'math' },
      { question: 'Explain cell division', expected: 'biology' },
      { question: 'What is photosynthesis?', expected: 'biology' },
      { question: 'How do you implement binary search?', expected: 'code' },
      { question: 'Explain object-oriented programming', expected: 'code' },
      { question: 'What are UI design principles?', expected: 'design' },
      { question: 'Explain color theory', expected: 'design' },
      { question: 'What is the capital of France?', expected: 'general' },
      { question: 'Explain the water cycle', expected: 'general' }
    ];

    let correct = 0;
    let total = testCases.length;

    console.log('Testing brain selection:\n');

    for (const testCase of testCases) {
      try {
        const result = await brainSelector.selectBrain(testCase.question);
        const selectedBrain = result.selectedBrain;
        const isCorrect = selectedBrain.type === testCase.expected;

        if (isCorrect) {
          correct++;
          console.log(`✅ "${testCase.question}"`);
        } else {
          console.log(`❌ "${testCase.question}"`);
        }

        console.log(`   → Selected: ${selectedBrain.name} (${selectedBrain.type})`);
        console.log(`   → Expected: ${testCase.expected}`);
        console.log(`   → Confidence: ${(result.confidence * 100).toFixed(1)}%`);
        console.log(`   → Reasoning: ${result.reasoning.substring(0, 80)}...`);
        console.log('');

        // Small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(`❌ "${testCase.question}" - Error: ${error.message}`);
        console.log('');
      }
    }

    const accuracy = (correct / total * 100).toFixed(1);
    console.log(`📊 Results: ${correct}/${total} correct (${accuracy}%)`);

    if (accuracy >= 80) {
      console.log('🎉 Brain selection is working well!');
    } else if (accuracy >= 60) {
      console.log('⚠️  Brain selection needs improvement');
    } else {
      console.log('🚨 Brain selection needs significant improvement');
    }

  } catch (error) {
    console.error('❌ Failed to run brain selection test:', error.message);
    console.error('Make sure the backend is running and dependencies are installed');
  }
}

// Run the test
testBrainSelection().catch(console.error);
