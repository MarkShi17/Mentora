'use client';

import type { CSSProperties } from "react";
import { CanvasObject } from "@/types";
import { cn } from "@/lib/cn";

// Removed getObjectSizeClass - now using backend-calculated sizes directly

function renderObjectContent(object: CanvasObject) {
  if (!object.data) return null;

  switch (object.type) {
    case 'text':
      return (
        <div className="text-base text-slate-200 leading-relaxed p-2 h-full overflow-auto">
          {object.data.content.split('\n').map((line, index) => (
            <p key={index} className="mb-3 last:mb-0">
              {line.trim() ? (
                line.startsWith('•') ? (
                  <span className="flex items-start">
                    <span className="text-sky-400 mr-3 mt-1 text-lg">•</span>
                    <span className="flex-1">{line.substring(1).trim()}</span>
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
        <div className="bg-white rounded-lg p-4 shadow-lg h-full overflow-auto">
          <div 
            className="bg-white rounded"
            dangerouslySetInnerHTML={{ __html: object.data.svg }}
          />
        </div>
      );
    
    case 'code':
      return (
        <pre className="text-sm text-slate-200 bg-slate-800 p-4 rounded-lg overflow-auto leading-relaxed h-full">
          <code>{object.data.code}</code>
        </pre>
      );
    
    case 'graph':
      return (
        <div className="bg-white rounded-lg p-4 shadow-lg h-full overflow-auto">
          <div 
            className="bg-white rounded"
            dangerouslySetInnerHTML={{ __html: object.data.svg }}
          />
        </div>
      );
    
    case 'latex':
      return (
        <div className="flex items-center justify-center p-4 h-full">
          <img 
            src={object.data.rendered} 
            alt="LaTeX equation" 
            className="max-w-full max-h-full object-contain"
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
  onSelect: (id: string) => void;
};

export function ObjectLayer({ objects, transform, onSelect }: ObjectLayerProps) {
  const stageStyle: CSSProperties = {
    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.k})`,
    transformOrigin: "0 0"
  };

  return (
    <div className="pointer-events-none absolute inset-0">
      <div
        className="relative h-full w-full"
        style={stageStyle}
      >
        {objects.map((object) => (
          <div
            key={object.id}
            className={cn(
              "pointer-events-auto absolute rounded-lg border-2 border-transparent shadow-lg transition-colors",
              object.selected ? "border-sky-400" : "border-transparent"
            )}
            style={{
              left: object.x,
              top: object.y,
              width: object.width || object.size?.width || 'auto',
              height: object.height || object.size?.height || 'auto',
              background: `${object.color}20`
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSelect(object.id);
            }}
          >
            <div className="flex flex-col bg-slate-900/80 p-4 backdrop-blur rounded-lg border border-slate-700/50 shadow-xl h-full">
              <div className="mb-3 flex items-center justify-between flex-shrink-0">
                <div>
                  <p className="text-xs uppercase tracking-wide text-slate-400 font-medium">
                    {object.type}
                  </p>
                  <h3 className="mt-1 text-base font-semibold text-slate-50">
                    {object.label}
                  </h3>
                </div>
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: object.color }}></div>
              </div>
              <div className="flex-1 min-h-0">
                {renderObjectContent(object)}
              </div>
              {object.metadata?.description ? (
                <p className="text-sm text-slate-400 mt-3 pt-3 border-t border-slate-700/50 flex-shrink-0">
                  {String(object.metadata.description)}
                </p>
              ) : null}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
