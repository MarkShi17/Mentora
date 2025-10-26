'use client';

import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { select, zoom, zoomIdentity } from "d3";
import { ObjectLayer } from "@/components/object-layer";
import { PinLayer } from "@/components/pin-layer";
import { ConnectionLayer } from "@/components/connection-layer";
// ObjectContextMenu removed
import { Button } from "@/components/ui/button";
import { useSessionStore } from "@/lib/session-store";
import type { CanvasObject, Pin } from "@/types";
import type { ConnectionAnchor } from "@/types";
import { getHoveredAnchor, getAnchorPosition } from "@/lib/connection-utils";
import { useClipboardPaste } from "@/hooks/use-clipboard-paste";
import { processImageFile } from "@/lib/image-upload";

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

type ConnectionDragState = {
  sourceObjectId: string;
  sourceAnchor: ConnectionAnchor;
  currentWorld: { x: number; y: number }; // Current mouse position
};

type ResizeDirection = 'nw' | 'ne' | 'sw' | 'se';

type ResizeState = {
  objectId: string;
  direction: ResizeDirection;
  startWorld: { x: number; y: number };
  startScreen: { x: number; y: number };
  startSize: { width: number; height: number };
  startPosition: { x: number; y: number };
  currentDelta: { x: number; y: number };
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
  const animationRef = useRef<number | null>(null);

const activeSessionId = useSessionStore((state) => state.activeSessionId);
const canvasObjects = useSessionStore(
  (state) => (state.activeSessionId ? state.canvasObjects[state.activeSessionId] ?? [] : [])
);
const canvasMode = useSessionStore((state) => state.canvasMode);
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
const deleteCanvasObjects = useSessionStore((state) => state.deleteCanvasObjects);
const setSelectedObjects = useSessionStore((state) => state.setSelectedObjects);
const bringToFront = useSessionStore((state) => state.bringToFront);
const stageSize = useSessionStore((state) =>
  state.activeSessionId ? state.canvasViews[state.activeSessionId]?.stageSize : null
);
const connections = useSessionStore((state) =>
  state.activeSessionId ? state.connections[state.activeSessionId] ?? [] : []
);
const createConnection = useSessionStore((state) => state.createConnection);
const deleteConnection = useSessionStore((state) => state.deleteConnection);
const deleteConnectionsByObjectId = useSessionStore((state) => state.deleteConnectionsByObjectId);
const getConnectionsByAnchor = useSessionStore((state) => state.getConnectionsByAnchor);

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
  // Connection dragging state
  const [connectionDragState, setConnectionDragState] = useState<ConnectionDragState | null>(null);
  const connectionDragStateRef = useRef<ConnectionDragState | null>(null);
  useEffect(() => {
    connectionDragStateRef.current = connectionDragState;
  }, [connectionDragState]);

  // Hovered anchor state
  const [hoveredAnchor, setHoveredAnchor] = useState<{ objectId: string; anchor: ConnectionAnchor } | null>(null);

  // Resize state
  const [resizeState, setResizeState] = useState<ResizeState | null>(null);
  const resizeStateRef = useRef<ResizeState | null>(null);
  useEffect(() => {
    resizeStateRef.current = resizeState;
  }, [resizeState]);

  // Cleanup connection state when session changes or component unmounts
  useEffect(() => {
    return () => {
      setConnectionDragState(null);
      setHoveredAnchor(null);
      setResizeState(null);
    };
  }, [activeSessionId]);

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

  // Handle clipboard paste for images
  const handleImagePaste = useCallback(async (file: File) => {
    if (!activeSessionId) return;

    try {
      console.log('📋 Processing pasted image for canvas');
      const imageData = await processImageFile(file);

      // Get viewport center in world coordinates
      const container = containerRef.current;
      if (!container) return;

      const rect = container.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Convert screen coordinates to world coordinates
      const currentTransform = transformRef.current;
      const worldX = (centerX - currentTransform.x) / currentTransform.k;
      const worldY = (centerY - currentTransform.y) / currentTransform.k;

      // Create canvas object for the pasted image
      const imageObject: CanvasObject = {
        id: crypto.randomUUID(),
        type: 'image',
        label: file.name || 'Pasted Image',
        x: worldX - 150, // Center the 300px wide image
        y: worldY - 150, // Center the 300px tall image
        width: 300,
        height: 300,
        color: '#6b7280',
        selected: false,
        zIndex: 1,
        data: {
          content: imageData.base64 // Store base64 data URL
        },
        metadata: {
          mimeType: imageData.mimeType,
          size: imageData.size,
          originalWidth: imageData.width,
          originalHeight: imageData.height
        }
      };

      // Add to canvas
      updateCanvasObject(activeSessionId, imageObject);
      console.log('✅ Pasted image added to canvas at viewport center');

    } catch (error) {
      console.error('Failed to paste image:', error);
      alert(error instanceof Error ? error.message : 'Failed to paste image');
    }
  }, [activeSessionId, updateCanvasObject]);

  // Enable clipboard paste hook
  useClipboardPaste({
    onImagePaste: handleImagePaste,
    enabled: true
  });

  // Keyboard shortcuts: Delete selected objects with backspace/delete, Undo with Ctrl/Cmd+Z, Connect mode with 'C'
  const undoCanvasAction = useSessionStore((state) => state.undoCanvasAction);
  const redoCanvasAction = useSessionStore((state) => state.redoCanvasAction);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if user is typing in an input field
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return;
      }

      const sessionId = activeSessionIdRef.current;
      if (!sessionId) return;

      // Ctrl/Cmd+Z: Undo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && !event.shiftKey) {
        event.preventDefault();
        console.log('↩️ Undo triggered');
        undoCanvasAction(sessionId);
        return;
      }

      // Ctrl/Cmd+Shift+Z: Redo
      if ((event.ctrlKey || event.metaKey) && event.key === 'z' && event.shiftKey) {
        event.preventDefault();
        console.log('↪️ Redo triggered');
        redoCanvasAction(sessionId);
        return;
      }

      // Delete/Backspace: Delete selected objects
      if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();

        const selectedObjects = canvasObjectsRef.current.filter(obj => obj.selected);
        if (selectedObjects.length > 0) {
          const selectedIds = selectedObjects.map(obj => obj.id);
          console.log('🗑️ Deleting selected objects:', selectedIds);

          // Delete objects
          deleteCanvasObjects(sessionId, selectedIds);
        }
      }

      // Connection mode removed
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [deleteCanvasObjects, undoCanvasAction, redoCanvasAction]);


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

  const stopAnimation = useCallback(() => {
    if (animationRef.current !== null) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
  }, []);

  const syncZoomTransform = useCallback((next: TransformState) => {
    const selection = selectionRef.current;
    const zoomBehavior = zoomBehaviorRef.current;
    if (selection && zoomBehavior) {
      selection.call(zoomBehavior.transform, asZoomTransform(next));
    }
  }, []);

  const animateToTransform = useCallback(
    (target: TransformState, duration: number) => {
      if (duration <= 0) {
        stopAnimation();
        applyTransform(target);
        syncZoomTransform(target);
        return;
      }

      stopAnimation();

      const start = transformRef.current;
      const startTime = performance.now();

      const step = (time: number) => {
        const elapsed = time - startTime;
        const t = Math.min(1, elapsed / duration);
        const eased = 1 - Math.pow(1 - t, 3);

        const current: TransformState = {
          x: start.x + (target.x - start.x) * eased,
          y: start.y + (target.y - start.y) * eased,
          k: start.k + (target.k - start.k) * eased,
        };

        applyTransform(current);
        syncZoomTransform(current);

        if (t < 1) {
          animationRef.current = requestAnimationFrame(step);
        } else {
          animationRef.current = null;
        }
      };

      animationRef.current = requestAnimationFrame(step);
    },
    [applyTransform, stopAnimation, syncZoomTransform]
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

      return ids;
    },
    []
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
    if (canvasMode === "pan" && zoomHandlerRef.current) {
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
      // Account for floating header (80px), prompt bar (80px)
      const headerHeight = 80;
      const promptHeight = 80;
      const sidebarWidth = 80; // Sidebar width when expanded
      const visualHeight = stage.height - headerHeight - promptHeight;
      const availableWidth = stage.width - sidebarWidth;

      // Center between the left sidebar and right edge (not the middle of the screen)
      // Formula: sidebarWidth + (availableWidth / 2)
      // This places the center at the midpoint of the canvas area between sidebar and right edge
      const centerTransform: TransformState = {
        x: sidebarWidth + (availableWidth / 2),
        y: headerHeight + (visualHeight / 2) - 80, // Shift up 80px to account for prompt bar visual weight
        k: 0.6
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
    const targetScale = focusTarget.scale ?? transformRef.current.k;
    const offsetX = focusTarget.offsetX ?? 0;
    const offsetY = focusTarget.offsetY ?? 0;
    const targetTransform: TransformState = {
      k: targetScale,
      x: stageSize.width / 2 - focusTarget.x * targetScale + offsetX,
      y: stageSize.height / 2 - focusTarget.y * targetScale + offsetY
    };
    const duration = focusTarget.smooth === false ? 0 : focusTarget.duration ?? 240;
    if (duration > 0) {
      animateToTransform(targetTransform, duration);
    } else {
      stopAnimation();
      applyTransform(targetTransform);
      syncZoomTransform(targetTransform);
    }
    clearFocus();
  }, [focusTarget, animateToTransform, applyTransform, clearFocus, stopAnimation, syncZoomTransform]);

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



  // Connection functionality removed

  const handlePinFocus = useCallback(
    (pin: Pin) => {
      requestFocus({ id: pin.id, x: pin.x, y: pin.y });
    },
    [requestFocus]
  );


  const getScreenPoint = useCallback(
    (event: React.PointerEvent) => {
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

  // Handle dimension measurement from ResizeObserver
  const handleDimensionsMeasured = useCallback(
    (objectId: string, width: number, height: number) => {
      if (!activeSessionId) return;

      const state = useSessionStore.getState();
      const objects = state.canvasObjects[activeSessionId] || [];
      const object = objects.find(obj => obj.id === objectId);

      if (!object) return;

      // Only update if dimensions actually changed to avoid infinite loops
      if (object.width !== width || object.height !== height) {
        updateCanvasObject(activeSessionId, {
          ...object,
          width,
          height
        });
      }
    },
    [activeSessionId, updateCanvasObject]
  );

  const handleObjectDragStart = useCallback(
    (objectId: string, event: React.PointerEvent) => {

      // Context menu removed

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
      const screenPoint = getScreenPoint(event as any);
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
      const screenPoint = getScreenPoint(event as any);
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

      const screenPoint = getScreenPoint(event as any);
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

      }

      // Always release pointer capture and clear state, even if there was an error
      try {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
          event.currentTarget.releasePointerCapture(event.pointerId);
        }
      } catch (error) {
        console.warn('Error releasing pointer capture:', error);
      }

      // Clear drag state
      dragStateRef.current = null;
      setDragState(null);
    },
    [activeSessionId, updateCanvasObject, updateCanvasObjects, getScreenPoint, screenToWorld]
  );






  const startPinPlacement = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {

      // Context menu removed

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
      const screenPoint = getScreenPoint(event as any);
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

      // Context menu removed

      if (canvasMode !== "lasso") {
        return;
      }
      event.preventDefault();
      const screenPoint = getScreenPoint(event as any);
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
      const screenPoint = getScreenPoint(event as any);
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

        // Update selection state
        if (selectedIds.length > 0) {
          const state = useSessionStore.getState();
          const objects = state.canvasObjects[activeSessionId] || [];
          const updatedObjects = objects.map(obj => ({
            ...obj,
            selected: selectedIds.includes(obj.id)
          }));
          updateCanvasObjects(activeSessionId, updatedObjects);
          setCanvasMode("pan");
        }
      }
      lassoRef.current = null;
      setLasso(null);
    },
    [selectObjectsInBox, setCanvasMode, activeSessionId, updateCanvasObjects]
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

  // Connection handlers
  const handleConnectionStart = useCallback(
    (objectId: string, anchor: ConnectionAnchor, event: React.PointerEvent) => {
      if (!activeSessionId) return;

      event.stopPropagation();
      event.preventDefault();

      // Check if there are existing connections on this anchor
      const existingConnections = getConnectionsByAnchor(activeSessionId, objectId, anchor);
      
      if (existingConnections.length > 0) {
        // Disconnect all existing connections on this anchor
        existingConnections.forEach(conn => {
          deleteConnection(activeSessionId, conn.id);
        });
        return;
      }

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const worldX = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const worldY = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      setConnectionDragState({
        sourceObjectId: objectId,
        sourceAnchor: anchor,
        currentWorld: { x: worldX, y: worldY }
      });

      // Capture pointer for smooth dragging
      if (containerRef.current) {
        containerRef.current.setPointerCapture(event.pointerId);
      }
    },
    [activeSessionId, getConnectionsByAnchor, deleteConnection]
  );

  const handleConnectionMove = useCallback(
    (event: React.PointerEvent) => {
      const connDrag = connectionDragStateRef.current;
      if (!connDrag || !activeSessionId) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const worldX = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const worldY = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      // Update current position
      setConnectionDragState({
        ...connDrag,
        currentWorld: { x: worldX, y: worldY }
      });

      // Check if hovering over an anchor
      const anchorRadius = Math.max(12, 16 / transformRef.current.k);
      const hoveredObject = canvasObjects.find(obj => {
        if (obj.id === connDrag.sourceObjectId) return false; // Can't connect to self
        const anchor = getHoveredAnchor(obj, { x: worldX, y: worldY }, anchorRadius);
        return anchor !== null;
      });

      if (hoveredObject) {
        const anchor = getHoveredAnchor(hoveredObject, { x: worldX, y: worldY }, anchorRadius);
        if (anchor) {
          setHoveredAnchor({ objectId: hoveredObject.id, anchor });
        } else {
          setHoveredAnchor(null);
        }
      } else {
        setHoveredAnchor(null);
      }
    },
    [activeSessionId, canvasObjects]
  );

  const handleConnectionEnd = useCallback(
    (event: React.PointerEvent) => {
      const connDrag = connectionDragStateRef.current;
      if (!connDrag || !activeSessionId) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const worldX = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const worldY = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      // Check if we're over a valid target anchor
      const anchorRadius = Math.max(12, 16 / transformRef.current.k);
      const targetObject = canvasObjects.find(obj => {
        if (obj.id === connDrag.sourceObjectId) return false;
        const anchor = getHoveredAnchor(obj, { x: worldX, y: worldY }, anchorRadius);
        return anchor !== null;
      });

      if (targetObject) {
        const targetAnchor = getHoveredAnchor(targetObject, { x: worldX, y: worldY }, anchorRadius);
        if (targetAnchor) {
          // Check if this exact connection already exists (prevent duplicates)
          const duplicateConnection = connections.some(conn =>
            (conn.sourceObjectId === connDrag.sourceObjectId && 
             conn.sourceAnchor === connDrag.sourceAnchor &&
             conn.targetObjectId === targetObject.id && 
             conn.targetAnchor === targetAnchor) ||
            (conn.sourceObjectId === targetObject.id && 
             conn.sourceAnchor === targetAnchor &&
             conn.targetObjectId === connDrag.sourceObjectId && 
             conn.targetAnchor === connDrag.sourceAnchor)
          );

          if (!duplicateConnection) {
            try {
              createConnection(
                activeSessionId,
                connDrag.sourceObjectId,
                targetObject.id,
                connDrag.sourceAnchor,
                targetAnchor
              );
              console.log('✅ Connection created successfully');
            } catch (error) {
              console.error('❌ Failed to create connection:', error);
            }
          }
        }
      }

      // Release pointer capture
      if (containerRef.current && containerRef.current.hasPointerCapture(event.pointerId)) {
        containerRef.current.releasePointerCapture(event.pointerId);
      }

      // Clear connection drag state
      setConnectionDragState(null);
      setHoveredAnchor(null);
    },
    [activeSessionId, canvasObjects, createConnection, connections]
  );

  const handleAnchorHover = useCallback(
    (objectId: string, anchor: ConnectionAnchor | null) => {
      if (anchor) {
        setHoveredAnchor({ objectId, anchor });
      } else {
        setHoveredAnchor(null);
      }
    },
    []
  );

  // Resize handlers - simple proportional resize
  const handleResizeStart = useCallback(
    (objectId: string, direction: ResizeDirection, event: React.PointerEvent) => {
      if (!activeSessionId) return;

      event.stopPropagation();
      event.preventDefault();

      const object = canvasObjects.find(obj => obj.id === objectId);
      if (!object) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const worldX = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const worldY = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      setResizeState({
        objectId,
        direction,
        startWorld: { x: worldX, y: worldY },
        startScreen: { x: event.clientX, y: event.clientY },
        startSize: { width: object.width, height: object.height },
        startPosition: { x: object.x, y: object.y },
        currentDelta: { x: 0, y: 0 }
      });

      // Capture pointer for smooth resizing
      if (containerRef.current) {
        containerRef.current.setPointerCapture(event.pointerId);
      }
    },
    [activeSessionId, canvasObjects]
  );

  const handleResizeMove = useCallback(
    (objectId: string, event: React.PointerEvent) => {
      const resize = resizeStateRef.current;
      if (!resize || !activeSessionId || resize.objectId !== objectId) return;

      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const worldX = (event.clientX - rect.left - transformRef.current.x) / transformRef.current.k;
      const worldY = (event.clientY - rect.top - transformRef.current.y) / transformRef.current.k;

      const deltaX = worldX - resize.startWorld.x;
      const deltaY = worldY - resize.startWorld.y;

      let newWidth = resize.startSize.width;
      let newHeight = resize.startSize.height;
      let newX = resize.startPosition.x;
      let newY = resize.startPosition.y;

      // Simple resize logic - always resize from top-left corner (keep position fixed)
      // This prevents any unwanted movement or scrolling
      newWidth = Math.max(50, resize.startSize.width + deltaX);
      newHeight = Math.max(50, resize.startSize.height + deltaY);
      
      // Always keep the original position - no position changes during resize
      newX = resize.startPosition.x;
      newY = resize.startPosition.y;

      // Update the object with new dimensions and position
      const currentObject = canvasObjects.find(obj => obj.id === resize.objectId);
      if (currentObject) {
        updateCanvasObject(activeSessionId, {
          ...currentObject,
          x: newX,
          y: newY,
          width: newWidth,
          height: newHeight
        });
      }
    },
    [activeSessionId, updateCanvasObject, canvasObjects]
  );

  const handleResizeEnd = useCallback(
    (objectId: string, event: React.PointerEvent) => {
      const resize = resizeStateRef.current;
      if (!resize || !activeSessionId || resize.objectId !== objectId) return;

      // Release pointer capture
      if (containerRef.current && containerRef.current.hasPointerCapture(event.pointerId)) {
        containerRef.current.releasePointerCapture(event.pointerId);
      }

      // Clear resize state
      setResizeState(null);
    },
    [activeSessionId]
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

  // Handle clicking on empty canvas to deselect all objects
  const handleCanvasPointerDown = useCallback((event: React.PointerEvent) => {
    // Only deselect if clicking directly on the canvas (not on objects)
    if (event.target === event.currentTarget && activeSessionId) {
      setSelectedObjects(activeSessionId, []);
    }
  }, [activeSessionId, setSelectedObjects]);

  // Global pointer up handler to ensure drag operations are always properly ended
  useEffect(() => {
    const handleGlobalPointerUp = (event: PointerEvent) => {
      if (dragState) {
        // Force end any active drag operation
        setDragState(null);
        dragStateRef.current = null;
        if (containerRef.current && containerRef.current.hasPointerCapture(event.pointerId)) {
          containerRef.current.releasePointerCapture(event.pointerId);
        }
      }
      if (resizeState) {
        // Force end any active resize operation
        setResizeState(null);
        resizeStateRef.current = null;
        if (containerRef.current && containerRef.current.hasPointerCapture(event.pointerId)) {
          containerRef.current.releasePointerCapture(event.pointerId);
        }
      }
      if (connectionDragState) {
        // Force end any active connection drag
        setConnectionDragState(null);
        setHoveredAnchor(null);
        if (containerRef.current && containerRef.current.hasPointerCapture(event.pointerId)) {
          containerRef.current.releasePointerCapture(event.pointerId);
        }
      }
    };

    document.addEventListener('pointerup', handleGlobalPointerUp);
    document.addEventListener('pointercancel', handleGlobalPointerUp);

    return () => {
      document.removeEventListener('pointerup', handleGlobalPointerUp);
      document.removeEventListener('pointercancel', handleGlobalPointerUp);
    };
  }, [dragState, resizeState, connectionDragState]);

  // Cleanup effect to clear all states when component unmounts or session changes
  useEffect(() => {
    return () => {
      setDragState(null);
      setResizeState(null);
      setConnectionDragState(null);
      setHoveredAnchor(null);
      dragStateRef.current = null;
      resizeStateRef.current = null;
      connectionDragStateRef.current = null;
    };
  }, [activeSessionId]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-white">
      <div
        className="absolute inset-0"
        ref={containerRef}
        data-canvas-container="true"
        onPointerDown={(e) => {
          handleCanvasPointerDown(e);
          startPinPlacement(e);
        }}
        onPointerMove={(e) => {
          if (connectionDragState) {
            handleConnectionMove(e);
          } else if (resizeState) {
            e.preventDefault();
            e.stopPropagation();
            handleResizeMove(resizeState.objectId, e);
          }
        }}
        onPointerUp={(e) => {
          if (connectionDragState) {
            handleConnectionEnd(e);
          } else if (resizeState) {
            e.preventDefault();
            e.stopPropagation();
            handleResizeEnd(resizeState.objectId, e);
          } else if (dragState) {
            handleObjectDragEnd(dragState.objectId, e);
          }
        }}
        style={{ cursor: canvasCursor }}
      >
        <div className="absolute inset-0 transition-colors" style={backgroundStyle} />
        {isInitialized && (
          <>
            <ConnectionLayer
              connections={connections}
              objects={canvasObjects}
              transform={transform}
              connectionDragState={connectionDragState}
              hoveredAnchor={hoveredAnchor}
              dragState={dragState}
              onConnectionClick={(connectionId) => {
                // Handle connection click (e.g., for deletion)
                console.log('Connection clicked:', connectionId);
              }}
            />
            <ObjectLayer
              objects={canvasObjects}
              transform={transform}
              onDragStart={handleObjectDragStart}
              onDragMove={handleObjectDragMove}
              onDragEnd={handleObjectDragEnd}
              onResizeStart={handleResizeStart}
              onResizeMove={handleResizeMove}
              onResizeEnd={handleResizeEnd}
              onContextMenu={undefined}
              onDimensionsMeasured={handleDimensionsMeasured}
              isDragging={!!dragState}
              isResizing={!!resizeState}
              isConnectionMode={!!connectionDragState}
              dragState={dragState}
              resizeState={resizeState}
              onConnectionStart={handleConnectionStart}
              onAnchorHover={handleAnchorHover}
              hoveredAnchor={hoveredAnchor}
              connections={connections}
              getConnectionsByAnchor={getConnectionsByAnchor}
              activeSessionId={activeSessionId}
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
                  <Button type="button" onClick={cancelPinDraft}>
                    Cancel
                  </Button>
                  <Button type="submit">
                    Save
                  </Button>
                </div>
              </form>
            </div>
          </div>
        ) : null}
        {canvasMode === "lasso" && !dragState ? (
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
      {/* Context menu removed */}
    </div>
  );
}
