'use client';

import type { CSSProperties } from "react";
import { CanvasObject } from "@/types";
import { cn } from "@/lib/cn";

function getObjectSizeClass(type: string): string {
  switch (type) {
    case 'text':
      return "min-w-[180px] max-w-[350px] w-auto";
    case 'diagram':
    case 'graph':
      return "w-[400px] h-[300px]";
    case 'code':
      return "min-w-[250px] max-w-[500px] w-auto max-h-[250px]";
    case 'latex':
      return "w-auto h-auto min-w-[180px]";
    default:
      return "w-auto h-auto min-w-[180px]";
  }
}

function renderObjectContent(object: CanvasObject) {
  if (!object.data) return null;

  switch (object.type) {
    case 'text':
      return (
        <div className="text-sm text-slate-200 leading-relaxed">
          {object.data.content.split('\n').map((line, index) => (
            <p key={index} className="mb-2 last:mb-0">
              {line.trim() ? (
                line.startsWith('•') ? (
                  <span className="flex items-start">
                    <span className="text-sky-400 mr-2 mt-0.5">•</span>
                    <span>{line.substring(1).trim()}</span>
                  </span>
                ) : (
                  line
                )
              ) : (
                <br />
              )}
            </p>
          ))}
        </div>
      );
    
    case 'diagram':
      return (
        <div className="bg-white rounded p-3 shadow-sm">
          <div 
            className="bg-white rounded"
            dangerouslySetInnerHTML={{ __html: object.data.svg }}
          />
        </div>
      );
    
    case 'code':
      return (
        <pre className="text-xs text-slate-200 bg-slate-800 p-3 rounded overflow-auto max-h-[200px] leading-relaxed">
          <code>{object.data.code}</code>
        </pre>
      );
    
    case 'graph':
      return (
        <div className="bg-white rounded p-3 shadow-sm">
          <div 
            className="bg-white rounded"
            dangerouslySetInnerHTML={{ __html: object.data.svg }}
          />
        </div>
      );
    
    case 'latex':
      return (
        <div className="flex items-center justify-center p-3">
          <img 
            src={object.data.rendered} 
            alt="LaTeX equation" 
            className="max-w-full max-h-[80px]"
          />
        </div>
      );
    
    default:
      return (
        <p className="text-sm text-slate-200">
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
  isDragging?: boolean;
  dragState?: {
    objectId: string;
    startWorld: { x: number; y: number };
    startScreen: { x: number; y: number };
    startObject: { x: number; y: number };
    currentDelta: { x: number; y: number };
    wasSelectedAtStart: boolean;
  } | null;
};

export function ObjectLayer({ objects, transform, onSelect, onDragStart, onDragMove, onDragEnd, isDragging, dragState }: ObjectLayerProps) {
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
          const isBeingDragged = dragState?.objectId === object.id;
          const dragTransform = isBeingDragged && dragState
            ? `translate(${dragState.currentDelta.x}px, ${dragState.currentDelta.y}px)`
            : undefined;

          return (
          <div
            key={object.id}
            data-canvas-object="true"
            className={cn(
              "pointer-events-auto absolute rounded-lg border-2 border-transparent shadow-lg",
              object.selected ? "border-sky-400 shadow-[0_0_20px_rgba(56,189,248,0.35)]" : "border-transparent",
              getObjectSizeClass(object.type),
              isDragging ? "cursor-grabbing" : "cursor-grab",
              !isBeingDragged && "transition-all"
            )}
            style={{
              left: object.x,
              top: object.y,
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
              event.stopPropagation();
              event.preventDefault();
              if (onDragMove) {
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
          >
            <div className="flex flex-col bg-slate-900/70 p-3 backdrop-blur rounded-lg border border-slate-700/50 shadow-lg">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 font-medium">
                    {object.type}
                  </p>
                  <h3 className="mt-0.5 text-sm font-semibold text-slate-50">
                    {object.label}
                  </h3>
                </div>
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: object.color }}></div>
              </div>
              <div className="flex-1">
                {renderObjectContent(object)}
              </div>
              {object.metadata?.description ? (
                <p className="text-xs text-slate-400 mt-2 pt-2 border-t border-slate-700/50">
                  {String(object.metadata.description)}
                </p>
              ) : null}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}
