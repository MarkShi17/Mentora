'use client';

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { select, zoom, zoomIdentity } from "d3";
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

type DragState = {
  objectId: string; // Primary object being dragged (for pointer events)
  selectedObjectIds: string[]; // ALL objects being moved as a group
  startWorld: { x: number; y: number };
  startScreen: { x: number; y: number };
  startPositions: Record<string, { x: number; y: number }>; // Initial positions of ALL objects
  currentDelta: { x: number; y: number };
  wasSelectedAtStart: boolean;
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
  const [isInitialized, setIsInitialized] = useState(false);
  const lastLoadedSessionRef = useRef<string | null>(null);

const activeSessionId = useSessionStore((state) => state.activeSessionId);
const canvasObjects = useSessionStore(
  (state) => (state.activeSessionId ? state.canvasObjects[state.activeSessionId] ?? [] : [])
);
const canvasMode = useSessionStore((state) => state.canvasMode);
const toggleObjectSelection = useSessionStore((state) => state.toggleObjectSelection);
const clearObjectSelection = useSessionStore((state) => state.clearObjectSelection);
const setSelectedObjects = useSessionStore((state) => state.setSelectedObjects);
const setSelectionMethod = useSessionStore((state) => state.setSelectionMethod);
const setLastSelectedObject = useSessionStore((state) => state.setLastSelectedObject);
const selectionMethod = useSessionStore((state) =>
  state.activeSessionId ? state.selectionMethods[state.activeSessionId] : undefined
);
const lastSelectedObjectId = useSessionStore((state) =>
  state.activeSessionId ? state.lastSelectedObjectIds[state.activeSessionId] : null
);
const setCanvasView = useSessionStore((state) => state.setCanvasView);
const focusTarget = useSessionStore((state) => state.focusTarget);
const clearFocus = useSessionStore((state) => state.clearFocus);
const pins = useSessionStore((state) =>
  state.activeSessionId ? state.pins[state.activeSessionId] ?? [] : []
);
const requestFocus = useSessionStore((state) => state.requestFocus);
const addPin = useSessionStore((state) => state.addPin);
const setCanvasMode = useSessionStore((state) => state.setCanvasMode);
const updateCanvasObject = useSessionStore((state) => state.updateCanvasObject);
const updateCanvasObjects = useSessionStore((state) => state.updateCanvasObjects);
const bringToFront = useSessionStore((state) => state.bringToFront);
const stageSize = useSessionStore((state) =>
  state.activeSessionId ? state.canvasViews[state.activeSessionId]?.stageSize : null
);

  const canvasModeRef = useRef(canvasMode);
  useEffect(() => {
    canvasModeRef.current = canvasMode;
  }, [canvasMode]);

  const activeSessionIdRef = useRef(activeSessionId);
  useEffect(() => {
    activeSessionIdRef.current = activeSessionId;
    initialPinCenteredRef.current = null;
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

  // Object dragging state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const dragStateRef = useRef<DragState | null>(null);
  useEffect(() => {
    dragStateRef.current = dragState;
  }, [dragState]);

  useEffect(() => {
    if (pinDraft && pinInputRef.current) {
      pinInputRef.current.focus();
      pinInputRef.current.select();
    }
  }, [pinDraft]);

  const applyTransform = useCallback(
    (nextState: TransformState) => {
      transformRef.current = nextState;
      setTransform(nextState);
      if (activeSessionId) {
        setCanvasView(activeSessionId, { transform: nextState, stageSize: stageSizeRef.current });
      }
    },
    [setCanvasView, activeSessionId]
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
          // Check for intersection (partial overlap) instead of full containment
          return objMaxX >= minX && objMinX <= maxX && objMaxY >= minY && objMinY <= maxY;
        })
        .map((object) => object.id);

      setSelectedObjects(sessionId, ids);
      setSelectionMethod(sessionId, "lasso");
      return ids;
    },
    [setSelectedObjects, setSelectionMethod]
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

        // Don't activate zoom if clicking on a canvas object
        const target = event.target as HTMLElement;
        const isObjectClick = target.closest('[data-canvas-object="true"]');
        if (isObjectClick) {
          return false;
        }

        return !event.button;
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
    if (!element || !activeSessionId) {
      return;
    }
    const updateSize = () => {
      const rect = element.getBoundingClientRect();
      stageSizeRef.current = { width: rect.width, height: rect.height };
      // Only save after initialization to avoid saving IDENTITY before centering
      if (activeSessionId && isInitialized) {
        setCanvasView(activeSessionId, { transform: transformRef.current, stageSize: stageSizeRef.current });
      }
    };
    updateSize();
    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [setCanvasView, activeSessionId, isInitialized]);

  useEffect(() => {
    // Only save after initialization to avoid saving IDENTITY before centering
    if (activeSessionId && isInitialized) {
      setCanvasView(activeSessionId, { transform: transformRef.current, stageSize: stageSizeRef.current });
    }
  }, [transform, setCanvasView, activeSessionId, isInitialized]);

  // Center canvas on initial load or session switch
  useEffect(() => {
    if (!activeSessionId) {
      return;
    }

    if (lastLoadedSessionRef.current === activeSessionId && isInitialized) {
      return;
    }

    const stage = stageSizeRef.current;
    if (!stage) {
      return;
    }

    // Check if there's a saved canvas view for this session
    const state = useSessionStore.getState();
    const savedView = state.canvasViews[activeSessionId];

    if (savedView && savedView.stageSize) {
      // Restore saved view
      const savedTransform = savedView.transform;
      transformRef.current = savedTransform;
      setTransform(savedTransform);
      const selection = selectionRef.current;
      const zoomBehavior = zoomBehaviorRef.current;
      if (selection && zoomBehavior) {
        selection.call(zoomBehavior.transform, asZoomTransform(savedTransform));
      }
    } else {
      // Calculate center transform
      // Account for floating header (80px) and prompt bar (80px)
      const headerHeight = 80;
      const promptHeight = 80;
      const visualHeight = stage.height - headerHeight - promptHeight;

      const centerTransform: TransformState = {
        x: stage.width / 2,
        y: headerHeight + (visualHeight / 2),
        k: 1
      };

      transformRef.current = centerTransform;
      setTransform(centerTransform);
      const selection = selectionRef.current;
      const zoomBehavior = zoomBehaviorRef.current;
      if (selection && zoomBehavior) {
        selection.call(zoomBehavior.transform, asZoomTransform(centerTransform));
      }
      setCanvasView(activeSessionId, { transform: centerTransform, stageSize: stage });
    }

    setIsInitialized(true);
    lastLoadedSessionRef.current = activeSessionId;
  }, [activeSessionId, stageSize, setCanvasView, isInitialized]);

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

  useEffect(() => {
    if (!activeSessionId || !stageSize) {
      return;
    }
    if (initialPinCenteredRef.current === activeSessionId) {
      return;
    }
    const sessionPins = pins;
    if (!sessionPins || sessionPins.length === 0) {
      return;
    }
    const stage = stageSizeRef.current ?? stageSize;
    if (!stage) {
      return;
    }
    const pin = sessionPins[0];
    const scale = transformRef.current.k;
    const nextTransform: TransformState = {
      k: scale,
      x: stage.width / 2 - pin.x * scale,
      y: stage.height / 2 - pin.y * scale
    };
    applyTransform(nextTransform);
    const selection = selectionRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (selection && zoomBehavior) {
      selection.call(zoomBehavior.transform, asZoomTransform(nextTransform));
    }
    initialPinCenteredRef.current = activeSessionId;
  }, [activeSessionId, stageSize, pins, applyTransform]);

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
    (objectId: string, event: React.MouseEvent) => {
      if (!activeSessionId) {
        return;
      }
      // Bring object to front when selected
      bringToFront(activeSessionId, objectId);

      // Check for Cmd (Mac) or Ctrl (Windows/Linux) for multi-select
      const isMultiSelect = event.ctrlKey || event.metaKey;
      toggleObjectSelection(activeSessionId, objectId, isMultiSelect);
      setSelectionMethod(activeSessionId, "click");
      setLastSelectedObject(activeSessionId, objectId);
    },
    [activeSessionId, toggleObjectSelection, setSelectionMethod, setLastSelectedObject, bringToFront]
  );

  const handlePinFocus = useCallback(
    (pin: Pin) => {
      requestFocus({ id: pin.id, x: pin.x, y: pin.y });
    },
    [requestFocus]
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

  const handleObjectDragStart = useCallback(
    (objectId: string, event: React.PointerEvent) => {
      if (!activeSessionId || canvasMode !== "pan") {
        return;
      }
      event.stopPropagation();

      // Get fresh object state from store (not ref)
      const state = useSessionStore.getState();
      const objects = state.canvasObjects[activeSessionId] || [];
      const object = objects.find(obj => obj.id === objectId);

      if (!object) {
        return;
      }

      // Check if multi-select is active
      const isMultiSelect = event.ctrlKey || event.metaKey;

      // Get max zIndex once
      const maxZIndex = Math.max(...objects.map(obj => obj.zIndex || 0), 0);

      // Handle selection based on mode and current state
      if (isMultiSelect) {
        // Multi-select mode (Cmd/Ctrl held): just ensure this object is selected, keep others as-is
        const freshState = useSessionStore.getState();
        const freshObject = freshState.canvasObjects[activeSessionId]?.find(obj => obj.id === objectId);

        if (freshObject) {
          updateCanvasObject(activeSessionId, {
            ...freshObject,
            selected: true,
            zIndex: maxZIndex + 1
          });
        }
      } else if (object.selected) {
        // Object is already selected - keep all selections (group drag)
        // Just bring this object to front
        const freshState = useSessionStore.getState();
        const freshObject = freshState.canvasObjects[activeSessionId]?.find(obj => obj.id === objectId);

        if (freshObject) {
          updateCanvasObject(activeSessionId, {
            ...freshObject,
            zIndex: maxZIndex + 1,
            selected: true
          });
        }
      } else {
        // Object not selected - single-select mode: clear ALL other selections, select only this one
        const freshState = useSessionStore.getState();
        const freshObjects = freshState.canvasObjects[activeSessionId] || [];

        const updatedObjects = freshObjects.map(obj =>
          obj.id === objectId
            ? { ...obj, selected: true, zIndex: maxZIndex + 1 }
            : { ...obj, selected: false }
        );
        updateCanvasObjects(activeSessionId, updatedObjects);
      }

      // Get screen point and convert to world coordinates
      const screenPoint = getScreenPoint(event);
      const worldPoint = screenToWorld(screenPoint);

      // Get ALL currently selected objects after selection updates
      const freshState = useSessionStore.getState();
      const freshObjects = freshState.canvasObjects[activeSessionId] || [];
      const selectedObjects = freshObjects.filter(obj => obj.selected);
      const selectedObjectIds = selectedObjects.map(obj => obj.id);

      // Store initial positions for ALL selected objects
      const startPositions: Record<string, { x: number; y: number }> = {};
      selectedObjects.forEach(obj => {
        startPositions[obj.id] = { x: obj.x, y: obj.y };
      });

      // Set drag state - track all selected objects for group dragging
      const nextDragState: DragState = {
        objectId,
        selectedObjectIds,
        startWorld: worldPoint,
        startScreen: screenPoint,
        startPositions,
        currentDelta: { x: 0, y: 0 },
        wasSelectedAtStart: true // Always true now since we just selected it
      };
      dragStateRef.current = nextDragState;
      setDragState(nextDragState);

      // Capture pointer
      event.currentTarget.setPointerCapture(event.pointerId);
    },
    [activeSessionId, canvasMode, getScreenPoint, screenToWorld, updateCanvasObject, updateCanvasObjects]
  );

  const handleObjectDragMove = useCallback(
    (objectId: string, event: React.PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag || drag.objectId !== objectId) {
        return;
      }

      event.stopPropagation();

      // Get current world position
      const screenPoint = getScreenPoint(event);
      const worldPoint = screenToWorld(screenPoint);

      // Calculate delta in world coordinates
      const deltaX = worldPoint.x - drag.startWorld.x;
      const deltaY = worldPoint.y - drag.startWorld.y;

      // Update drag state with current delta (for visual transform)
      const nextDragState: DragState = {
        ...drag,
        currentDelta: { x: deltaX, y: deltaY }
      };
      dragStateRef.current = nextDragState;
      setDragState(nextDragState);
    },
    [getScreenPoint, screenToWorld]
  );

  const handleObjectDragEnd = useCallback(
    (objectId: string, event: React.PointerEvent) => {
      const drag = dragStateRef.current;
      if (!drag || drag.objectId !== objectId || !activeSessionId) {
        return;
      }

      event.stopPropagation();

      const screenPoint = getScreenPoint(event);
      const worldPoint = screenToWorld(screenPoint);

      const screenDeltaX = screenPoint.x - drag.startScreen.x;
      const screenDeltaY = screenPoint.y - drag.startScreen.y;
      const worldDeltaX = worldPoint.x - drag.startWorld.x;
      const worldDeltaY = worldPoint.y - drag.startWorld.y;

      // Calculate total movement distance in screen pixels to determine if it was a click or drag
      const totalScreenMovement = Math.hypot(screenDeltaX, screenDeltaY);
      const CLICK_THRESHOLD = 5; // screen pixels
      const wasClick = totalScreenMovement < CLICK_THRESHOLD;

      // Get fresh state from store
      const state = useSessionStore.getState();
      const objects = state.canvasObjects[activeSessionId] || [];
      const object = objects.find(obj => obj.id === objectId);

      if (!object) {
        return;
      }

      // Get the highest zIndex to bring this object to front
      const maxZIndex = Math.max(...objects.map(obj => obj.zIndex || 0), 0);

      // Always read FRESH state right before final update to avoid stale data
      const finalState = useSessionStore.getState();
      const finalObjects = finalState.canvasObjects[activeSessionId] || [];
      const finalObject = finalObjects.find(obj => obj.id === objectId);

      if (!finalObject) {
        console.error('[DragEnd] Object not found in store:', objectId);
        return;
      }

      // Check if multi-select at drag end (should match drag start)
      const isMultiSelectEnd = event.ctrlKey || event.metaKey;

      // Handle based on whether it was a click or drag
      if (wasClick) {
        // It was a click - selection already handled at drag start
        // Just ensure zIndex is updated and selection is preserved
        if (isMultiSelectEnd) {
          // Multi-select: just update this object
          updateCanvasObject(activeSessionId, {
            ...finalObject,
            zIndex: maxZIndex + 1,
            selected: true
          });
        } else {
          // Single-select: ensure ONLY this object is selected (in case other objects were selected)
          const updatedObjects = finalObjects.map(obj =>
            obj.id === objectId
              ? { ...obj, zIndex: maxZIndex + 1, selected: true }
              : { ...obj, selected: false }
          );
          updateCanvasObjects(activeSessionId, updatedObjects);
        }

        setSelectionMethod(activeSessionId, "click");
        setLastSelectedObject(activeSessionId, objectId);
      } else {
        // It was a drag - update positions for ALL objects in the drag group
        const draggedObjectIds = drag.selectedObjectIds || [objectId];

        // Calculate base zIndex for the group
        let nextZIndex = maxZIndex + 1;

        // Update all objects: move dragged group, handle selection
        const updatedObjects = finalObjects.map(obj => {
          if (draggedObjectIds.includes(obj.id)) {
            // This object is part of the drag group - move it
            const startPos = drag.startPositions[obj.id] || { x: obj.x, y: obj.y };
            return {
              ...obj,
              x: startPos.x + worldDeltaX,
              y: startPos.y + worldDeltaY,
              zIndex: nextZIndex++, // Increment for each dragged object
              selected: true
            };
          } else if (isMultiSelectEnd) {
            // Multi-select mode: preserve other objects' selection state
            return obj;
          } else {
            // Single-select mode: clear selection on other objects
            return { ...obj, selected: false };
          }
        });

        updateCanvasObjects(activeSessionId, updatedObjects);

        setSelectionMethod(activeSessionId, "click");
        setLastSelectedObject(activeSessionId, objectId);
      }

      // Release pointer capture
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }

      // Clear drag state
      dragStateRef.current = null;
      setDragState(null);
    },
    [activeSessionId, updateCanvasObject, updateCanvasObjects, setSelectionMethod, setLastSelectedObject, getScreenPoint, screenToWorld]
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
    const newPin = addPin(activeSessionId, {
      x: pinDraft.world.x,
      y: pinDraft.world.y,
      label: pinDraft.label.trim() || undefined
    });
    if (newPin) {
      requestFocus({ id: newPin.id, x: newPin.x, y: newPin.y });
    }
    setPinDraft(null);
    setCanvasMode("pan");
  }, [pinDraft, activeSessionId, addPin, requestFocus, setCanvasMode]);

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
        const selectedIds = selectObjectsInBox(current.originWorld, current.currentWorld);
        previousSelectionRef.current = null;

        // If at least one object was selected, switch back to pan mode (grab cursor)
        if (selectedIds.length > 0) {
          setCanvasMode("pan");
        }
      } else {
        const sessionId = activeSessionIdRef.current;
        if (sessionId && previousSelectionRef.current) {
          setSelectedObjects(sessionId, previousSelectionRef.current);
        }
      }
      lassoRef.current = null;
      setLasso(null);
    },
    [selectObjectsInBox, setSelectedObjects, setCanvasMode]
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
    const dotSize = Math.max(1, Math.min(2, transform.k * 1.5));

    return {
      backgroundImage: `radial-gradient(circle, rgba(203, 213, 225, 0.7) ${dotSize}px, transparent ${dotSize}px)`,
      backgroundSize: `${scaledGrid}px ${scaledGrid}px`,
      backgroundPosition: `${offsetX}px ${offsetY}px`
    };
  }, [transform.x, transform.y, transform.k]);

  const canvasCursor = canvasMode === "pan" ? "grab" : "crosshair";

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
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
            <ObjectLayer
              objects={canvasObjects}
              transform={transform}
              onSelect={handleSelect}
              onDragStart={handleObjectDragStart}
              onDragMove={handleObjectDragMove}
              onDragEnd={handleObjectDragEnd}
              isDragging={!!dragState}
              dragState={dragState}
            />
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
              className="pointer-events-auto absolute w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-border bg-slate-950/95 p-3 shadow-xl"
              style={{ left: pinDraft.screen.x, top: pinDraft.screen.y }}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
            >
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
        ) : null}
        <SelectionLayer
          objects={canvasObjects}
          transform={transform}
          selectionMethod={selectionMethod}
          lastSelectedObjectId={lastSelectedObjectId}
        />
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
