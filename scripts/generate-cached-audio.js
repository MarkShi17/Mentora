#!/usr/bin/env node

/**
 * Generate Cached Audio Clips
 *
 * Pre-generates audio for common intro phrases to reduce initial response latency
 */

const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Try to load dotenv if available, but don't fail if it's not
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not available, expecting env vars to be set externally
  console.log('Note: dotenv not found, using existing environment variables');
}

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Import intro phrases (we'll define them here since we can't import TS in JS)
// NOTE: All phrases have trailing space for proper text concatenation
const INTRO_PHRASES = {
  greeting: [
    "Hello! I'd be happy to help you with that. ",
    "Hi there! Let me assist you with this. ",
    "Great to hear from you! I can help with that. "
  ],
  explanation: [
    "Let me explain that for you. ",
    "I'll walk you through this step by step. ",
    "Sure, let me break this down for you. ",
    "I can definitely explain how this works. ",
    "Great question! Let me clarify that. "
  ],
  calculation: [
    "Let me work through this calculation. ",
    "I'll solve this step by step. ",
    "Let's calculate this together. ",
    "I can help you with this math problem. "
  ],
  concept: [
    "That's an interesting concept to explore. ",
    "Let me help you understand this concept. ",
    "This is a fundamental idea worth understanding. ",
    "I'll explain this concept clearly. "
  ],
  definition: [
    "Let me define that for you. ",
    "I'll explain what this means. ",
    "Here's what that term refers to. ",
    "Let me clarify this definition. "
  ],
  problem_solving: [
    "I'll help you work through this problem. ",
    "Let's solve this together. ",
    "I can guide you through the solution. ",
    "Let me show you how to approach this. "
  ],
  general: [
    "I can definitely help with that! ",
    "That's a great question! ",
    "Let me assist you with this. ",
    "I'm here to help! ",
    "Sure, I can help you understand that. "
  ]
};

// Voice to use for generation
const VOICE = process.env.TTS_VOICE || 'nova';

/**
 * Generate audio for a single phrase
 */
async function generateAudio(text, voice = VOICE) {
  try {
    console.log(`  Generating: "${text.substring(0, 40)}..."`);

    const response = await openai.audio.speech.create({
      model: 'tts-1', // Use fast model for intros
      voice,
      input: text,
      response_format: 'mp3',
    });

    const buffer = Buffer.from(await response.arrayBuffer());
    const base64Audio = buffer.toString('base64');

    // Estimate duration (rough approximation: ~150 words per minute)
    const words = text.split(/\s+/).length;
    const estimatedDuration = Math.round((words / 150) * 60 * 1000);

    return {
      audio: base64Audio,
      duration: estimatedDuration
    };
  } catch (error) {
    console.error(`  ❌ Failed to generate audio for: "${text}"`, error.message);
    return null;
  }
}

/**
 * Generate all cached audio clips
 */
async function generateAllCachedAudio() {
  console.log('🎙️ Generating Cached Audio Clips');
  console.log('================================\n');

  const cachedIntros = [];
  let totalGenerated = 0;
  let totalFailed = 0;

  // Generate audio for each category and phrase
  for (const [category, phrases] of Object.entries(INTRO_PHRASES)) {
    console.log(`📁 Category: ${category}`);

    for (let i = 0; i < phrases.length; i++) {
      const phrase = phrases[i];
      const id = `${category}_${i + 1}`;

      const audioData = await generateAudio(phrase, VOICE);

      if (audioData) {
        cachedIntros.push({
          id,
          category,
          text: phrase,
          audio: audioData.audio,
          voice: VOICE,
          duration: audioData.duration
        });
        totalGenerated++;
        console.log(`  ✅ Generated: ${id}`);
      } else {
        totalFailed++;
        console.log(`  ❌ Failed: ${id}`);
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log('');
  }

  // Save to JSON file
  const outputPath = path.join(__dirname, '..', 'lib', 'voice', 'cached-audio-data.json');
  fs.writeFileSync(outputPath, JSON.stringify(cachedIntros, null, 2));

  console.log('================================');
  console.log(`✅ Generation Complete!`);
  console.log(`   Generated: ${totalGenerated} clips`);
  console.log(`   Failed: ${totalFailed} clips`);
  console.log(`   Saved to: ${outputPath}`);
  console.log(`   Total size: ${(JSON.stringify(cachedIntros).length / 1024 / 1024).toFixed(2)} MB`);
}

/**
 * Test cached audio generation with a smaller set
 */
async function generateTestSet() {
  console.log('🧪 Generating Test Set (5 clips)');
  console.log('================================\n');

  const testPhrases = [
    { category: 'general', text: "I can definitely help with that! " },
    { category: 'explanation', text: "Let me explain that for you. " },
    { category: 'calculation', text: "Let me work through this calculation. " },
    { category: 'concept', text: "Let me help you understand this concept. " },
    { category: 'problem_solving', text: "I'll help you work through this problem. " }
  ];

  const cachedIntros = [];

  for (let i = 0; i < testPhrases.length; i++) {
    const { category, text } = testPhrases[i];
    const id = `test_${i + 1}`;

    console.log(`Generating test clip ${i + 1}/${testPhrases.length}`);
    const audioData = await generateAudio(text, VOICE);

    if (audioData) {
      cachedIntros.push({
        id,
        category,
        text,
        audio: audioData.audio,
        voice: VOICE,
        duration: audioData.duration
      });
      console.log(`✅ Generated: ${text.substring(0, 30)}...`);
    }

    await new Promise(resolve => setTimeout(resolve, 500));
  }

  const outputPath = path.join(__dirname, '..', 'lib', 'voice', 'cached-audio-test.json');
  fs.writeFileSync(outputPath, JSON.stringify(cachedIntros, null, 2));

  console.log('\n================================');
  console.log(`✅ Test set generated!`);
  console.log(`   Saved to: ${outputPath}`);
}

// Main execution
async function main() {
  const args = process.argv.slice(2);

  if (!process.env.OPENAI_API_KEY) {
    console.error('❌ Error: OPENAI_API_KEY environment variable is required');
    process.exit(1);
  }

  if (args.includes('--test')) {
    // Generate smaller test set
    await generateTestSet();
  } else {
    // Generate full set
    await generateAllCachedAudio();
  }
}

main().catch(console.error);