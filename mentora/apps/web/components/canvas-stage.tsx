'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { select, zoom, zoomIdentity } from "d3";
import { ObjectLayer } from "@/components/object-layer";
import { SelectionLayer } from "@/components/selection-layer";
import { useSessionStore } from "@/lib/session-store";
import type { CanvasObject } from "@/types";

const GRID_SIZE = 40;
const MIN_SCALE = 0.25;
const MAX_SCALE = 3;

type TransformState = {
  x: number;
  y: number;
  k: number;
};

const IDENTITY: TransformState = { x: 0, y: 0, k: 1 };

const toState = (transform: { x: number; y: number; k: number }): TransformState => ({
  x: transform.x,
  y: transform.y,
  k: transform.k
});

const asZoomTransform = ({ x, y, k }: TransformState) =>
  zoomIdentity.translate(x, y).scale(k);

export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<ReturnType<typeof select<HTMLDivElement, unknown>>>();
  const zoomBehaviorRef = useRef<ReturnType<typeof zoom<HTMLDivElement, unknown>>>();
  const [transform, setTransform] = useState<TransformState>(IDENTITY);
  const transformRef = useRef<TransformState>(IDENTITY);

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
    const selection = select(element);
    selectionRef.current = selection;

    const zoomBehavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .filter((event) => {
        if (event.ctrlKey && event.type === "wheel") {
          // Allow pinch-to-zoom gesture.
          return true;
        }
        // Prevent right-click / wheel button and double click zoom.
        return !event.button && event.type !== "dblclick";
      })
      .on("zoom", (event) => {
        const nextState = toState(event.transform);
        transformRef.current = nextState;
        flushSync(() => {
          setTransform(nextState);
        });
      });

    zoomBehaviorRef.current = zoomBehavior;
    selection.call(zoomBehavior);

    const resetTransform = () => {
      const zoomTransform = asZoomTransform(IDENTITY);
      transformRef.current = IDENTITY;
      flushSync(() => {
        setTransform(IDENTITY);
      });
      selection
        .transition()
        .duration(220)
        .call(zoomBehavior.transform, zoomTransform);
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

  const backgroundStyle = useMemo(() => {
    const scaledGrid = Math.max(GRID_SIZE * transform.k, 6);
    const offsetX = ((transform.x % scaledGrid) + scaledGrid) % scaledGrid;
    const offsetY = ((transform.y % scaledGrid) + scaledGrid) % scaledGrid;

    return {
      backgroundImage: `
        linear-gradient(90deg, rgba(56, 68, 90, 0.2) 1px, transparent 1px),
        linear-gradient(rgba(56, 68, 90, 0.2) 1px, transparent 1px)
      `,
      backgroundSize: `${scaledGrid}px ${scaledGrid}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`
    };
  }, [transform.x, transform.y, transform.k]);

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-slate-950"
      ref={containerRef}
      onClick={handleCanvasClick}
    >
      <div className="absolute inset-0 transition-colors" style={backgroundStyle} />
      <ObjectLayer objects={canvasObjects} transform={transform} onSelect={handleSelect} />
      <SelectionLayer objects={canvasObjects} transform={transform} />
    </div>
  );
}
