import { Session } from '@/types/session';
import { CanvasObject, TextObject, DiagramObject, CodeObject } from '@/types/canvas';
import { generateObjectId } from '@/lib/utils/ids';

/**
 * Creates a pre-loaded demo session showcasing Mentora's architecture,
 * tech stack, features, and use cases for hackathon demos.
 */
export function createDemoSession(): Session {
  const sessionId = 'demo_session';
  const now = Date.now();
  const turnId = 'demo_turn';

  // Create canvas objects for the demo
  const canvasObjects: CanvasObject[] = [];

  // CLUSTER 1: Architecture & Tech Stack (Left side)

  // 1. Title
  canvasObjects.push(createTextObject(
    'Mentora - AI-Powered Tutoring Platform',
    50, 50, 600, 80, 24, turnId, 'Main Title'
  ));

  // 2. Architecture Diagram
  canvasObjects.push(createDiagramObject(
    'Full-Stack Architecture Diagram',
    50, 150, 600, 450, turnId, 'Architecture Diagram'
  ));

  // 3. Tech Stack
  canvasObjects.push(createTextObject(
    `Tech Stack:
• Frontend: React 18 + Next.js 14 + D3.js
• Backend: Next.js API Routes + TypeScript
• AI/LLM: Claude Sonnet 4.5 (Anthropic)
• Voice: OpenAI Whisper + TTS-1
• Canvas: Infinite workspace with D3.js
• Storage: In-memory (hackathon-ready)
• Deployment: Docker + Docker Compose`,
    50, 650, 600, 280, 14, turnId, 'Tech Stack'
  ));

  // CLUSTER 2: Features & How It Works (Center)

  // 4. Key Features
  canvasObjects.push(createTextObject(
    `Key Features:
• Voice-Interactive Learning
  - Real-time speech-to-text (Whisper)
  - Natural TTS responses

• Specialized AI Brains
  - Math: LaTeX equations, graphs
  - Biology: Diagrams, pathways
  - Code: Syntax highlighting, algorithms
  - Design: Visual concepts

• Infinite Canvas Workspace
  - Create & arrange objects spatially
  - LaTeX, graphs, code, diagrams, text
  - Drag, zoom, pan interactions

• MCP Tool Integration
  - Python for biology diagrams
  - Mermaid for flowcharts
  - Extensible architecture`,
    700, 50, 650, 500, 14, turnId, 'Key Features'
  ));

  // 5. How It Works Flowchart
  canvasObjects.push(createDiagramObject(
    'User Flow: Voice → AI → Canvas Objects',
    700, 600, 650, 330, turnId, 'How It Works'
  ));

  // CLUSTER 3: Use Cases & Demo (Right side)

  // 6. Use Cases
  canvasObjects.push(createTextObject(
    `Use Cases:

Math Tutoring
"Explain the quadratic formula"
- LaTeX equation + interactive graph

Biology Learning
"Show me cellular respiration"
- Pathway diagram + annotations

Code Education
"How does recursion work?"
- Code examples + tree visualization

Design Concepts
"Explain design patterns"
- Visual diagrams + examples`,
    1400, 50, 550, 450, 14, turnId, 'Use Cases'
  ));

  // 7. Teaching Modes
  canvasObjects.push(createTextObject(
    `Teaching Modes:

Socratic Mode (Guided)
• Asks guiding questions
• Breaks concepts into steps
• Checks understanding
• Perfect for deep learning

Direct Mode
• Clear explanations
• Step-by-step solutions
• Quick reference
• Perfect for quick answers`,
    1400, 550, 550, 280, 14, turnId, 'Teaching Modes'
  ));

  // 8. Sample API Code
  canvasObjects.push(createCodeObject(
    `// Create a teaching session
const response = await fetch('/api/sessions', {
  method: 'POST',
  body: JSON.stringify({
    subject: 'math',
    title: 'Algebra Session'
  })
});

// Ask a question
await fetch('/api/qa', {
  method: 'POST',
  body: JSON.stringify({
    sessionId: session.id,
    question: "Explain derivatives",
    mode: "socratic"
  })
});`,
    1400, 880, 550, 320, turnId, 'API Example'
  ));

  // 9. Demo Instructions
  canvasObjects.push(createTextObject(
    `Try It Now!

1. Click "New Session" to start
2. Choose a subject (Math/Bio/Code/Design)
3. Ask a question via text or voice
4. Watch AI create visual objects on canvas
5. Interact with objects (drag, zoom, pan)
6. Ask follow-up questions

The AI references existing canvas objects
and maintains spatial awareness!`,
    50, 980, 600, 280, 14, turnId, 'Demo Instructions'
  ));

  // Create the demo session
  const demoSession: Session = {
    id: sessionId,
    title: 'Mentora Demo - Hackathon Showcase',
    subject: 'design', // Using 'design' subject for the demo
    createdAt: now,
    updatedAt: now,
    turns: [
      {
        id: turnId,
        role: 'assistant',
        content: 'Welcome to Mentora! This demo showcases our AI-powered tutoring platform. Explore the canvas to see our architecture, features, and use cases. Click around to learn more!',
        timestamp: now,
        objectsCreated: canvasObjects.map(obj => obj.id),
        brainType: 'general',
        brainConfidence: 1.0,
      }
    ],
    canvasObjects,
  };

  return demoSession;
}

// Helper functions to create canvas objects

function createTextObject(
  content: string,
  x: number,
  y: number,
  width: number,
  height: number,
  fontSize: number,
  turnId: string,
  label: string
): TextObject {
  return {
    id: generateObjectId(),
    type: 'text',
    position: { x, y },
    size: { width, height },
    zIndex: 1,
    label,
    data: {
      type: 'text',
      content,
      fontSize,
    },
    metadata: {
      createdAt: Date.now(),
      turnId,
      referenceName: label,
      tags: ['demo', 'text'],
    },
  };
}

function createDiagramObject(
  description: string,
  x: number,
  y: number,
  width: number,
  height: number,
  turnId: string,
  label: string
): DiagramObject {
  // Generate appropriate SVG based on description
  let svg: string;

  if (description.includes('Architecture')) {
    svg = generateArchitectureSVG(width, height);
  } else if (description.includes('Flow')) {
    svg = generateFlowSVG(width, height);
  } else {
    svg = generateGenericDiagramSVG(width, height);
  }

  return {
    id: generateObjectId(),
    type: 'diagram',
    position: { x, y },
    size: { width, height },
    zIndex: 1,
    label,
    data: {
      type: 'diagram',
      svg,
      description,
    },
    metadata: {
      createdAt: Date.now(),
      turnId,
      referenceName: label,
      tags: ['demo', 'diagram'],
    },
  };
}

function createCodeObject(
  code: string,
  x: number,
  y: number,
  width: number,
  height: number,
  turnId: string,
  label: string
): CodeObject {
  return {
    id: generateObjectId(),
    type: 'code',
    position: { x, y },
    size: { width, height },
    zIndex: 1,
    label,
    data: {
      type: 'code',
      code,
      language: 'typescript',
    },
    metadata: {
      createdAt: Date.now(),
      turnId,
      referenceName: label,
      tags: ['demo', 'code', 'typescript'],
    },
  };
}

// SVG Generators for Demo Diagrams

function generateArchitectureSVG(width: number, height: number): string {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad1" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1e40af;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="grad2" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#10b981;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#059669;stop-opacity:1" />
        </linearGradient>
        <linearGradient id="grad3" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" style="stop-color:#f59e0b;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#d97706;stop-opacity:1" />
        </linearGradient>
        <marker id="arrowhead" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="#64748b" />
        </marker>
      </defs>

      <rect width="${width}" height="${height}" fill="#f8fafc" rx="8"/>

      <!-- Frontend Layer -->
      <rect x="50" y="30" width="500" height="100" rx="8" fill="url(#grad1)" stroke="#1e40af" stroke-width="3"/>
      <text x="300" y="65" text-anchor="middle" font-size="20" font-weight="bold" fill="white">Frontend</text>
      <text x="300" y="90" text-anchor="middle" font-size="14" fill="#e0f2fe">React + Next.js + D3.js</text>
      <text x="300" y="110" text-anchor="middle" font-size="12" fill="#bae6fd">Port 3001 | Infinite Canvas</text>

      <!-- Backend Layer -->
      <rect x="50" y="170" width="500" height="100" rx="8" fill="url(#grad2)" stroke="#059669" stroke-width="3"/>
      <text x="300" y="205" text-anchor="middle" font-size="20" font-weight="bold" fill="white">Backend API</text>
      <text x="300" y="230" text-anchor="middle" font-size="14" fill="#d1fae5">Next.js API Routes + TypeScript</text>
      <text x="300" y="250" text-anchor="middle" font-size="12" fill="#a7f3d0">Port 3000 | RESTful Endpoints</text>

      <!-- AI Layer -->
      <rect x="50" y="310" width="500" height="100" rx="8" fill="url(#grad3)" stroke="#d97706" stroke-width="3"/>
      <text x="300" y="345" text-anchor="middle" font-size="20" font-weight="bold" fill="white">AI Engine</text>
      <text x="300" y="370" text-anchor="middle" font-size="14" fill="#fef3c7">Claude Sonnet 4.5 + OpenAI</text>
      <text x="300" y="390" text-anchor="middle" font-size="12" fill="#fde68a">Teaching Agent | Voice | MCP Tools</text>

      <!-- Arrows -->
      <line x1="300" y1="130" x2="300" y2="170" stroke="#64748b" stroke-width="3" marker-end="url(#arrowhead)"/>
      <line x1="300" y1="270" x2="300" y2="310" stroke="#64748b" stroke-width="3" marker-end="url(#arrowhead)"/>

      <!-- Labels -->
      <text x="310" y="150" font-size="12" fill="#64748b">HTTP Requests</text>
      <text x="310" y="290" font-size="12" fill="#64748b">AI Queries</text>
    </svg>
  `.trim();
}

function generateFlowSVG(width: number, height: number): string {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <marker id="arrow" markerWidth="10" markerHeight="10" refX="9" refY="3" orient="auto">
          <polygon points="0 0, 10 3, 0 6" fill="#3b82f6" />
        </marker>
      </defs>

      <rect width="${width}" height="${height}" fill="#f8fafc" rx="8"/>

      <!-- Step 1: Voice Input -->
      <ellipse cx="120" cy="80" rx="100" ry="50" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
      <text x="120" y="75" text-anchor="middle" font-size="14" font-weight="bold" fill="white">Voice/Text</text>
      <text x="120" y="95" text-anchor="middle" font-size="11" fill="#e0f2fe">Student Input</text>

      <!-- Step 2: AI Processing -->
      <rect x="280" y="40" width="120" height="80" rx="8" fill="#10b981" stroke="#059669" stroke-width="2"/>
      <text x="340" y="70" text-anchor="middle" font-size="14" font-weight="bold" fill="white">AI Brain</text>
      <text x="340" y="90" text-anchor="middle" font-size="11" fill="#d1fae5">Process</text>
      <text x="340" y="105" text-anchor="middle" font-size="11" fill="#d1fae5">& Teach</text>

      <!-- Step 3: Canvas Objects -->
      <ellipse cx="530" cy="80" rx="100" ry="50" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
      <text x="530" y="75" text-anchor="middle" font-size="14" font-weight="bold" fill="white">Canvas</text>
      <text x="530" y="95" text-anchor="middle" font-size="11" fill="#fef3c7">Visual Objects</text>

      <!-- Step 4: Voice Response -->
      <rect x="230" y="200" width="200" height="80" rx="8" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
      <text x="330" y="230" text-anchor="middle" font-size="14" font-weight="bold" fill="white">TTS Response</text>
      <text x="330" y="250" text-anchor="middle" font-size="11" fill="#fee2e2">Natural Speech</text>
      <text x="330" y="265" text-anchor="middle" font-size="11" fill="#fee2e2">+ Spatial References</text>

      <!-- Arrows -->
      <line x1="220" y1="80" x2="280" y2="80" stroke="#3b82f6" stroke-width="3" marker-end="url(#arrow)"/>
      <line x1="400" y1="80" x2="430" y2="80" stroke="#3b82f6" stroke-width="3" marker-end="url(#arrow)"/>
      <line x1="530" y1="130" x2="430" y2="200" stroke="#3b82f6" stroke-width="3" marker-end="url(#arrow)"/>
      <line x1="230" y1="240" x2="120" y2="130" stroke="#3b82f6" stroke-width="3" marker-end="url(#arrow)" stroke-dasharray="5,5"/>

      <!-- Labels -->
      <text x="245" y="70" font-size="10" fill="#64748b">Question</text>
      <text x="410" y="70" font-size="10" fill="#64748b">Create</text>
      <text x="470" y="170" font-size="10" fill="#64748b">Generate</text>
      <text x="140" y="180" font-size="10" fill="#64748b">Feedback Loop</text>
    </svg>
  `.trim();
}

function generateGenericDiagramSVG(width: number, height: number): string {
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" fill="#f8fafc" rx="8"/>
      <text x="${width/2}" y="${height/2}" text-anchor="middle" font-size="16" fill="#64748b">Diagram Placeholder</text>
    </svg>
  `.trim();
}
