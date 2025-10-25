'use client';

import { useCallback, useEffect, useRef, useState } from "react";
import { select, zoom, zoomIdentity, type ZoomTransform } from "d3";
import { ObjectLayer } from "@/components/object-layer";
import { SelectionLayer } from "@/components/selection-layer";
import { useSessionStore } from "@/lib/session-store";

const GRID_SIZE = 40;

export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [transform, setTransform] = useState<ZoomTransform>(zoomIdentity);
  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const canvasObjects = useSessionStore(
    (state) => (activeSessionId ? state.canvasObjects[activeSessionId] ?? [] : [])
  );
  const toggleObjectSelection = useSessionStore((state) => state.toggleObjectSelection);
  const clearObjectSelection = useSessionStore((state) => state.clearObjectSelection);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const element = containerRef.current;
    const zoomBehavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.25, 3])
      .on("zoom", (event) => {
        setTransform(event.transform);
      });

    const selection = select(element);
    selection.call(zoomBehavior);

    const resetTransform = () => {
      selection
        .transition()
        .duration(200)
        .call(zoomBehavior.transform, zoomIdentity);
    };

    element.addEventListener("dblclick", resetTransform);

    return () => {
      element.removeEventListener("dblclick", resetTransform);
      selection.on(".zoom", null);
    };
  }, []);

  const handleCanvasClick = useCallback(() => {
    if (!activeSessionId) {
      return;
    }
    clearObjectSelection(activeSessionId);
  }, [activeSessionId, clearObjectSelection]);

  const handleSelect = useCallback(
    (objectId: string) => {
      if (!activeSessionId) {
        return;
      }
      toggleObjectSelection(activeSessionId, objectId);
    },
    [activeSessionId, toggleObjectSelection]
  );

  const backgroundStyle = {
    backgroundImage: `
      linear-gradient(90deg, rgba(56, 68, 90, 0.2) 1px, transparent 1px),
      linear-gradient(rgba(56, 68, 90, 0.2) 1px, transparent 1px)
    `,
    backgroundSize: `${GRID_SIZE}px ${GRID_SIZE}px`,
    backgroundPosition: `${transform.x % GRID_SIZE}px ${transform.y % GRID_SIZE}px`
  } as const;

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950" ref={containerRef} onClick={handleCanvasClick}>
      <div className="absolute inset-0 transition-colors" style={backgroundStyle} />
      <ObjectLayer objects={canvasObjects} transform={transform} onSelect={handleSelect} />
      <SelectionLayer objects={canvasObjects} transform={transform} />
    </div>
  );
}
