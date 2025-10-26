import {
  CanvasObject,
  LatexObject,
  GraphObject,
  CodeObject,
  TextObject,
  DiagramObject,
  Position,
} from '@/types/canvas';
import { generateObjectId } from '@/lib/utils/ids';
import { ObjectGenerationRequest } from './types';

export class ObjectGenerator {
  generateLatexObject(
    latex: string,
    position: Position,
    turnId: string,
    referenceName?: string
  ): LatexObject {
    const encodedLatex = encodeURIComponent(latex);
    const rendered = `https://latex.codecogs.com/png.latex?\\dpi{150}\\bg_white ${encodedLatex}`;

    return {
      id: generateObjectId(),
      type: 'latex',
      position,
      size: { width: 400, height: 100 },
      zIndex: 1,
      data: {
        type: 'latex',
        latex,
        rendered,
      },
      metadata: {
        createdAt: Date.now(),
        turnId,
        referenceName,
        tags: ['math', 'equation'],
      },
    };
  }

  generateGraphObject(
    equation: string,
    position: Position,
    turnId: string,
    referenceName?: string
  ): GraphObject {
    const { svg, dataPoints } = this.generateSimpleGraph(equation);

    return {
      id: generateObjectId(),
      type: 'graph',
      position,
      size: { width: 500, height: 400 },
      zIndex: 1,
      data: {
        type: 'graph',
        equation,
        svg,
        dataPoints,
      },
      metadata: {
        createdAt: Date.now(),
        turnId,
        referenceName,
        tags: ['graph', 'visualization'],
      },
    };
  }

  generateCodeObject(
    code: string,
    language: string,
    position: Position,
    turnId: string,
    referenceName?: string
  ): CodeObject {
    // Calculate generous dimensions to show all code without scrolling
    const lines = code.split('\n').length;
    const maxLineLength = Math.max(...code.split('\n').map(line => line.length));

    let width, height;
    if (code.length > 1000) {
      // Very long code - make it very wide and tall
      width = Math.max(maxLineLength * 9, 900);
      height = Math.max(lines * 22 + 80, 500);
    } else if (code.length > 500) {
      // Long code
      width = Math.max(maxLineLength * 9, 750);
      height = Math.max(lines * 20 + 70, 350);
    } else {
      // Medium/short code
      width = Math.max(maxLineLength * 8, 600);
      height = Math.max(lines * 20 + 60, 200);
    }

    return {
      id: generateObjectId(),
      type: 'code',
      position,
      size: { width, height },
      zIndex: 1,
      data: {
        type: 'code',
        code,
        language,
      },
      metadata: {
        createdAt: Date.now(),
        turnId,
        referenceName,
        tags: ['code', language],
      },
    };
  }

  generateTextObject(
    content: string,
    position: Position,
    turnId: string,
    fontSize: number = 16,
    referenceName?: string
  ): TextObject {
    // Calculate generous dimensions to minimize scrolling
    const avgCharsPerLine = 80; // Wide text boxes for better readability
    const lines = Math.ceil(content.length / avgCharsPerLine);

    // Very generous sizing - prioritize showing all content without scrolling
    let estimatedWidth, estimatedHeight;
    if (content.length > 1000) {
      // Very long text - make it wide and tall
      estimatedWidth = 900;
      estimatedHeight = Math.max(lines * 30 + 120, 600);
    } else if (content.length > 500) {
      // Long text
      estimatedWidth = 800;
      estimatedHeight = Math.max(lines * 28 + 100, 400);
    } else if (content.length > 200) {
      // Medium text
      estimatedWidth = 600;
      estimatedHeight = Math.max(lines * 26 + 80, 250);
    } else {
      // Short text
      estimatedWidth = 450;
      estimatedHeight = Math.max(lines * 24 + 70, 150);
    }

    return {
      id: generateObjectId(),
      type: 'text',
      position,
      size: { width: estimatedWidth, height: estimatedHeight },
      zIndex: 1,
      data: {
        type: 'text',
        content,
        fontSize,
      },
      metadata: {
        createdAt: Date.now(),
        turnId,
        referenceName,
        tags: ['text', 'note'],
      },
    };
  }

  generateDiagramObject(
    description: string,
    position: Position,
    turnId: string,
    referenceName?: string
  ): DiagramObject {
    const svg = this.generateSimpleDiagram(description);

    return {
      id: generateObjectId(),
      type: 'diagram',
      position,
      size: { width: 600, height: 450 }, // Large size for detailed diagrams
      zIndex: 1,
      data: {
        type: 'diagram',
        svg,
        description,
      },
      metadata: {
        createdAt: Date.now(),
        turnId,
        referenceName,
        tags: ['diagram', 'visualization'],
      },
    };
  }

  generateObject(request: ObjectGenerationRequest, position: Position, turnId: string): CanvasObject {
    switch (request.type) {
      case 'latex':
        return this.generateLatexObject(request.content, position, turnId, request.referenceName);

      case 'graph':
        return this.generateGraphObject(request.content, position, turnId, request.referenceName);

      case 'code':
        return this.generateCodeObject(
          request.content,
          request.metadata?.language || 'javascript',
          position,
          turnId,
          request.referenceName
        );

      case 'text':
        return this.generateTextObject(
          request.content,
          position,
          turnId,
          request.metadata?.fontSize,
          request.referenceName
        );

      case 'diagram':
        return this.generateDiagramObject(request.content, position, turnId, request.referenceName);

      default:
        return this.generateTextObject(request.content, position, turnId, 16, request.referenceName);
    }
  }

  private generateSimpleGraph(equation: string): { svg: string; dataPoints: [number, number][] } {
    const dataPoints: [number, number][] = [];
    const xMin = -10;
    const xMax = 10;
    const steps = 100;
    const xStep = (xMax - xMin) / steps;

    for (let i = 0; i <= steps; i++) {
      const x = xMin + i * xStep;
      try {
        const y = this.evaluateEquation(equation, x);
        if (!isNaN(y) && isFinite(y)) {
          dataPoints.push([x, y]);
        }
      } catch {
        // Skip invalid points
      }
    }

    const svg = this.generateSVGFromPoints(dataPoints, xMin, xMax);
    return { svg, dataPoints };
  }

  private evaluateEquation(equation: string, x: number): number {
    // Simple equation evaluator for basic functions
    // Replace x with the actual value
    const expr = equation
      .replace(/y\s*=\s*/, '')
      .replace(/\^/g, '**')
      .replace(/x/g, `(${x})`);

    // eslint-disable-next-line no-eval
    return eval(expr);
  }

  private generateSVGFromPoints(points: [number, number][], xMin: number, xMax: number): string {
    if (points.length === 0) {
      return `
        <svg width="500" height="400" xmlns="http://www.w3.org/2000/svg">
          <rect width="500" height="400" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
          <text x="250" y="200" text-anchor="middle" font-size="16" fill="#64748b">No data available</text>
        </svg>
      `.trim();
    }

    const padding = 60;
    const width = 500;
    const height = 400;
    const graphWidth = width - 2 * padding;
    const graphHeight = height - 2 * padding;

    const yValues = points.map(p => p[1]);
    const yMin = Math.min(...yValues);
    const yMax = Math.max(...yValues);

    const scaleX = (x: number) => padding + ((x - xMin) / (xMax - xMin)) * graphWidth;
    const scaleY = (y: number) => height - padding - ((y - yMin) / (yMax - yMin)) * graphHeight;

    const pathData = points
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${scaleX(p[0])},${scaleY(p[1])}`)
      .join(' ');

    // Generate grid lines
    const gridLines = [];
    const xSteps = 5;
    const ySteps = 5;
    
    for (let i = 0; i <= xSteps; i++) {
      const x = xMin + (i / xSteps) * (xMax - xMin);
      const xPos = scaleX(x);
      gridLines.push(`<line x1="${xPos}" y1="${padding}" x2="${xPos}" y2="${height - padding}" stroke="#e2e8f0" stroke-width="1"/>`);
    }
    
    for (let i = 0; i <= ySteps; i++) {
      const y = yMin + (i / ySteps) * (yMax - yMin);
      const yPos = scaleY(y);
      gridLines.push(`<line x1="${padding}" y1="${yPos}" x2="${width - padding}" y2="${yPos}" stroke="#e2e8f0" stroke-width="1"/>`);
    }

    // Generate axis labels
    const xLabels = [];
    const yLabels = [];
    
    for (let i = 0; i <= xSteps; i++) {
      const x = xMin + (i / xSteps) * (xMax - xMin);
      const xPos = scaleX(x);
      xLabels.push(`<text x="${xPos}" y="${height - padding + 20}" text-anchor="middle" font-size="10" fill="#64748b">${x.toFixed(1)}</text>`);
    }
    
    for (let i = 0; i <= ySteps; i++) {
      const y = yMin + (i / ySteps) * (yMax - yMin);
      const yPos = scaleY(y);
      yLabels.push(`<text x="${padding - 10}" y="${yPos + 4}" text-anchor="end" font-size="10" fill="#64748b">${y.toFixed(1)}</text>`);
    }

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="graphGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:0.3" />
            <stop offset="100%" style="stop-color:#3b82f6;stop-opacity:0.1" />
          </linearGradient>
        </defs>
        <rect width="${width}" height="${height}" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        
        <!-- Grid lines -->
        ${gridLines.join('')}
        
        <!-- Axes -->
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="#374151" stroke-width="2"/>
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="#374151" stroke-width="2"/>
        
        <!-- Axis labels -->
        ${xLabels.join('')}
        ${yLabels.join('')}
        
        <!-- Graph line with gradient fill -->
        <path d="${pathData} L ${scaleX(points[points.length - 1][0])},${height - padding} L ${scaleX(points[0][0])},${height - padding} Z" fill="url(#graphGradient)"/>
        <path d="${pathData}" fill="none" stroke="#3b82f6" stroke-width="3"/>
        
        <!-- Data points -->
        ${points.map((p, i) => i % Math.ceil(points.length / 20) === 0 ? 
          `<circle cx="${scaleX(p[0])}" cy="${scaleY(p[1])}" r="3" fill="#1e40af" stroke="white" stroke-width="2"/>` : ''
        ).join('')}
        
        <!-- Axis titles -->
        <text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-size="14" font-weight="bold" fill="#374151">x</text>
        <text x="20" y="${height / 2}" text-anchor="middle" font-size="14" font-weight="bold" fill="#374151" transform="rotate(-90, 20, ${height / 2})">y</text>
        
        <!-- Title -->
        <text x="${width / 2}" y="25" text-anchor="middle" font-size="16" font-weight="bold" fill="#1e293b">Function Graph</text>
      </svg>
    `.trim();
  }

  private generateSimpleDiagram(description: string): string {
    // Generate intelligent diagrams based on content
    const lowerDesc = description.toLowerCase();
    
    if (lowerDesc.includes('tree') || lowerDesc.includes('recursion') || lowerDesc.includes('recursive')) {
      return this.generateTreeDiagram(description);
    } else if (lowerDesc.includes('flow') || lowerDesc.includes('process') || lowerDesc.includes('step')) {
      return this.generateFlowchartDiagram(description);
    } else if (lowerDesc.includes('algorithm') || lowerDesc.includes('sort') || lowerDesc.includes('search')) {
      return this.generateAlgorithmDiagram(description);
    } else if (lowerDesc.includes('data structure') || lowerDesc.includes('linked list') || lowerDesc.includes('array')) {
      return this.generateDataStructureDiagram(description);
    } else if (lowerDesc.includes('function') || lowerDesc.includes('method') || lowerDesc.includes('call')) {
      return this.generateFunctionCallDiagram(description);
    } else {
      return this.generateGenericDiagram(description);
    }
  }

  private generateTreeDiagram(description: string): string {
    // Extract context from description
    const isRecursion = description.toLowerCase().includes('recursion') || description.toLowerCase().includes('recursive');
    
    const rootLabel = isRecursion ? 'f(n)' : 'Root';
    const leftLabel = isRecursion ? 'f(n-1)' : 'Left';
    const rightLabel = isRecursion ? 'f(n-2)' : 'Right';
    const title = isRecursion ? 'Recursive Function Calls' : 'Tree Structure';
    const subtitle = isRecursion ? 'Each function call creates new branches' : 'Each node can have multiple children';
    
    return `
      <svg width="500" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
        </defs>
        <rect width="500" height="400" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        
        <!-- Root node -->
        <circle cx="250" cy="80" r="25" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
        <text x="250" y="85" text-anchor="middle" font-size="12" fill="white" font-weight="bold">${rootLabel}</text>
        
        <!-- Level 1 nodes -->
        <circle cx="150" cy="180" r="20" fill="#10b981" stroke="#059669" stroke-width="2"/>
        <text x="150" y="185" text-anchor="middle" font-size="10" fill="white">${leftLabel}</text>
        
        <circle cx="350" cy="180" r="20" fill="#10b981" stroke="#059669" stroke-width="2"/>
        <text x="350" y="185" text-anchor="middle" font-size="10" fill="white">${rightLabel}</text>
        
        <!-- Level 2 nodes -->
        <circle cx="100" cy="280" r="18" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
        <text x="100" y="285" text-anchor="middle" font-size="9" fill="white">${isRecursion ? 'f(n-2)' : 'LL'}</text>
        
        <circle cx="200" cy="280" r="18" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
        <text x="200" y="285" text-anchor="middle" font-size="9" fill="white">${isRecursion ? 'f(n-3)' : 'LR'}</text>
        
        <circle cx="300" cy="280" r="18" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
        <text x="300" y="285" text-anchor="middle" font-size="9" fill="white">${isRecursion ? 'f(n-3)' : 'RL'}</text>
        
        <circle cx="400" cy="280" r="18" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
        <text x="400" y="285" text-anchor="middle" font-size="9" fill="white">${isRecursion ? 'f(n-4)' : 'RR'}</text>
        
        <!-- Arrows -->
        <line x1="250" y1="105" x2="150" y2="160" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="250" y1="105" x2="350" y2="160" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="150" y1="200" x2="100" y2="262" stroke="#10b981" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="150" y1="200" x2="200" y2="262" stroke="#10b981" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="350" y1="200" x2="300" y2="262" stroke="#10b981" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="350" y1="200" x2="400" y2="262" stroke="#10b981" stroke-width="2" marker-end="url(#arrowhead)"/>
        
        <!-- Title -->
        <text x="250" y="30" text-anchor="middle" font-size="16" font-weight="bold" fill="#1e293b">${title}</text>
        <text x="250" y="350" text-anchor="middle" font-size="12" fill="#64748b">${subtitle}</text>
      </svg>
    `.trim();
  }

  private generateFlowchartDiagram(_description: string): string {
    return `
      <svg width="500" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
        </defs>
        <rect width="500" height="400" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        
        <!-- Start -->
        <ellipse cx="250" cy="50" rx="60" ry="25" fill="#10b981" stroke="#059669" stroke-width="2"/>
        <text x="250" y="55" text-anchor="middle" font-size="12" fill="white" font-weight="bold">Start</text>
        
        <!-- Process 1 -->
        <rect x="200" y="120" width="100" height="40" rx="5" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
        <text x="250" y="145" text-anchor="middle" font-size="11" fill="white">Process A</text>
        
        <!-- Decision -->
        <polygon points="250,200 300,230 250,260 200,230" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
        <text x="250" y="235" text-anchor="middle" font-size="10" fill="white">Decision</text>
        
        <!-- Process 2 -->
        <rect x="350" y="220" width="100" height="40" rx="5" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
        <text x="400" y="245" text-anchor="middle" font-size="11" fill="white">Process B</text>
        
        <!-- Process 3 -->
        <rect x="50" y="220" width="100" height="40" rx="5" fill="#8b5cf6" stroke="#7c3aed" stroke-width="2"/>
        <text x="100" y="245" text-anchor="middle" font-size="11" fill="white">Process C</text>
        
        <!-- End -->
        <ellipse cx="250" cy="320" rx="60" ry="25" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
        <text x="250" y="325" text-anchor="middle" font-size="12" fill="white" font-weight="bold">End</text>
        
        <!-- Arrows -->
        <line x1="250" y1="75" x2="250" y2="120" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="250" y1="160" x2="250" y2="200" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="300" y1="230" x2="350" y2="240" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="200" y1="230" x2="150" y2="240" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="400" y1="260" x2="400" y2="295" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="100" y1="260" x2="100" y2="295" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="200" y1="320" x2="190" y2="320" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="300" y1="320" x2="310" y2="320" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        
        <!-- Labels -->
        <text x="325" y="225" font-size="9" fill="#64748b">Yes</text>
        <text x="175" y="225" font-size="9" fill="#64748b">No</text>
        
        <!-- Title -->
        <text x="250" y="20" text-anchor="middle" font-size="16" font-weight="bold" fill="#1e293b">Process Flow</text>
      </svg>
    `.trim();
  }

  private generateAlgorithmDiagram(_description: string): string {
    return `
      <svg width="500" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
        </defs>
        <rect width="500" height="400" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        
        <!-- Algorithm steps -->
        <rect x="50" y="60" width="400" height="30" rx="5" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
        <text x="250" y="80" text-anchor="middle" font-size="12" fill="white" font-weight="bold">1. Initialize</text>
        
        <rect x="50" y="120" width="400" height="30" rx="5" fill="#10b981" stroke="#059669" stroke-width="2"/>
        <text x="250" y="140" text-anchor="middle" font-size="12" fill="white" font-weight="bold">2. Process Data</text>
        
        <rect x="50" y="180" width="400" height="30" rx="5" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
        <text x="250" y="200" text-anchor="middle" font-size="12" fill="white" font-weight="bold">3. Apply Logic</text>
        
        <rect x="50" y="240" width="400" height="30" rx="5" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
        <text x="250" y="260" text-anchor="middle" font-size="12" fill="white" font-weight="bold">4. Return Result</text>
        
        <!-- Arrows -->
        <line x1="250" y1="90" x2="250" y2="120" stroke="#3b82f6" stroke-width="3" marker-end="url(#arrowhead)"/>
        <line x1="250" y1="150" x2="250" y2="180" stroke="#3b82f6" stroke-width="3" marker-end="url(#arrowhead)"/>
        <line x1="250" y1="210" x2="250" y2="240" stroke="#3b82f6" stroke-width="3" marker-end="url(#arrowhead)"/>
        
        <!-- Loop indicator -->
        <path d="M 450 200 Q 480 200 480 230 Q 480 260 450 260" stroke="#8b5cf6" stroke-width="2" fill="none" stroke-dasharray="5,5"/>
        <text x="465" y="245" font-size="9" fill="#8b5cf6">Loop</text>
        
        <!-- Title -->
        <text x="250" y="30" text-anchor="middle" font-size="16" font-weight="bold" fill="#1e293b">Algorithm Steps</text>
        <text x="250" y="320" text-anchor="middle" font-size="12" fill="#64748b">Sequential processing with potential loops</text>
      </svg>
    `.trim();
  }

  private generateDataStructureDiagram(_description: string): string {
    return `
      <svg width="500" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
        </defs>
        <rect width="500" height="400" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        
        <!-- Array representation -->
        <text x="50" y="30" font-size="14" font-weight="bold" fill="#1e293b">Array Structure</text>
        <rect x="50" y="50" width="40" height="30" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
        <text x="70" y="70" text-anchor="middle" font-size="10" fill="white">A[0]</text>
        <rect x="100" y="50" width="40" height="30" fill="#10b981" stroke="#059669" stroke-width="2"/>
        <text x="120" y="70" text-anchor="middle" font-size="10" fill="white">A[1]</text>
        <rect x="150" y="50" width="40" height="30" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
        <text x="170" y="70" text-anchor="middle" font-size="10" fill="white">A[2]</text>
        <rect x="200" y="50" width="40" height="30" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
        <text x="220" y="70" text-anchor="middle" font-size="10" fill="white">A[3]</text>
        <rect x="250" y="50" width="40" height="30" fill="#8b5cf6" stroke="#7c3aed" stroke-width="2"/>
        <text x="270" y="70" text-anchor="middle" font-size="10" fill="white">A[4]</text>
        
        <!-- Linked list representation -->
        <text x="50" y="130" font-size="14" font-weight="bold" fill="#1e293b">Linked List Structure</text>
        
        <!-- Node 1 -->
        <rect x="50" y="150" width="60" height="40" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
        <text x="80" y="170" text-anchor="middle" font-size="10" fill="white">Data</text>
        <text x="80" y="185" text-anchor="middle" font-size="8" fill="white">Next</text>
        
        <!-- Node 2 -->
        <rect x="150" y="150" width="60" height="40" fill="#10b981" stroke="#059669" stroke-width="2"/>
        <text x="180" y="170" text-anchor="middle" font-size="10" fill="white">Data</text>
        <text x="180" y="185" text-anchor="middle" font-size="8" fill="white">Next</text>
        
        <!-- Node 3 -->
        <rect x="250" y="150" width="60" height="40" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
        <text x="280" y="170" text-anchor="middle" font-size="10" fill="white">Data</text>
        <text x="280" y="185" text-anchor="middle" font-size="8" fill="white">Next</text>
        
        <!-- Arrows for linked list -->
        <line x1="110" y1="170" x2="150" y2="170" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="210" y1="170" x2="250" y2="170" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="310" y1="170" x2="350" y2="170" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        
        <!-- Tree structure -->
        <text x="50" y="230" font-size="14" font-weight="bold" fill="#1e293b">Tree Structure</text>
        <circle cx="100" cy="270" r="15" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
        <text x="100" y="275" text-anchor="middle" font-size="9" fill="white">Root</text>
        
        <circle cx="50" cy="320" r="12" fill="#8b5cf6" stroke="#7c3aed" stroke-width="2"/>
        <text x="50" y="325" text-anchor="middle" font-size="8" fill="white">L</text>
        
        <circle cx="150" cy="320" r="12" fill="#8b5cf6" stroke="#7c3aed" stroke-width="2"/>
        <text x="150" y="325" text-anchor="middle" font-size="8" fill="white">R</text>
        
        <line x1="100" y1="285" x2="50" y2="308" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="100" y1="285" x2="150" y2="308" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        
        <!-- Title -->
        <text x="250" y="20" text-anchor="middle" font-size="16" font-weight="bold" fill="#1e293b">Data Structures</text>
      </svg>
    `.trim();
  }

  private generateFunctionCallDiagram(_description: string): string {
    return `
      <svg width="500" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
        </defs>
        <rect width="500" height="400" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        
        <!-- Main function -->
        <rect x="200" y="50" width="100" height="40" rx="5" fill="#3b82f6" stroke="#1e40af" stroke-width="2"/>
        <text x="250" y="75" text-anchor="middle" font-size="12" fill="white" font-weight="bold">main()</text>
        
        <!-- Function calls -->
        <rect x="50" y="150" width="100" height="40" rx="5" fill="#10b981" stroke="#059669" stroke-width="2"/>
        <text x="100" y="175" text-anchor="middle" font-size="11" fill="white">funcA()</text>
        
        <rect x="200" y="150" width="100" height="40" rx="5" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
        <text x="250" y="175" text-anchor="middle" font-size="11" fill="white">funcB()</text>
        
        <rect x="350" y="150" width="100" height="40" rx="5" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
        <text x="400" y="175" text-anchor="middle" font-size="11" fill="white">funcC()</text>
        
        <!-- Nested calls -->
        <rect x="50" y="250" width="80" height="35" rx="5" fill="#8b5cf6" stroke="#7c3aed" stroke-width="2"/>
        <text x="90" y="272" text-anchor="middle" font-size="10" fill="white">helper()</text>
        
        <rect x="150" y="250" width="80" height="35" rx="5" fill="#06b6d4" stroke="#0891b2" stroke-width="2"/>
        <text x="190" y="272" text-anchor="middle" font-size="10" fill="white">util()</text>
        
        <rect x="320" y="250" width="80" height="35" rx="5" fill="#84cc16" stroke="#65a30d" stroke-width="2"/>
        <text x="360" y="272" text-anchor="middle" font-size="10" fill="white">calc()</text>
        
        <!-- Arrows -->
        <line x1="250" y1="90" x2="100" y2="150" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="250" y1="90" x2="250" y2="150" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="250" y1="90" x2="400" y2="150" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        
        <line x1="100" y1="190" x2="90" y2="250" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="100" y1="190" x2="190" y2="250" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="400" y1="190" x2="360" y2="250" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        
        <!-- Return arrows -->
        <line x1="90" y1="250" x2="100" y2="190" stroke="#10b981" stroke-width="1" stroke-dasharray="3,3" marker-end="url(#arrowhead)"/>
        <line x1="190" y1="250" x2="100" y2="190" stroke="#10b981" stroke-width="1" stroke-dasharray="3,3" marker-end="url(#arrowhead)"/>
        <line x1="360" y1="250" x2="400" y2="190" stroke="#10b981" stroke-width="1" stroke-dasharray="3,3" marker-end="url(#arrowhead)"/>
        
        <!-- Title -->
        <text x="250" y="30" text-anchor="middle" font-size="16" font-weight="bold" fill="#1e293b">Function Call Stack</text>
        <text x="250" y="320" text-anchor="middle" font-size="12" fill="#64748b">Solid: calls, Dashed: returns</text>
      </svg>
    `.trim();
  }

  private generateGenericDiagram(description: string): string {
    // Extract key concepts from the description
    const words = description.toLowerCase().split(' ').filter(word => 
      word.length > 3 && !['the', 'and', 'for', 'with', 'this', 'that', 'from', 'they', 'have', 'been', 'were', 'said', 'each', 'which', 'their', 'time', 'will', 'about', 'would', 'there', 'could', 'other'].includes(word)
    );
    
    const concept1 = words[0] || 'Key';
    const concept2 = words[1] || 'Element';
    const concept3 = words[2] || 'Factor';
    const concept4 = words[3] || 'Component';
    
    // Extract main concept from description
    const mainConcept = description.split(' ').slice(0, 3).join(' ').replace(/[^a-zA-Z\s]/g, '') || 'Main Concept';
    
    return `
      <svg width="500" height="400" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
          </marker>
        </defs>
        <rect width="500" height="400" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1"/>
        
        <!-- Central concept -->
        <circle cx="250" cy="200" r="60" fill="#3b82f6" stroke="#1e40af" stroke-width="3"/>
        <text x="250" y="195" text-anchor="middle" font-size="12" fill="white" font-weight="bold">${mainConcept}</text>
        <text x="250" y="210" text-anchor="middle" font-size="10" fill="white">Core</text>
        
        <!-- Related elements -->
        <circle cx="100" cy="100" r="30" fill="#10b981" stroke="#059669" stroke-width="2"/>
        <text x="100" y="95" text-anchor="middle" font-size="9" fill="white">${concept1}</text>
        <text x="100" y="108" text-anchor="middle" font-size="8" fill="white">Related</text>
        
        <circle cx="400" cy="100" r="30" fill="#f59e0b" stroke="#d97706" stroke-width="2"/>
        <text x="400" y="95" text-anchor="middle" font-size="9" fill="white">${concept2}</text>
        <text x="400" y="108" text-anchor="middle" font-size="8" fill="white">Related</text>
        
        <circle cx="100" cy="300" r="30" fill="#ef4444" stroke="#dc2626" stroke-width="2"/>
        <text x="100" y="295" text-anchor="middle" font-size="9" fill="white">${concept3}</text>
        <text x="100" y="308" text-anchor="middle" font-size="8" fill="white">Related</text>
        
        <circle cx="400" cy="300" r="30" fill="#8b5cf6" stroke="#7c3aed" stroke-width="2"/>
        <text x="400" y="295" text-anchor="middle" font-size="9" fill="white">${concept4}</text>
        <text x="400" y="308" text-anchor="middle" font-size="8" fill="white">Related</text>
        
        <!-- Arrows -->
        <line x1="130" y1="100" x2="190" y2="170" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="370" y1="100" x2="310" y2="170" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="130" y1="300" x2="190" y2="230" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        <line x1="370" y1="300" x2="310" y2="230" stroke="#3b82f6" stroke-width="2" marker-end="url(#arrowhead)"/>
        
        <!-- Title -->
        <text x="250" y="30" text-anchor="middle" font-size="16" font-weight="bold" fill="#1e293b">Conceptual Overview</text>
        <text x="250" y="370" text-anchor="middle" font-size="11" fill="#64748b">${description.length > 50 ? description.substring(0, 50) + '...' : description}</text>
      </svg>
    `.trim();
  }
}

export const objectGenerator = new ObjectGenerator();
