'use client';

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { select, zoom, zoomIdentity } from "d3";
import { MapPin } from "lucide-react";
import { ObjectLayer } from "@/components/object-layer";
import { PinLayer } from "@/components/pin-layer";
import { SelectionLayer } from "@/components/selection-layer";
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/session-store";
import type { CanvasObject, Pin } from "@/types";

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

type PinDraft = {
  screen: { x: number; y: number };
  world: { x: number; y: number };
  label: string;
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
  const stageSizeRef = useRef<{ width: number; height: number } | null>(null);
  const [stageSize, setStageSize] = useState<{ width: number; height: number } | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

const activeSessionId = useSessionStore((state) => state.activeSessionId);
const canvasObjects = useSessionStore(
  (state) => (state.activeSessionId ? state.canvasObjects[state.activeSessionId] ?? [] : [])
);
const canvasMode = useSessionStore((state) => state.canvasMode);
const toggleObjectSelection = useSessionStore((state) => state.toggleObjectSelection);
const clearObjectSelection = useSessionStore((state) => state.clearObjectSelection);
const setSelectedObjects = useSessionStore((state) => state.setSelectedObjects);
const setCanvasView = useSessionStore((state) => state.setCanvasView);
const focusTarget = useSessionStore((state) => state.focusTarget);
const clearFocus = useSessionStore((state) => state.clearFocus);
const pins = useSessionStore((state) =>
  state.activeSessionId ? state.pins[state.activeSessionId] ?? [] : []
);
const addPin = useSessionStore((state) => state.addPin);
const setCanvasMode = useSessionStore((state) => state.setCanvasMode);
const savedCanvasView = useSessionStore((state) =>
  state.activeSessionId ? state.canvasViews[state.activeSessionId] : null
);

  const canvasModeRef = useRef(canvasMode);
  useEffect(() => {
    canvasModeRef.current = canvasMode;
  }, [canvasMode]);

  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    initialPinCenteredRef.current = null;
    setIsInitialized(false); // Reset initialization when session changes
  }, [activeSessionId]);

  useEffect(() => {
    if (canvasModeRef.current === "pin") {
      setCanvasMode("pan");
    }
    setPinDraft(null);
  }, [activeSessionId, setCanvasMode]);

  const canvasObjectsRef = useRef<CanvasObject[]>(canvasObjects);
  useEffect(() => {
    canvasObjectsRef.current = canvasObjects;
  }, [canvasObjects]);

const previousSelectionRef = useRef<string[] | null>(null);
const [pinDraft, setPinDraft] = useState<PinDraft | null>(null);
const pinInputRef = useRef<HTMLInputElement | null>(null);
const initialPinCenteredRef = useRef<string | null>(null);

  const [lasso, setLasso] = useState<LassoState | null>(null);
  const lassoRef = useRef<LassoState | null>(null);
  useEffect(() => {
    lassoRef.current = lasso;
  }, [lasso]);

  useEffect(() => {
    if (pinDraft && pinInputRef.current) {
      pinInputRef.current.focus();
      // Don't select text - just place cursor at end
      const length = pinInputRef.current.value.length;
      pinInputRef.current.setSelectionRange(length, length);
    }
  }, [pinDraft]);

  const applyTransform = useCallback(
    (nextState: TransformState, sessionId?: string) => {
      transformRef.current = nextState;
      setTransform(nextState);
      const targetSessionId = sessionId || activeSessionIdRef.current;
      if (targetSessionId) {
        setCanvasView(targetSessionId, { transform: nextState, stageSize: stageSizeRef.current });
      }
    },
    [setCanvasView]
  );

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

    return () => {
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
    if (canvasMode !== "pin") {
      setPinDraft(null);
    }
  }, [canvasMode]);

  useEffect(() => {
    const element = containerRef.current;
    if (!element) {
      return;
    }
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      const size = { width: rect.width, height: rect.height };
      stageSizeRef.current = size;
      setStageSize(size);
      // Don't save to store here - let the initialization effect handle it
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [activeSessionId]);

  const lastLoadedSessionRef = useRef<string | null>(null);

  // Restore or initialize canvas view when switching sessions
  useEffect(() => {
    if (!activeSessionId) {
      console.log('❌ No activeSessionId');
      return;
    }

    // Only restore/center when switching to a different session (and already initialized)
    if (lastLoadedSessionRef.current === activeSessionId && isInitialized) {
      console.log('✅ Already initialized for this session');
      return;
    }

    const stage = stageSizeRef.current;
    console.log('📐 Stage size:', stage);
    if (!stage || stage.width === 0 || stage.height === 0) {
      console.log('❌ Stage not ready');
      return;
    }

    // Read the current saved view from the store
    const currentSavedView = useSessionStore.getState().canvasViews[activeSessionId];
    console.log('💾 Saved view:', currentSavedView);

    // Check if this session has a saved canvas view
    if (currentSavedView && currentSavedView.transform) {
      // Restore saved transform
      const savedTransform = currentSavedView.transform;
      console.log('🔄 Restoring saved transform:', savedTransform);
      transformRef.current = savedTransform;
      setTransform(savedTransform);
      // Update d3 zoom without triggering events
      const selection = selectionRef.current;
      const zoomBehavior = zoomBehaviorRef.current;
      if (selection && zoomBehavior) {
        // Temporarily disable the zoom handler to prevent saving
        zoomBehavior.on('zoom', null);
        selection.call(zoomBehavior.transform, asZoomTransform(savedTransform));
        // Re-enable zoom handler
        zoomBehavior.on('zoom', zoomHandlerRef.current);
      }
    } else {
      // First time viewing this session - center it
      // Account for floating UI: header at top (~80px), prompt at bottom (~80px)
      // Visual center is between these elements
      const headerHeight = 80; // Approximate height of floating header + margin
      const promptHeight = 80; // Approximate height of prompt bubble + margin
      const visualHeight = stage.height - headerHeight - promptHeight;

      const centerTransform: TransformState = {
        x: stage.width / 2,
        y: headerHeight + (visualHeight / 2),
        k: 1
      };
      console.log('🎯 Centering new session with transform:', centerTransform);
      transformRef.current = centerTransform;
      setTransform(centerTransform);
      // Update d3 zoom without triggering events
      const selection = selectionRef.current;
      const zoomBehavior = zoomBehaviorRef.current;
      if (selection && zoomBehavior) {
        // Temporarily disable the zoom handler to prevent double-save
        zoomBehavior.on('zoom', null);
        selection.call(zoomBehavior.transform, asZoomTransform(centerTransform));
        // Re-enable zoom handler
        zoomBehavior.on('zoom', zoomHandlerRef.current);
      }
      // Save the initial centered position
      setCanvasView(activeSessionId, { transform: centerTransform, stageSize: stage });
    }

    lastLoadedSessionRef.current = activeSessionId;
    setIsInitialized(true); // Mark as initialized after transform is set
    console.log('✅ Initialization complete, isInitialized =', true);
  }, [activeSessionId, stageSize, setCanvasView]);

  useEffect(() => {
    if (!focusTarget) {
      return;
    }
    const stageSize = stageSizeRef.current;
    if (!stageSize) {
      clearFocus();
      return;
    }
    const currentScale = transformRef.current.k;
    const nextTransform: TransformState = {
      k: currentScale,
      x: stageSize.width / 2 - focusTarget.x * currentScale,
      y: stageSize.height / 2 - focusTarget.y * currentScale
    };
    applyTransform(nextTransform);
    const selection = selectionRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (selection && zoomBehavior) {
      selection.call(zoomBehavior.transform, asZoomTransform(nextTransform));
    }
    clearFocus();
  }, [focusTarget, applyTransform, clearFocus]);

  // Disabled: Don't auto-center on first pin
  // useEffect(() => {
  //   if (!activeSessionId || !stageSize) {
  //     return;
  //   }
  //   if (initialPinCenteredRef.current === activeSessionId) {
  //     return;
  //   }
  //   const sessionPins = pins;
  //   if (!sessionPins || sessionPins.length === 0) {
  //     return;
  //   }
  //   const stage = stageSizeRef.current ?? stageSize;
  //   if (!stage) {
  //     return;
  //   }
  //   const pin = sessionPins[0];
  //   const scale = transformRef.current.k;
  //   const nextTransform: TransformState = {
  //     k: scale,
  //     x: stage.width / 2 - pin.x * scale,
  //     y: stage.height / 2 - pin.y * scale
  //   };
  //   applyTransform(nextTransform);
  //   const selection = selectionRef.current;
  //   const zoomBehavior = zoomBehaviorRef.current;
  //   if (selection && zoomBehavior) {
  //     selection.call(zoomBehavior.transform, asZoomTransform(nextTransform));
  //   }
  //   initialPinCenteredRef.current = activeSessionId;
  // }, [activeSessionId, stageSize, pins, applyTransform]);

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

  const handlePinFocus = useCallback(
    (pin: Pin) => {
      // Don't auto-focus on pin click - keep canvas where it is
    },
    []
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

  const startPinPlacement = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (canvasMode !== "pin" || pinDraft) {
        return;
      }
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      if (!activeSessionIdRef.current) {
        setCanvasMode("pan");
        return;
      }
      const screenPoint = getScreenPoint(event);
      const worldPoint = screenToWorld(screenPoint);
      setPinDraft({
        screen: screenPoint,
        world: worldPoint,
        label: ""
      });
    },
    [canvasMode, pinDraft, getScreenPoint, screenToWorld, setCanvasMode]
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

  const handlePinLabelChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setPinDraft((draft) => {
      if (!draft) {
        return draft;
      }
      return { ...draft, label: value };
    });
  }, []);

  const commitPinDraft = useCallback(() => {
    if (!pinDraft || !activeSessionId) {
      setPinDraft(null);
      setCanvasMode("pan");
      return;
    }
    addPin(activeSessionId, {
      x: pinDraft.world.x,
      y: pinDraft.world.y,
      label: pinDraft.label.trim() || undefined
    });
    // Don't requestFocus - keep canvas where it is
    setPinDraft(null);
    setCanvasMode("pan");
  }, [pinDraft, activeSessionId, addPin, setCanvasMode]);

  const cancelPinDraft = useCallback(() => {
    setPinDraft(null);
    setCanvasMode("pan");
  }, [setCanvasMode]);

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

  const canvasCursor = canvasMode === "pan" ? "grab" : "crosshair";

  return (
    <div className="absolute inset-0 overflow-hidden bg-slate-950">
      <div
        className="absolute inset-0"
        ref={containerRef}
        onClick={handleCanvasClick}
        onPointerDown={startPinPlacement}
        style={{ cursor: canvasCursor }}
      >
        <div className="absolute inset-0 transition-colors" style={backgroundStyle} />
        {isInitialized && (
          <>
            <ObjectLayer objects={canvasObjects} transform={transform} onSelect={handleSelect} />
            <PinLayer
              pins={pins}
              transform={transform}
              interactive={canvasMode !== "pin"}
              onFocus={handlePinFocus}
            />
          </>
        )}
        {pinDraft ? (
          <div className="pointer-events-none absolute inset-0 z-30">
            <div
              className="pointer-events-auto absolute w-56 -translate-x-1/2"
              style={{ left: pinDraft.screen.x, top: pinDraft.screen.y - 40, transform: 'translate(-50%, -100%)' }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="rounded-lg border border-border bg-slate-950/95 p-3 shadow-xl">
              <form
                className="flex flex-col gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  commitPinDraft();
                }}
              >
                <label className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Pin name
                  <input
                    ref={pinInputRef}
                    className="mt-1 w-full rounded-md border border-border bg-slate-900 px-2 py-1 text-sm text-slate-100 focus:outline-none focus:ring-2 focus:ring-sky-400"
                    value={pinDraft.label}
                    onChange={handlePinLabelChange}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelPinDraft();
                      }
                    }}
                    placeholder="e.g. Entry Node"
                  />
                </label>
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="ghost" size="sm" onClick={cancelPinDraft}>
                    Cancel
                  </Button>
                  <Button type="submit" variant="secondary" size="sm">
                    Save
                  </Button>
                </div>
              </form>
              </div>
            </div>
            {/* Pin preview icon */}
            <div
              className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
              style={{ left: pinDraft.screen.x, top: pinDraft.screen.y }}
            >
              <MapPin className="h-6 w-6 text-sky-400 drop-shadow-lg" fill="currentColor" />
            </div>
          </div>
        ) : null}
        {isInitialized && <SelectionLayer objects={canvasObjects} transform={transform} />}
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
