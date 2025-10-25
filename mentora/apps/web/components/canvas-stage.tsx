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

type LassoState = {
  pointerId: number;
  originScreen: { x: number; y: number };
  currentScreen: { x: number; y: number };
  originWorld: { x: number; y: number };
  currentWorld: { x: number; y: number };
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
  const zoomHandlerRef = useRef<((event: { transform: { x: number; y: number; k: number } }) => void) | null>(null);

  const [transform, setTransform] = useState<TransformState>(IDENTITY);
  const transformRef = useRef<TransformState>(IDENTITY);

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const canvasObjects = useSessionStore(
    (state) => (state.activeSessionId ? state.canvasObjects[state.activeSessionId] ?? [] : [])
  );
  const canvasMode = useSessionStore((state) => state.canvasMode);
  const toggleObjectSelection = useSessionStore((state) => state.toggleObjectSelection);
  const clearObjectSelection = useSessionStore((state) => state.clearObjectSelection);
  const setSelectedObjects = useSessionStore((state) => state.setSelectedObjects);

  const canvasModeRef = useRef(canvasMode);
  useEffect(() => {
    canvasModeRef.current = canvasMode;
  }, [canvasMode]);

  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
  }, [activeSessionId]);

  const canvasObjectsRef = useRef<CanvasObject[]>(canvasObjects);
  useEffect(() => {
    canvasObjectsRef.current = canvasObjects;
  }, [canvasObjects]);

  const previousSelectionRef = useRef<string[] | null>(null);

  const [lasso, setLasso] = useState<LassoState | null>(null);
  const lassoRef = useRef<LassoState | null>(null);
  useEffect(() => {
    lassoRef.current = lasso;
  }, [lasso]);

  const applyTransform = useCallback((nextState: TransformState) => {
    transformRef.current = nextState;
    flushSync(() => {
      setTransform(nextState);
    });
  }, []);

  const screenToWorld = useCallback(
    (point: { x: number; y: number }) => {
      const { x, y, k } = transformRef.current;
      return {
        x: (point.x - x) / k,
        y: (point.y - y) / k
      };
    },
    []
  );

  const selectObjectsInBox = useCallback(
    (start: { x: number; y: number }, end: { x: number; y: number }) => {
      const sessionId = activeSessionIdRef.current;
      if (!sessionId) {
        return [];
      }
      const minX = Math.min(start.x, end.x);
      const maxX = Math.max(start.x, end.x);
      const minY = Math.min(start.y, end.y);
      const maxY = Math.max(start.y, end.y);

      const ids = canvasObjectsRef.current
        .filter((object) => {
          const objMinX = object.x;
          const objMaxX = object.x + object.width;
          const objMinY = object.y;
          const objMaxY = object.y + object.height;
          return objMinX >= minX && objMaxX <= maxX && objMinY >= minY && objMaxY <= maxY;
        })
        .map((object) => object.id);

      setSelectedObjects(sessionId, ids);
      return ids;
    },
    [setSelectedObjects]
  );

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const element = containerRef.current;
    const selection = select(element);
    selectionRef.current = selection;

    const handleZoom = (event: { transform: { x: number; y: number; k: number } }) => {
      if (canvasModeRef.current !== "pan") {
        return;
      }
      const nextState = toState(event.transform);
      applyTransform(nextState);
    };
    zoomHandlerRef.current = handleZoom;

    const zoomBehavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([MIN_SCALE, MAX_SCALE])
      .filter((event) => {
        if (event.ctrlKey && event.type === "wheel") {
          return true;
        }
        return !event.button && event.type !== "dblclick";
      })
      .on("zoom", handleZoom);

    zoomBehaviorRef.current = zoomBehavior;
    selection.call(zoomBehavior);

    const resetTransform = () => {
      applyTransform(IDENTITY);
      selection
        .transition()
        .duration(220)
        .call(zoomBehavior.transform, asZoomTransform(IDENTITY));
    };

    element.addEventListener("dblclick", resetTransform);

    return () => {
      element.removeEventListener("dblclick", resetTransform);
      selection.on(".zoom", null);
    };
  }, [applyTransform]);

  useEffect(() => {
    const zoomBehavior = zoomBehaviorRef.current;
    if (!zoomBehavior) {
      return;
    }
    if (canvasMode === "pan") {
      zoomBehavior.on("zoom", zoomHandlerRef.current);
    } else {
      zoomBehavior.on("zoom", null);
    }
  }, [canvasMode]);

  useEffect(() => {
    if (canvasMode !== "lasso") {
      lassoRef.current = null;
      setLasso(null);
      previousSelectionRef.current = null;
    }
  }, [canvasMode]);

  useEffect(() => {
    return () => {
      if (lassoRef.current) {
        setLasso(null);
        lassoRef.current = null;
      }
    };
  }, []);

  const handleCanvasClick = useCallback(() => {
    if (canvasMode !== "pan") {
      return;
    }
    if (!activeSessionId) {
      return;
    }
    clearObjectSelection(activeSessionId);
  }, [activeSessionId, canvasMode, clearObjectSelection]);

  const handleSelect = useCallback(
    (objectId: string) => {
      if (!activeSessionId) {
        return;
      }
      toggleObjectSelection(activeSessionId, objectId);
    },
    [activeSessionId, toggleObjectSelection]
  );

  const getScreenPoint = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!containerRef.current) {
        return { x: 0, y: 0 };
      }
      const rect = containerRef.current.getBoundingClientRect();
      return {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      };
    },
    []
  );

  const startLasso = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (canvasMode !== "lasso") {
        return;
      }
      event.preventDefault();
      const screenPoint = getScreenPoint(event);
      const worldPoint = screenToWorld(screenPoint);
      const pointerId = event.pointerId;
      event.currentTarget.setPointerCapture(pointerId);
      previousSelectionRef.current = canvasObjectsRef.current
        .filter((object) => object.selected)
        .map((object) => object.id);
      const nextState: LassoState = {
        pointerId,
        originScreen: screenPoint,
        currentScreen: screenPoint,
        originWorld: worldPoint,
        currentWorld: worldPoint
      };
      lassoRef.current = nextState;
      setLasso(nextState);
    },
    [canvasMode, getScreenPoint, screenToWorld]
  );

  const updateLasso = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (canvasMode !== "lasso") {
        return;
      }
      const current = lassoRef.current;
      if (!current) {
        return;
      }
      event.preventDefault();
      const screenPoint = getScreenPoint(event);
      const worldPoint = screenToWorld(screenPoint);
      const nextState: LassoState = {
        ...current,
        currentScreen: screenPoint,
        currentWorld: worldPoint
      };
      lassoRef.current = nextState;
      setLasso(nextState);
      selectObjectsInBox(nextState.originWorld, worldPoint);
    },
    [canvasMode, getScreenPoint, screenToWorld, selectObjectsInBox]
  );

  const finishLasso = useCallback(
    (commit: boolean) => {
      const current = lassoRef.current;
      if (!current) {
        return;
      }
      if (commit) {
        selectObjectsInBox(current.originWorld, current.currentWorld);
        previousSelectionRef.current = null;
      } else {
        const sessionId = activeSessionIdRef.current;
        if (sessionId && previousSelectionRef.current) {
          setSelectedObjects(sessionId, previousSelectionRef.current);
        }
      }
      lassoRef.current = null;
      setLasso(null);
    },
    [selectObjectsInBox, setSelectedObjects]
  );

  const handleLassoPointerUp = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (canvasMode !== "lasso") {
        return;
      }
      const current = lassoRef.current;
      if (current) {
        event.preventDefault();
        event.currentTarget.releasePointerCapture(current.pointerId);
      }
      finishLasso(true);
    },
    [canvasMode, finishLasso]
  );

  const handleLassoPointerCancel = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (canvasMode !== "lasso") {
        return;
      }
      const current = lassoRef.current;
      if (current) {
        event.currentTarget.releasePointerCapture(current.pointerId);
      }
      finishLasso(false);
    },
    [canvasMode, finishLasso]
  );

  const lassoRect = useMemo(() => {
    if (!lasso) {
      return null;
    }
    const { originScreen, currentScreen } = lasso;
    const left = Math.min(originScreen.x, currentScreen.x);
    const top = Math.min(originScreen.y, currentScreen.y);
    const width = Math.abs(originScreen.x - currentScreen.x);
    const height = Math.abs(originScreen.y - currentScreen.y);
    return { left, top, width, height };
  }, [lasso]);

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

  const canvasCursor = canvasMode === "lasso" ? "crosshair" : "grab";

  return (
    <div className="relative h-full w-full overflow-hidden bg-slate-950">
      <div
        className="absolute inset-0"
        ref={containerRef}
        onClick={handleCanvasClick}
        style={{ cursor: canvasCursor }}
      >
        <div className="absolute inset-0 transition-colors" style={backgroundStyle} />
        <ObjectLayer objects={canvasObjects} transform={transform} onSelect={handleSelect} />
        <SelectionLayer objects={canvasObjects} transform={transform} />
        {canvasMode === "lasso" ? (
          <div
            className="absolute inset-0 z-20 select-none"
            style={{ pointerEvents: "auto", cursor: "crosshair" }}
            onPointerDown={startLasso}
            onPointerMove={updateLasso}
            onPointerUp={handleLassoPointerUp}
            onPointerLeave={handleLassoPointerCancel}
            onPointerCancel={handleLassoPointerCancel}
          >
            {lassoRect ? (
              <div
                className="absolute rounded-md border border-sky-400/80 bg-sky-400/10"
                style={{
                  left: lassoRect.left,
                  top: lassoRect.top,
                  width: lassoRect.width,
                  height: lassoRect.height
                }}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
