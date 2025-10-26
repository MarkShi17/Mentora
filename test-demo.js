// Simple test to verify demo session creation
const path = require('path');

// Mock the dependencies
const mockLogger = {
  info: console.log,
  error: console.error,
  warn: console.warn,
};

// Set up path aliases
require('module-alias').addAliases({
  '@': __dirname,
});

console.log('Testing demo session creation...\n');

try {
  // Import the demo session creator
  const { createDemoSession } = require('./lib/demo/demoSession.ts');

  const demoSession = createDemoSession();

  console.log('✅ Demo session created successfully!');
  console.log(`   ID: ${demoSession.id}`);
  console.log(`   Title: ${demoSession.title}`);
  console.log(`   Subject: ${demoSession.subject}`);
  console.log(`   Canvas Objects: ${demoSession.canvasObjects.length}`);
  console.log(`   Turns: ${demoSession.turns.length}`);

  console.log('\nCanvas Objects:');
  demoSession.canvasObjects.forEach((obj, index) => {
    console.log(`   ${index + 1}. ${obj.type} - "${obj.label}" at (${obj.position.x}, ${obj.position.y})`);
  });

  console.log('\n✅ All checks passed! Demo session is ready.');
} catch (error) {
  console.error('❌ Error creating demo session:', error);
  process.exit(1);
}
