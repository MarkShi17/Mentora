'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { select, zoom, zoomIdentity } from "d3";
import { ObjectLayer } from "@/components/object-layer";
import { SelectionLayer } from "@/components/selection-layer";
import { useSessionStore } from "@/lib/session-store";
import type { CanvasObject } from "@/types";

const GRID_SIZE = 40;
const MARGIN = 160;

type TransformState = {
  x: number;
  y: number;
  k: number;
};

const identityState: TransformState = { x: 0, y: 0, k: 1 };

const toState = (transform: { x: number; y: number; k: number }): TransformState => ({
  x: transform.x,
  y: transform.y,
  k: transform.k
});

export function CanvasStage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selectionRef = useRef<ReturnType<typeof select<HTMLDivElement, unknown>>>();
  const zoomBehaviorRef = useRef<ReturnType<typeof zoom<HTMLDivElement, unknown>>>();
  const rafRef = useRef<number>();
  const stageSizeRef = useRef<{ width: number; height: number } | null>(null);
  const objectsRef = useRef<CanvasObject[]>([]);

  const [transform, setTransform] = useState<TransformState>(identityState);
  const transformRef = useRef<TransformState>(identityState);

  const activeSessionId = useSessionStore((state) => state.activeSessionId);
  const canvasObjects = useSessionStore(
    (state) => (activeSessionId ? state.canvasObjects[activeSessionId] ?? [] : [])
  );
  const toggleObjectSelection = useSessionStore((state) => state.toggleObjectSelection);
  const clearObjectSelection = useSessionStore((state) => state.clearObjectSelection);

  objectsRef.current = canvasObjects;

  const scheduleTransform = useCallback((incoming: { x: number; y: number; k: number }) => {
    const nextState = toState(incoming);
    const current = transformRef.current;

    const isSame =
      Math.abs(current.x - nextState.x) < 0.1 &&
      Math.abs(current.y - nextState.y) < 0.1 &&
      Math.abs(current.k - nextState.k) < 0.001;

    transformRef.current = nextState;

    if (isSame) {
      return;
    }

    if (rafRef.current) {
      return;
    }
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = undefined;
      setTransform(() => ({ ...transformRef.current }));
    });
  }, []);

  const updateZoomBounds = useCallback(() => {
    const zoomBehavior = zoomBehaviorRef.current;
    const selection = selectionRef.current;
    const stageSize = stageSizeRef.current;

    if (!zoomBehavior || !stageSize) {
      return;
    }

    zoomBehavior.extent([
      [0, 0],
      [stageSize.width, stageSize.height]
    ]);

    const objects = objectsRef.current;
    let minX = -stageSize.width;
    let maxX = stageSize.width * 2;
    let minY = -stageSize.height;
    let maxY = stageSize.height * 2;

    if (objects.length > 0) {
      const left = Math.min(...objects.map((object) => object.x));
      const right = Math.max(...objects.map((object) => object.x + object.width));
      const top = Math.min(...objects.map((object) => object.y));
      const bottom = Math.max(...objects.map((object) => object.y + object.height));

      minX = left - MARGIN;
      maxX = right + MARGIN;
      minY = top - MARGIN;
      maxY = bottom + MARGIN;

      const extentWidth = maxX - minX;
      const extentHeight = maxY - minY;

      if (extentWidth < stageSize.width) {
        const delta = (stageSize.width - extentWidth) / 2;
        minX -= delta;
        maxX += delta;
      }

      if (extentHeight < stageSize.height) {
        const delta = (stageSize.height - extentHeight) / 2;
        minY -= delta;
        maxY += delta;
      }
    }

    zoomBehavior.translateExtent([
      [minX, minY],
      [maxX, maxY]
    ]);

    const constrained = zoomBehavior.constrain(
      zoomIdentity.translate(transformRef.current.x, transformRef.current.y).scale(transformRef.current.k)
    );
    const nextState = toState(constrained);
    transformRef.current = nextState;
    scheduleTransform(nextState);
    if (selection) {
      selection.call(zoomBehavior.transform, constrained);
    }
  }, [scheduleTransform]);

  useLayoutEffect(() => {
    if (!containerRef.current) {
      return;
    }
    const element = containerRef.current;
    const updateSize = () => {
      stageSizeRef.current = {
        width: element.clientWidth,
        height: element.clientHeight
      };
    };
    updateSize();
    const observer = new ResizeObserver(() => {
      updateSize();
      updateZoomBounds();
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
    };
  }, [updateZoomBounds]);

  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    const element = containerRef.current;
    const zoomBehavior = zoom<HTMLDivElement, unknown>()
      .scaleExtent([0.25, 3])
      .filter((event) => {
        if (event.ctrlKey && event.type === "wheel") {
          // allow pinch-zoom gesture
          return true;
        }
        return !event.button && event.type !== "dblclick";
      })
      .on("zoom", (event) => {
        scheduleTransform(event.transform);
      });

    zoomBehaviorRef.current = zoomBehavior;
    const selection = select(element);
    selectionRef.current = selection;
    selection.call(zoomBehavior);
    updateZoomBounds();

    const resetTransform = () => {
      scheduleTransform(identityState);
      selection
        .transition()
        .duration(220)
        .call(zoomBehavior.transform, zoomIdentity);
    };

    element.addEventListener("dblclick", resetTransform);

    return () => {
      element.removeEventListener("dblclick", resetTransform);
      selection.on(".zoom", null);
    };
  }, [scheduleTransform, updateZoomBounds]);

  useEffect(() => {
    updateZoomBounds();
  }, [canvasObjects, updateZoomBounds]);

  useEffect(
    () => () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
    },
    []
  );

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
    const scaledGrid = Math.max(GRID_SIZE * transform.k, 10);
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
