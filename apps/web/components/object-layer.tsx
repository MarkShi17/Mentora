'use client';

import type { CSSProperties } from "react";
import { useEffect, useRef } from "react";
import { CanvasObject, ConnectionAnchor, ObjectConnection } from "@/types";
import { cn } from "@/lib/cn";
import { getHoveredAnchor } from "@/lib/connection-utils";
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import * as katex from 'katex';
import 'katex/dist/katex.min.css';
import { ObjectLoadingState } from "./object-loading-state";
import { CodeBlock } from "@/components/code-block";

// Removed getObjectSizeClass - now using backend-calculated sizes directly

function renderObjectContent(object: CanvasObject, scaleFactor: number = 1) {
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

      // Use stored fontSize from object data, default to 14px for better readability
      const baseFontSize = object.data.fontSize || 14;

      return (
        <div
          className="prose prose-sm max-w-none text-slate-800 leading-relaxed select-none"
          style={{
            fontSize: `${baseFontSize}px`,
            lineHeight: 1.5,
            overflow: 'hidden'
          }}
        >
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
          className="bg-white rounded overflow-hidden select-none"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              transform: `scale(${scaleFactor})`,
              transformOrigin: 'center',
              maxWidth: '100%',
              maxHeight: '100%'
            }}
            dangerouslySetInnerHTML={{ __html: object.data.svg || '' }}
          />
        </div>
      );
    
    case 'code':
      return (
        <div
          className="overflow-hidden"
          style={{
            width: '100%',
            height: '100%',
            fontSize: `${scaleFactor}em`
          }}
        >
          <CodeBlock
            code={object.data.code || ''}
            language={object.data.language || 'text'}
            theme="light"
            showLineNumbers={true}
            showCopyButton={true}
          />
        </div>
      );
    
    case 'graph':
      return (
        <div
          className="bg-white rounded overflow-hidden select-none"
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <div
            style={{
              transform: `scale(${scaleFactor})`,
              transformOrigin: 'center',
              maxWidth: '100%',
              maxHeight: '100%'
            }}
            dangerouslySetInnerHTML={{ __html: object.data.svg || '' }}
          />
        </div>
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

      // Render with KaTeX directly (NO markdown processing to avoid interference)
      try {
        const html = katex.renderToString(latexSource, {
          displayMode: true,  // Use display mode for centered equations
          throwOnError: false,  // Show error instead of throwing
          errorColor: '#cc0000',
          strict: false  // Allow relaxed syntax
        });

        return (
          <div 
            className="p-4 text-slate-900 flex items-center justify-center h-full overflow-hidden"
            style={{
              fontSize: `${scaleFactor}em`
            }}
          >
            <div className="katex-wrapper" dangerouslySetInnerHTML={{ __html: html }} />
          </div>
        );
      } catch (error) {
        // If KaTeX fails, fall back to rendered image
        return (
          <div 
            className="text-slate-900 overflow-hidden flex items-center justify-center h-full"
            style={{
              width: '100%',
              height: '100%'
            }}
          >
            <img
              src={object.data.rendered}
              alt="LaTeX equation"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                transform: `scale(${scaleFactor})`,
                transformOrigin: 'center'
              }}
            />
          </div>
        );
      }
    
    case 'image':
      return (
        <img
          src={object.data.url || object.data.content}
          alt={object.data.alt || 'Generated image'}
          className="rounded"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain'  // Scale to fit without clipping
          }}
        />
      );

    case 'video':
      const videoUrl = object.data.url;
      const isGif = videoUrl?.endsWith('.gif');

      // Add cache-busting for non-data URLs to prevent browser caching old videos
      // For data URLs (base64), the content is embedded so no caching issue
      // For file:// URLs, append timestamp to force reload
      const cacheBustedUrl = videoUrl?.startsWith('data:')
        ? videoUrl
        : `${videoUrl}${videoUrl?.includes('?') ? '&' : '?'}t=${object.metadata?.createdAt || Date.now()}`;

      return (
        <div
          className="bg-white rounded-lg p-4 shadow-lg h-full flex items-center justify-center select-none"
          style={{
            width: '100%',
            height: '100%'
          }}
        >
          {isGif ? (
            <img
              src={cacheBustedUrl}
              alt={object.data.alt || 'Animation'}
              className="rounded"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'  // Scale to fit without clipping
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onPointerMove={(e) => e.stopPropagation()}
            />
          ) : (
            <video
              src={cacheBustedUrl}
              controls
              loop
              autoPlay
              className="rounded"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain'  // Scale to fit without clipping
              }}
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

type ResizeDirection = 'nw' | 'ne' | 'sw' | 'se';

type ObjectLayerProps = {
  objects: CanvasObject[];
  transform: { x: number; y: number; k: number };
  onDragStart?: (id: string, event: React.PointerEvent) => void;
  onDragMove?: (id: string, event: React.PointerEvent) => void;
  onDragEnd?: (id: string, event: React.PointerEvent) => void;
  onResizeStart?: (id: string, direction: ResizeDirection, event: React.PointerEvent) => void;
  onResizeMove?: (id: string, event: React.PointerEvent) => void;
  onResizeEnd?: (id: string, event: React.PointerEvent) => void;
  onContextMenu?: (id: string, event: React.MouseEvent) => void;
  onDimensionsMeasured?: (id: string, width: number, height: number) => void;
  onConnectionStart?: (id: string, anchor: ConnectionAnchor, event: React.PointerEvent) => void;
  onAnchorHover?: (id: string, anchor: ConnectionAnchor | null) => void;
  hoveredAnchor?: { objectId: string; anchor: ConnectionAnchor } | null;
  connections?: ObjectConnection[];
  getConnectionsByAnchor?: (sessionId: string, objectId: string, anchor: ConnectionAnchor) => ObjectConnection[];
  activeSessionId?: string | null;
  isDragging?: boolean;
  isResizing?: boolean;
  isConnectionMode?: boolean; // New prop to show/hide anchors
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
    direction: ResizeDirection;
    startWorld: { x: number; y: number };
    startScreen: { x: number; y: number };
    startSize: { width: number; height: number };
    startPosition: { x: number; y: number };
    currentDelta: { x: number; y: number };
  } | null;
};

// Component for individual canvas object with dimension measurement
function CanvasObjectItem({
  object,
  transform,
  isDragging,
  isResizing,
  dragState,
  resizeState,
  onDragStart,
  onDragMove,
  onDragEnd,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onContextMenu,
  onDimensionsMeasured,
  onConnectionStart,
  onAnchorHover,
  hoveredAnchor,
  connections,
  getConnectionsByAnchor,
  activeSessionId,
  isConnectionMode
}: {
  object: CanvasObject;
  transform: { x: number; y: number; k: number };
  isDragging?: boolean;
  isResizing?: boolean;
  isConnectionMode?: boolean;
  dragState?: ObjectLayerProps['dragState'];
  resizeState?: ObjectLayerProps['resizeState'];
  onDragStart?: (id: string, event: React.PointerEvent) => void;
  onDragMove?: (id: string, event: React.PointerEvent) => void;
  onDragEnd?: (id: string, event: React.PointerEvent) => void;
  onResizeStart?: (id: string, direction: ResizeDirection, event: React.PointerEvent) => void;
  onResizeMove?: (id: string, event: React.PointerEvent) => void;
  onResizeEnd?: (id: string, event: React.PointerEvent) => void;
  onContextMenu?: (id: string, event: React.MouseEvent) => void;
  onDimensionsMeasured?: (id: string, width: number, height: number) => void;
  onConnectionStart?: (id: string, anchor: ConnectionAnchor, event: React.PointerEvent) => void;
  onAnchorHover?: (id: string, anchor: ConnectionAnchor | null) => void;
  hoveredAnchor?: { objectId: string; anchor: ConnectionAnchor } | null;
  connections?: ObjectConnection[];
  getConnectionsByAnchor?: (sessionId: string, objectId: string, anchor: ConnectionAnchor) => ObjectConnection[];
  activeSessionId?: string | null;
}) {
  const objectRef = useRef<HTMLDivElement>(null);

  // Helper function to check if an anchor has connections
  const hasConnections = (anchor: ConnectionAnchor): boolean => {
    if (!activeSessionId || !getConnectionsByAnchor) return false;
    const connections = getConnectionsByAnchor(activeSessionId, object.id, anchor);
    return connections.length > 0;
  };

  // Measure actual DOM dimensions and report back
  useEffect(() => {
    if (!objectRef.current || !onDimensionsMeasured) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        // Only update if dimensions actually changed and are valid
        if (width > 0 && height > 0 && (width !== object.width || height !== object.height)) {
          onDimensionsMeasured(object.id, width, height);
        }
      }
    });

    resizeObserver.observe(objectRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, [object.id, object.width, object.height, onDimensionsMeasured]);

  // Check if this object is part of the group being dragged
  const isBeingDragged = dragState?.selectedObjectIds?.includes(object.id) ?? false;
  const dragTransform = isBeingDragged && dragState
    ? `translate(${dragState.currentDelta.x}px, ${dragState.currentDelta.y}px)`
    : undefined;

  const dimensions = {
    x: object.x,
    y: object.y,
    width: object.width,
    height: object.height
  };

  // Use auto sizing if dimensions not yet measured, otherwise use measured/resized dimensions
  const objectWidth = typeof dimensions.width === 'number' && dimensions.width > 0 ? dimensions.width : 'auto';
  const objectHeight = typeof dimensions.height === 'number' && dimensions.height > 0 ? dimensions.height : 'auto';

  return (
    <div
      ref={objectRef}
      key={object.id}
      data-canvas-object="true"
      data-object-id={object.id}
      className={cn(
        "pointer-events-auto absolute transition-shadow duration-200 select-none",
        isDragging ? "cursor-grabbing" : "cursor-grab"
      )}
      style={{
        left: dimensions.x,
        top: dimensions.y,
        width: objectWidth,
        height: objectHeight,
        zIndex: object.zIndex || 0,
        transform: dragTransform,
        transition: 'box-shadow 0.2s ease'
      }}
      onPointerDown={(event) => {
        event.stopPropagation();
        // Don't prevent default to allow resize handles to work
        // Only start drag if we're not in resize mode
        if (onDragStart && !isResizing) {
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
        if (onDragEnd) {
          onDragEnd(object.id, event);
        }
      }}
      onContextMenu={(event) => {
        event.preventDefault();
        event.stopPropagation();
        if (onContextMenu) {
          onContextMenu(object.id, event);
        }
      }}
    >
      <div
        className={cn(
          "flex flex-col bg-white/95 backdrop-blur rounded-lg shadow-xl border relative select-none",
          object.selected ? "border-blue-400" : "border-slate-200"
        )}
      >
        <div className="px-4 pt-4 pb-2 flex items-center justify-between flex-shrink-0">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-600 font-medium">
              {object.type}
            </p>
          </div>
          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: object.color }}></div>
        </div>
        <div className="px-4 pb-4 select-none">
          {object.generationState === 'generating' || object.placeholder ? (
            <ObjectLoadingState type={object.type} />
          ) : (
            (() => {
              // Calculate scale factor based on current size vs default size
              // Default sizes are typically around 300x200 for most components
              const defaultWidth = 300;
              const defaultHeight = 200;
              const currentWidth = typeof objectWidth === 'number' ? objectWidth : defaultWidth;
              const currentHeight = typeof objectHeight === 'number' ? objectHeight : defaultHeight;
              
              // Calculate scale factor as the minimum of width and height scaling to ensure content fits
              const widthScale = currentWidth / defaultWidth;
              const heightScale = currentHeight / defaultHeight;
              const scaleFactor = Math.max(0.3, Math.min(3, Math.min(widthScale, heightScale)));
              
              return renderObjectContent(object, scaleFactor);
            })()
          )}
        </div>
        {object.metadata?.description ? (
          <div className="px-4 pb-4 pt-2 border-t border-slate-200">
            <p className="text-sm text-slate-600">
              {String(object.metadata.description)}
            </p>
          </div>
        ) : null}
        
        {/* Connection anchors - only show when component is selected or in connection mode */}
        {onConnectionStart && (isConnectionMode || object.selected) && (
          <>
            {/* North anchor - at the top border */}
            <div
              className={cn(
                "absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 cursor-pointer transition-colors hover:scale-110 active:scale-95",
                hasConnections('north')
                  ? "border-green-500 bg-green-100 hover:border-green-600 hover:bg-green-200"
                  : "border-slate-400 bg-white hover:border-blue-500 hover:bg-blue-50"
              )}
              style={{
                left: '50%',
                top: '0px'
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onConnectionStart(object.id, 'north', e);
              }}
              onPointerEnter={() => onAnchorHover?.(object.id, 'north')}
              onPointerLeave={() => onAnchorHover?.(object.id, null)}
            />
            
            {/* East anchor - at the right border */}
            <div
              className={cn(
                "absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 cursor-pointer transition-colors hover:scale-110 active:scale-95",
                hasConnections('east')
                  ? "border-green-500 bg-green-100 hover:border-green-600 hover:bg-green-200"
                  : "border-slate-400 bg-white hover:border-blue-500 hover:bg-blue-50"
              )}
              style={{
                left: '100%',
                top: '50%'
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onConnectionStart(object.id, 'east', e);
              }}
              onPointerEnter={() => onAnchorHover?.(object.id, 'east')}
              onPointerLeave={() => onAnchorHover?.(object.id, null)}
            />
            
            {/* South anchor - at the bottom border */}
            <div
              className={cn(
                "absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 cursor-pointer transition-colors hover:scale-110 active:scale-95",
                hasConnections('south')
                  ? "border-green-500 bg-green-100 hover:border-green-600 hover:bg-green-200"
                  : "border-slate-400 bg-white hover:border-blue-500 hover:bg-blue-50"
              )}
              style={{
                left: '50%',
                top: '100%'
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onConnectionStart(object.id, 'south', e);
              }}
              onPointerEnter={() => onAnchorHover?.(object.id, 'south')}
              onPointerLeave={() => onAnchorHover?.(object.id, null)}
            />
            
            {/* West anchor - at the left border */}
            <div
              className={cn(
                "absolute w-4 h-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 cursor-pointer transition-colors hover:scale-110 active:scale-95",
                hasConnections('west')
                  ? "border-green-500 bg-green-100 hover:border-green-600 hover:bg-green-200"
                  : "border-slate-400 bg-white hover:border-blue-500 hover:bg-blue-50"
              )}
              style={{
                left: '0px',
                top: '50%'
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                onConnectionStart(object.id, 'west', e);
              }}
              onPointerEnter={() => onAnchorHover?.(object.id, 'west')}
              onPointerLeave={() => onAnchorHover?.(object.id, null)}
            />
          </>
        )}

        {/* Resize handles - only show when component is selected */}
        {object.selected && onResizeStart && (
          <>
            {/* Northwest resize handle */}
            <div
              className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-500 bg-white cursor-nw-resize hover:border-blue-500 hover:bg-blue-50 transition-colors hover:scale-110 active:scale-95 pointer-events-auto"
              style={{
                left: '0px',
                top: '0px',
                zIndex: 10
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (onResizeStart) {
                  onResizeStart(object.id, 'nw', e);
                }
              }}
            />
            
            {/* Northeast resize handle */}
            <div
              className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-500 bg-white cursor-ne-resize hover:border-blue-500 hover:bg-blue-50 transition-colors hover:scale-110 active:scale-95 pointer-events-auto"
              style={{
                left: '100%',
                top: '0px',
                zIndex: 10
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (onResizeStart) {
                  onResizeStart(object.id, 'ne', e);
                }
              }}
            />
            
            {/* Southwest resize handle */}
            <div
              className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-500 bg-white cursor-sw-resize hover:border-blue-500 hover:bg-blue-50 transition-colors hover:scale-110 active:scale-95 pointer-events-auto"
              style={{
                left: '0px',
                top: '100%',
                zIndex: 10
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (onResizeStart) {
                  onResizeStart(object.id, 'sw', e);
                }
              }}
            />
            
            {/* Southeast resize handle */}
            <div
              className="absolute w-3 h-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-slate-500 bg-white cursor-se-resize hover:border-blue-500 hover:bg-blue-50 transition-colors hover:scale-110 active:scale-95 pointer-events-auto"
              style={{
                left: '100%',
                top: '100%',
                zIndex: 10
              }}
              onPointerDown={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (onResizeStart) {
                  onResizeStart(object.id, 'se', e);
                }
              }}
            />
          </>
        )}
      </div>
    </div>
  );
}

export function ObjectLayer({
  objects,
  transform,
  onDragStart,
  onDragMove,
  onDragEnd,
  onResizeStart,
  onResizeMove,
  onResizeEnd,
  onContextMenu,
  onDimensionsMeasured,
  onConnectionStart,
  onAnchorHover,
  hoveredAnchor,
  connections,
  getConnectionsByAnchor,
  activeSessionId,
  isDragging,
  isResizing,
  isConnectionMode,
  dragState,
  resizeState
}: ObjectLayerProps) {
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
        {sortedObjects.map((object) => (
          <CanvasObjectItem
            key={object.id}
            object={object}
            transform={transform}
            isDragging={isDragging}
            isResizing={isResizing}
            isConnectionMode={isConnectionMode}
            dragState={dragState}
            resizeState={resizeState}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
            onResizeStart={onResizeStart}
            onResizeMove={onResizeMove}
            onResizeEnd={onResizeEnd}
            onContextMenu={onContextMenu}
            onDimensionsMeasured={onDimensionsMeasured}
            onConnectionStart={onConnectionStart}
            onAnchorHover={onAnchorHover}
            hoveredAnchor={hoveredAnchor}
            connections={connections}
            getConnectionsByAnchor={getConnectionsByAnchor}
            activeSessionId={activeSessionId}
          />
        ))}
      </div>
    </div>
  );
}
