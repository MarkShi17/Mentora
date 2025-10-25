import {
  CanvasObject,
  LatexObject,
  GraphObject,
  CodeObject,
  TextObject,
  DiagramObject,
  Position,
  Size,
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
    return {
      id: generateObjectId(),
      type: 'code',
      position,
      size: { width: 600, height: 300 },
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
    const estimatedWidth = Math.min(content.length * 8, 600);
    const estimatedHeight = Math.ceil((content.length * 8) / 600) * 30;

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
      size: { width: 500, height: 400 },
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
      return '<svg width="500" height="400"><text x="250" y="200" text-anchor="middle">No data</text></svg>';
    }

    const padding = 40;
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

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="${width}" height="${height}" fill="white"/>
        <line x1="${padding}" y1="${height - padding}" x2="${width - padding}" y2="${height - padding}" stroke="black" stroke-width="2"/>
        <line x1="${padding}" y1="${padding}" x2="${padding}" y2="${height - padding}" stroke="black" stroke-width="2"/>
        <path d="${pathData}" fill="none" stroke="blue" stroke-width="2"/>
        <text x="${width / 2}" y="${height - 10}" text-anchor="middle" font-size="12">x</text>
        <text x="20" y="${height / 2}" text-anchor="middle" font-size="12">y</text>
      </svg>
    `.trim();
  }

  private generateSimpleDiagram(description: string): string {
    // Generate a simple placeholder diagram
    return `
      <svg width="500" height="400" xmlns="http://www.w3.org/2000/svg">
        <rect width="500" height="400" fill="white" stroke="black" stroke-width="2"/>
        <text x="250" y="200" text-anchor="middle" font-size="14">${description}</text>
      </svg>
    `.trim();
  }
}

export const objectGenerator = new ObjectGenerator();
