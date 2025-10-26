'use client';

import type { CSSProperties } from "react";
import { CanvasObject } from "@/types";
import { cn } from "@/lib/cn";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import 'katex/dist/katex.min.css';
import { ObjectLoadingState } from "./object-loading-state";
import { CodeBlock } from "@/components/code-block";

// Removed getObjectSizeClass - now using backend-calculated sizes directly

function renderObjectContent(object: CanvasObject) {
  if (!object.data) return null;

  switch (object.type) {
    case 'text':
    case 'note':
      // Check if content is a JSON string and extract it
      let contentToRender = object.data.content;
      if (typeof contentToRender === 'string') {
        try {
          const parsed = JSON.parse(contentToRender);
          if (typeof parsed === 'object' && parsed !== null && 'content' in parsed) {
            contentToRender = parsed.content;
          }
        } catch (e) {
          // Not JSON, use as-is
        }
      }
      
      return (
        <div className="prose prose-sm max-w-none text-slate-800 leading-relaxed">
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[rehypeKatex]}
            components={{
              // Customize rendering of specific elements
              p: ({node, ...props}) => <p className="mb-3 last:mb-0" {...props} />,
              ul: ({node, ...props}) => <ul className="list-disc list-inside mb-3" {...props} />,
              ol: ({node, ...props}) => <ol className="list-decimal list-inside mb-3" {...props} />,
              li: ({node, ...props}) => <li className="mb-1" {...props} />,
              strong: ({node, ...props}) => <strong className="font-bold text-slate-900" {...props} />,
              em: ({node, ...props}) => <em className="italic" {...props} />,
              code: ({node, className, children, ...props}: any) => {
                const inline = !className;
                return inline ? (
                  <code className="px-1.5 py-0.5 bg-slate-100 rounded text-sm font-mono" {...props}>
                    {children}
                  </code>
                ) : (
                  <code className={className} {...props}>
                    {children}
                  </code>
                );
              },
            }}
          >
            {contentToRender || ''}
          </ReactMarkdown>
        </div>
      );
    
    case 'diagram':
      return (
        <div
          className="bg-white rounded"
          dangerouslySetInnerHTML={{ __html: object.data.svg || '' }}
        />
      );
    
    case 'code':
      return (
        <CodeBlock
          code={object.data.code || ''}
          language={object.data.language || 'text'}
          theme="light"
          showLineNumbers={true}
          showCopyButton={true}
        />
      );
    
    case 'graph':
      return (
        <div
          className="bg-white rounded"
          dangerouslySetInnerHTML={{ __html: object.data.svg || '' }}
        />
      );
    
    case 'latex':
      // Access the LaTeX source from the correct field
      const latexSource = object.data.latex || object.data.content || '';

      // If no LaTeX source, fall back to rendered image
      if (!latexSource) {
        return (
          <div className="text-slate-900">
            <img
              src={object.data.rendered}
              alt="LaTeX equation"
              className=""
            />
          </div>
        );
      }

      // Wrap with display mode delimiters for KaTeX if not already wrapped
      let displayContent = latexSource;
      if (!displayContent.includes('$')) {
        // Use display mode ($$...$$) for centered equations
        displayContent = `$$${displayContent}$$`;
      }

      // Render with KaTeX via ReactMarkdown
      return (
        <div className="p-4 text-slate-900 flex items-center justify-center h-full">
          <div className="katex-wrapper">
            <ReactMarkdown
              remarkPlugins={[remarkMath]}
              rehypePlugins={[rehypeKatex]}
            >
              {displayContent}
            </ReactMarkdown>
          </div>
        </div>
      );
    
    case 'image':
      return (
        <img 
          src={object.data.url || object.data.content} 
          alt={object.data.alt || 'Generated image'} 
          className="rounded"
        />
      );

    case 'video':
      const videoUrl = object.data.url;
      const isGif = videoUrl?.endsWith('.gif');
      
      return (
        <div className="bg-white rounded-lg p-4 shadow-lg h-full overflow-auto flex items-center justify-center">
          {isGif ? (
            <img
              src={videoUrl}
              alt={object.data.alt || 'Animation'}
              className="max-w-full max-h-full rounded"
              style={{ maxHeight: '100%', maxWidth: '100%' }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={videoUrl}
              controls
              loop
              className="max-w-full max-h-full rounded"
              style={{ maxHeight: '100%', maxWidth: '100%' }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
            >
              <track kind="captions" />
              Your browser does not support the video tag.
            </video>
          )}
        </div>
      );

    default:
      return (
        <p className="text-sm text-slate-800">
          {JSON.stringify(object.data)}
        </p>
      );
  }
}

type ObjectLayerProps = {
  objects: CanvasObject[];
  transform: { x: number; y: number; k: number };
  onSelect: (id: string, event: React.MouseEvent) => void;
  onDragStart?: (id: string, event: React.PointerEvent) => void;
  onDragMove?: (id: string, event: React.PointerEvent) => void;
  onDragEnd?: (id: string, event: React.PointerEvent) => void;
  onContextMenu?: (id: string, event: React.MouseEvent) => void;
  isDragging?: boolean;
  dragState?: {
    objectId: string;
    selectedObjectIds: string[];
    startWorld: { x: number; y: number };
    startScreen: { x: number; y: number };
    startPositions: Record<string, { x: number; y: number }>;
    currentDelta: { x: number; y: number };
    wasSelectedAtStart: boolean;
  } | null;
  resizeState?: {
    objectId: string;
    corner: string;
    startWorld: { x: number; y: number };
    startDimensions: { x: number; y: number; width: number; height: number };
    currentDimensions: { x: number; y: number; width: number; height: number };
    textScale?: number;
  } | null;
};

export function ObjectLayer({ objects, transform, onSelect, onDragStart, onDragMove, onDragEnd, onContextMenu, isDragging, dragState, resizeState }: ObjectLayerProps) {
  const stageStyle: CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
    transformOrigin: "0 0"
  };

  // Sort objects by zIndex so higher ones render on top
  const sortedObjects = [...objects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="relative h-full w-full"
        style={stageStyle}
      >
        {sortedObjects.map((object) => {
          // Check if this object is part of the group being dragged
          const isBeingDragged = dragState?.selectedObjectIds?.includes(object.id) ?? false;
          const dragTransform = isBeingDragged && dragState
            ? `translate(${dragState.currentDelta.x}px, ${dragState.currentDelta.y}px)`
            : undefined;

          // Objects now auto-fit their content with no manual resizing
          const objectX = object.x;
          const objectY = object.y;

          // All objects use auto dimensions to fit content snugly
          const objectWidth = 'auto';
          const objectHeight = 'auto';

          return (
          <div
            key={object.id}
            data-canvas-object="true"
            className={cn(
              "pointer-events-auto absolute rounded-lg shadow-lg transition-colors",
              isDragging ? "cursor-grabbing" : "cursor-grab"
            )}
            style={{
              left: objectX,
              top: objectY,
              width: objectWidth,
              height: objectHeight,
              background: `${object.color}20`,
              zIndex: object.zIndex || 0,
              transform: dragTransform
            }}
            onPointerDown={(event) => {
              event.stopPropagation();
              event.preventDefault();
              if (onDragStart) {
                onDragStart(object.id, event);
              }
            }}
            onPointerMove={(event) => {
              // Only call drag move if we're actually dragging
              if (isDragging && onDragMove) {
                event.stopPropagation();
                event.preventDefault();
                onDragMove(object.id, event);
              }
            }}
            onPointerUp={(event) => {
              event.stopPropagation();
              event.preventDefault();
              if (onDragEnd) {
                onDragEnd(object.id, event);
              }
            }}
            onClick={(event) => {
              event.stopPropagation();
            }}
            onContextMenu={(event) => {
              event.preventDefault();
              event.stopPropagation();
              if (onContextMenu) {
                onContextMenu(object.id, event);
              }
            }}
          >
            <div className={cn(
              "flex flex-col bg-white/95 backdrop-blur rounded-lg shadow-xl transition-colors",
              object.selected ? "border-2 border-sky-400" : "border border-slate-200"
            )}>
              <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-600 font-medium">
                    {object.type}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-900">
                    {object.label}
                  </h3>
                </div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: object.color }}></div>
              </div>
              <div className="px-4 pb-4">
                {object.generationState === 'generating' || object.placeholder ? (
                  <ObjectLoadingState type={object.type} />
                ) : (
                  renderObjectContent(object)
                )}
              </div>
              {object.metadata?.description ? (
                <div className="px-4 pb-4 pt-2 border-t border-slate-200">
                  <p className="text-sm text-slate-600">
                    {String(object.metadata.description)}
                  </p>
                </div>
              ) : null}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
