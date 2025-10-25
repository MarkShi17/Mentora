#!/usr/bin/env node

/**
 * Brain Selection Tester
 * 
 * Tests which brain is selected for different types of questions
 */

const { brainSelector } = require('../lib/agent/brainSelector');
const { getAllBrains } = require('../lib/agent/brainRegistry');

// Test questions for different brain types
const testQuestions = [
  // Math questions
  {
    category: 'Math',
    questions: [
      'What is the derivative of x^2?',
      'Explain the Pythagorean theorem',
      'Create a sin(x) plot from 0 to 2π',
      'How do you solve quadratic equations?',
      'What is the integral of 1/x?',
      'Explain calculus concepts',
      'Graph the function y = x^3 - 3x + 1',
      'What is the limit as x approaches infinity of 1/x?'
    ]
  },
  
  // Biology questions
  {
    category: 'Biology',
    questions: [
      'Explain cell division',
      'What is photosynthesis?',
      'How does DNA replication work?',
      'Describe the human circulatory system',
      'What are the stages of mitosis?',
      'Explain protein synthesis',
      'How do enzymes work?',
      'What is the structure of a cell membrane?'
    ]
  },
  
  // Code questions
  {
    category: 'Code',
    questions: [
      'How do you implement a binary search?',
      'Explain object-oriented programming',
      'What is recursion?',
      'How do you debug JavaScript code?',
      'Explain the difference between arrays and linked lists',
      'What is a hash table?',
      'How do you optimize database queries?',
      'Explain the MVC pattern'
    ]
  },
  
  // Design questions
  {
    category: 'Design',
    questions: [
      'What are the principles of good UI design?',
      'Explain color theory',
      'How do you create a responsive layout?',
      'What is typography?',
      'Explain the difference between UX and UI',
      'How do you design for accessibility?',
      'What are design systems?',
      'Explain visual hierarchy'
    ]
  },
  
  // General questions
  {
    category: 'General',
    questions: [
      'What is the capital of France?',
      'Explain the water cycle',
      'How does the stock market work?',
      'What is climate change?',
      'Explain the scientific method',
      'What is artificial intelligence?',
      'How do you write a good essay?',
      'What is the history of the internet?'
    ]
  }
];

async function testBrainSelection() {
  console.log('🧠 Brain Selection Tester\n');
  console.log('Available brains:');
  const brains = getAllBrains();
  brains.forEach(brain => {
    console.log(`  - ${brain.name} (${brain.type}): ${brain.description}`);
  });
  console.log('\n' + '='.repeat(80) + '\n');

  let totalTests = 0;
  let correctPredictions = 0;
  const results = {};

  for (const category of testQuestions) {
    console.log(`\n📚 Testing ${category.category} Questions:`);
    console.log('-'.repeat(50));
    
    results[category.category] = {
      total: category.questions.length,
      correct: 0,
      predictions: []
    };

    for (const question of category.questions) {
      try {
        const result = await brainSelector.selectBrain(question);
        const selectedBrain = result.selectedBrain;
        const confidence = result.confidence;
        const reasoning = result.reasoning;

        // Determine if prediction is correct
        const expectedBrain = category.category.toLowerCase();
        const isCorrect = selectedBrain.type === expectedBrain;
        
        if (isCorrect) {
          correctPredictions++;
          results[category.category].correct++;
        }

        results[category.category].predictions.push({
          question,
          selected: selectedBrain.type,
          expected: expectedBrain,
          correct: isCorrect,
          confidence,
          reasoning: reasoning.substring(0, 100) + '...'
        });

        const status = isCorrect ? '✅' : '❌';
        console.log(`${status} "${question}"`);
        console.log(`   → Selected: ${selectedBrain.name} (${selectedBrain.type})`);
        console.log(`   → Expected: ${expectedBrain}`);
        console.log(`   → Confidence: ${(confidence * 100).toFixed(1)}%`);
        console.log(`   → Reasoning: ${reasoning.substring(0, 80)}...`);
        console.log('');

        totalTests++;

        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.error(`❌ Error testing question: "${question}"`);
        console.error(`   Error: ${error.message}`);
        console.log('');
      }
    }
  }

  // Summary
  console.log('\n' + '='.repeat(80));
  console.log('📊 SUMMARY');
  console.log('='.repeat(80));
  
  const overallAccuracy = (correctPredictions / totalTests * 100).toFixed(1);
  console.log(`\nOverall Accuracy: ${correctPredictions}/${totalTests} (${overallAccuracy}%)`);
  
  console.log('\nPer-Category Results:');
  for (const [category, result] of Object.entries(results)) {
    const accuracy = (result.correct / result.total * 100).toFixed(1);
    console.log(`  ${category}: ${result.correct}/${result.total} (${accuracy}%)`);
  }

  // Show incorrect predictions
  console.log('\n❌ Incorrect Predictions:');
  let hasIncorrect = false;
  for (const [category, result] of Object.entries(results)) {
    const incorrect = result.predictions.filter(p => !p.correct);
    if (incorrect.length > 0) {
      hasIncorrect = true;
      console.log(`\n${category}:`);
      incorrect.forEach(pred => {
        console.log(`  - "${pred.question}"`);
        console.log(`    Expected: ${pred.expected}, Got: ${pred.selected}`);
      });
    }
  }
  
  if (!hasIncorrect) {
    console.log('  None! 🎉');
  }

  console.log('\n✨ Brain selection testing complete!');
}

// Run the test
if (require.main === module) {
  testBrainSelection().catch(console.error);
}

module.exports = { testBrainSelection };
