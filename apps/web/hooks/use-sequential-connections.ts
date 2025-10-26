'use client';

import { useCallback, useRef } from 'react';
import { useSessionStore } from '@/lib/session-store';
import type { CanvasObject } from '@/types';

type Rect = { x: number; y: number; width: number; height: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const getObjectPosition = (object: any): { x: number; y: number } => {
  if (object?.position && typeof object.position.x === 'number' && typeof object.position.y === 'number') {
    return { x: object.position.x, y: object.position.y };
  }
  return {
    x: typeof object?.x === 'number' ? object.x : 0,
    y: typeof object?.y === 'number' ? object.y : 0,
  };
};

const getObjectDimensions = (object: any): { width: number; height: number } => {
  const baseWidthCandidates = [object?.width, object?.size?.width, object?.metadata?.width, object?.metadata?.dimensions?.width];
  const baseHeightCandidates = [object?.height, object?.size?.height, object?.metadata?.height, object?.metadata?.dimensions?.height];

  if (object?.metadata) {
    const md = object.metadata;
    baseWidthCandidates.push(md.naturalWidth, md.imageWidth, md.diagramWidth, md.renderWidth, md.svgWidth);
    baseHeightCandidates.push(md.naturalHeight, md.imageHeight, md.diagramHeight, md.renderHeight, md.svgHeight);
  }

  const widthCandidates = baseWidthCandidates
    .map(toNumber)
    .filter((value): value is number => value !== null && value > 0);
  const heightCandidates = baseHeightCandidates
    .map(toNumber)
    .filter((value): value is number => value !== null && value > 0);

  let width = widthCandidates.length > 0 ? Math.max(...widthCandidates) : 0;
  let height = heightCandidates.length > 0 ? Math.max(...heightCandidates) : 0;

  if (width > 0 && height === 0 && object?.metadata?.aspectRatio) {
    const aspect = toNumber(object.metadata.aspectRatio);
    if (aspect && aspect > 0) {
      height = width / aspect;
    }
  }

  if (height > 0 && width === 0 && object?.metadata?.aspectRatio) {
    const aspect = toNumber(object.metadata.aspectRatio);
    if (aspect && aspect > 0) {
      width = height * aspect;
    }
  }

  if (width === 0) {
    width = 320;
  }
  if (height === 0) {
    height = 240;
  }

  return { width, height };
};

const getObjectRect = (object: any): Rect => {
  const { x, y } = getObjectPosition(object);
  const { width, height } = getObjectDimensions(object);
  return { x, y, width, height };
};

const mergeRects = (a: Rect | null, b: Rect): Rect => {
  if (!a) {
    return { ...b };
  }
  const minX = Math.min(a.x, b.x);
  const minY = Math.min(a.y, b.y);
  const maxX = Math.max(a.x + a.width, b.x + b.width);
  const maxY = Math.max(a.y + a.height, b.y + b.height);
  return {
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
  };
};

const getObjectPadding = (type: string | undefined, width: number, height: number): number => {
  const base = Math.max(width, height);
  if (type === 'image' || type === 'diagram' || type === 'video') {
    return Math.max(MIN_PADDING * 1.5, Math.min(160, base * 0.12));
  }
  if (type === 'graph' || type === 'code' || type === 'latex') {
    return Math.max(MIN_PADDING, Math.min(140, base * 0.1));
  }
  return Math.max(MIN_PADDING, Math.min(120, base * 0.08));
};

type SequenceItem = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

type SequenceState = {
  sessionId: string | null;
  sequenceKey: string | null;
  baseX: number;
  baseY: number;
  baseHeight: number;
  items: SequenceItem[];
  bounds: Bounds | null;
  reservedArea: Rect | null;
  lastFocusCenter: { x: number; y: number } | null;
  lastFocusScale: number | null;
  lastFocusOffset: { x: number; y: number } | null;
};

const HORIZONTAL_SPACING = 96;
const MIN_PADDING = 32;
const SEARCH_STEP = 48;
const MAX_SEARCH_RADIUS = 1600;
const CLUSTER_WIDTH_MULTIPLIER = 3;
const CLUSTER_HEIGHT_MULTIPLIER = 1.6;

const expandRect = (rect: Rect, padding: number) => ({
  left: rect.x - padding,
  right: rect.x + rect.width + padding,
  top: rect.y - padding,
  bottom: rect.y + rect.height + padding,
});

const rectanglesOverlap = (a: Rect, b: Rect, padding: number) => {
  const aExpanded = expandRect(a, padding);
  const bExpanded = expandRect(b, padding);

  return !(
    aExpanded.right <= bExpanded.left ||
    aExpanded.left >= bExpanded.right ||
    aExpanded.bottom <= bExpanded.top ||
    aExpanded.top >= bExpanded.bottom
  );
};

const findNearestAvailablePosition = (
  preferred: { x: number; y: number },
  size: { width: number; height: number },
  existing: Rect[],
  padding: number
): { x: number; y: number } => {
  const candidateRect = (x: number, y: number): Rect => ({ x, y, width: size.width, height: size.height });

  const isFree = (x: number, y: number) => {
    const rect = candidateRect(x, y);
    return existing.every((other) => !rectanglesOverlap(rect, other, padding));
  };

  if (isFree(preferred.x, preferred.y)) {
    return preferred;
  }

  const considered = new Set<string>();
  const encode = (x: number, y: number) => `${Math.round(x)}:${Math.round(y)}`;

  let bestCandidate: { x: number; y: number } | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (let radius = SEARCH_STEP; radius <= MAX_SEARCH_RADIUS; radius += SEARCH_STEP) {
    const steps = Math.max(1, Math.floor((radius * 2) / SEARCH_STEP));

    for (let i = 0; i <= steps; i++) {
      const offset = -radius + (i / steps) * radius * 2;
      const candidates: Array<{ x: number; y: number }> = [
        { x: preferred.x - radius, y: preferred.y + offset },
        { x: preferred.x + radius, y: preferred.y + offset },
        { x: preferred.x + offset, y: preferred.y - radius },
        { x: preferred.x + offset, y: preferred.y + radius },
      ];

      for (const candidate of candidates) {
        const key = encode(candidate.x, candidate.y);
        if (considered.has(key)) {
          continue;
        }
        considered.add(key);

        if (!isFree(candidate.x, candidate.y)) {
          continue;
        }

        const dx = candidate.x - preferred.x;
        const dy = candidate.y - preferred.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < bestDistance) {
          bestDistance = distanceSq;
          bestCandidate = candidate;
        }
      }
    }

    if (bestCandidate) {
      break;
    }
  }

  return bestCandidate ?? preferred;
};

const updateBounds = (bounds: Bounds | null, rect: Rect): Bounds => {
  const maxX = rect.x + rect.width;
  const maxY = rect.y + rect.height;

  if (!bounds) {
    return {
      minX: rect.x,
      minY: rect.y,
      maxX,
      maxY,
    };
  }

  return {
    minX: Math.min(bounds.minX, rect.x),
    minY: Math.min(bounds.minY, rect.y),
    maxX: Math.max(bounds.maxX, maxX),
    maxY: Math.max(bounds.maxY, maxY),
  };
};

const getViewport = (sessionId: string) => {
  const state = useSessionStore.getState();
  const view = state.canvasViews[sessionId];
  if (!view?.stageSize || !view.transform) {
    return null;
  }

  const { transform, stageSize } = view;

  const worldX = -transform.x / transform.k;
  const worldY = -transform.y / transform.k;
  const worldWidth = stageSize.width / transform.k;
  const worldHeight = stageSize.height / transform.k;

  return {
    x: worldX,
    y: worldY,
    width: worldWidth,
    height: worldHeight,
  };
};

const clampToReservedArea = (
  position: { x: number; y: number },
  size: { width: number; height: number },
  reservedArea: Rect | null,
  padding: number
) => {
  if (!reservedArea) {
    return position;
  }

  const minX = reservedArea.x + padding;
  const maxX = reservedArea.x + reservedArea.width - size.width - padding;
  const minY = reservedArea.y + padding;
  const maxY = reservedArea.y + reservedArea.height - size.height - padding;

  const clampedX =
    minX > maxX
      ? reservedArea.x + (reservedArea.width - size.width) / 2
      : Math.min(Math.max(position.x, minX), maxX);
  const clampedY =
    minY > maxY
      ? reservedArea.y + (reservedArea.height - size.height) / 2
      : Math.min(Math.max(position.y, minY), maxY);

  return {
    x: clampedX,
    y: clampedY,
  };
};

const findOpenArea = (
  center: { x: number; y: number },
  size: { width: number; height: number },
  occupancy: Rect[],
  padding: number
): Rect => {
  const halfWidth = size.width / 2;
  const halfHeight = size.height / 2;

  const isFree = (rect: Rect) =>
    occupancy.every((existing) => !rectanglesOverlap(rect, existing, padding));

  const initialRect: Rect = {
    x: center.x - halfWidth,
    y: center.y - halfHeight,
    width: size.width,
    height: size.height,
  };

  if (isFree(initialRect)) {
    return initialRect;
  }

  const considered = new Set<string>();
  const encode = (x: number, y: number) => `${Math.round(x)}:${Math.round(y)}`;

  let bestRect: Rect | null = null;
  let bestDist = Number.POSITIVE_INFINITY;

  const candidateFrom = (x: number, y: number): Rect => ({
    x,
    y,
    width: size.width,
    height: size.height,
  });

  for (let radius = SEARCH_STEP; radius <= MAX_SEARCH_RADIUS; radius += SEARCH_STEP) {
    const steps = Math.max(1, Math.floor((radius * 2) / SEARCH_STEP));

    for (let i = 0; i <= steps; i++) {
      const offset = -radius + (radius * 2 * i) / steps;
      const candidates = [
        candidateFrom(center.x - halfWidth - radius, center.y - halfHeight + offset),
        candidateFrom(center.x - halfWidth + radius, center.y - halfHeight + offset),
        candidateFrom(center.x - halfWidth + offset, center.y - halfHeight - radius),
        candidateFrom(center.x - halfWidth + offset, center.y - halfHeight + radius),
      ];

      for (const candidate of candidates) {
        const key = encode(candidate.x, candidate.y);
        if (considered.has(key)) {
          continue;
        }
        considered.add(key);

        if (!isFree(candidate)) {
          continue;
        }

        const centerX = candidate.x + halfWidth;
        const centerY = candidate.y + halfHeight;
        const dx = centerX - center.x;
        const dy = centerY - center.y;
        const distanceSq = dx * dx + dy * dy;

        if (distanceSq < bestDist) {
          bestDist = distanceSq;
          bestRect = candidate;
        }
      }
    }

    if (bestRect) {
      break;
    }
  }

  return bestRect ?? initialRect;
};

export function useSequentialConnections() {
  const updateCanvasObject = useSessionStore((state) => state.updateCanvasObject);
  const createConnection = useSessionStore((state) => state.createConnection);
  const getConnectionsForObject = useSessionStore((state) => state.getConnectionsForObject);
  const requestFocus = useSessionStore((state) => state.requestFocus);

  const sequenceRef = useRef<SequenceState>({
    sessionId: null,
    sequenceKey: null,
    baseX: 0,
    baseY: 0,
    baseHeight: 0,
  items: [],
  bounds: null,
  reservedArea: null,
  lastFocusCenter: null,
  lastFocusScale: null,
  lastFocusOffset: null,
});

  const startSequence = useCallback((sessionId: string | null) => {
    const key = sessionId ? `${sessionId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : null;
    sequenceRef.current = {
      sessionId,
      sequenceKey: key,
      baseX: 0,
      baseY: 0,
      baseHeight: 0,
      items: [],
      bounds: null,
      reservedArea: null,
      lastFocusCenter: null,
      lastFocusScale: null,
      lastFocusOffset: null,
    };
    return key;
  }, []);

  const addObjectToSequence = useCallback(
    (
      sessionId: string,
      object: CanvasObject,
      basePosition: { x: number; y: number },
      sequenceKey?: string | null
    ) => {
      if (!sessionId) {
        return object;
      }

      const sequence = sequenceRef.current;

      if (!sequence.sequenceKey || sequence.sessionId !== sessionId) {
        return object;
      }

      if (sequenceKey && sequence.sequenceKey !== sequenceKey) {
        return object;
      }

      const index = sequence.items.length;
      const state = useSessionStore.getState();
      const existingObjects = state.canvasObjects[sessionId] ?? [];
      const layoutOffsets = state.layoutOffsets;
      const view = state.canvasViews[sessionId];
      const currentScale = view?.transform?.k ?? 1;

      const occupancy: Rect[] = [
        ...existingObjects.map((item) => getObjectRect(item)),
        ...sequence.items.map((item) => ({
          x: item.x,
          y: item.y,
          width: item.width,
          height: item.height,
        })),
      ];

      const { width: objectWidth, height: objectHeight } = getObjectDimensions(object);
      const objectPadding = getObjectPadding(object?.type, objectWidth, objectHeight);

      let desiredX = basePosition.x;
      let desiredY = basePosition.y;

      if (index === 0) {
        const viewport = getViewport(sessionId);
        const center = viewport
          ? {
              x:
                viewport.x +
                viewport.width / 2 +
                (layoutOffsets.left - layoutOffsets.right) / (2 * currentScale),
              y:
                viewport.y +
                viewport.height / 2 +
                (layoutOffsets.top - layoutOffsets.bottom) / (2 * currentScale),
            }
          : { x: basePosition.x, y: basePosition.y };

        const clusterWidth =
          Math.max(objectWidth * CLUSTER_WIDTH_MULTIPLIER, objectWidth + HORIZONTAL_SPACING * 2) +
          objectPadding * 2;
        const clusterHeight =
          Math.max(objectHeight * CLUSTER_HEIGHT_MULTIPLIER, objectHeight + objectPadding * 2);

        const reservedArea = findOpenArea(
          center,
          { width: clusterWidth, height: clusterHeight },
          occupancy,
          objectPadding
        );

        sequence.reservedArea = reservedArea;
        sequence.baseX = reservedArea.x + objectPadding;
        sequence.baseY =
          reservedArea.y +
          Math.max((reservedArea.height - objectHeight) / 2, objectPadding);
        sequence.baseHeight = objectHeight;

        desiredX = sequence.baseX;
        desiredY = sequence.baseY;

      } else {
        const previous = sequence.items[index - 1];
        const spacing = Math.max(HORIZONTAL_SPACING, previous.width * 0.2);
        desiredX = previous.x + previous.width + spacing;

        const verticalOffset =
          sequence.baseHeight > 0 ? Math.max((sequence.baseHeight - objectHeight) / 2, 0) : 0;
        desiredY = sequence.baseY + verticalOffset;
      }

      const clampedPosition = clampToReservedArea(
        { x: desiredX, y: desiredY },
        { width: objectWidth, height: objectHeight },
        sequence.reservedArea,
        objectPadding
      );

      const resolvedPosition = findNearestAvailablePosition(
        clampedPosition,
        { width: objectWidth, height: objectHeight },
        occupancy,
        objectPadding
      );

      if (index === 0) {
        sequence.baseX = resolvedPosition.x;
        sequence.baseY = resolvedPosition.y;
      }

      const positionedObject: CanvasObject = {
        ...object,
        x: resolvedPosition.x,
        y: resolvedPosition.y,
        width: objectWidth,
        height: objectHeight,
        position: { x: resolvedPosition.x, y: resolvedPosition.y },
        size: { width: objectWidth, height: objectHeight },
      };

      updateCanvasObject(sessionId, positionedObject);

      sequence.items.push({
        id: positionedObject.id,
        x: positionedObject.x,
        y: positionedObject.y,
        width: objectWidth,
        height: objectHeight,
      });
      sequence.baseHeight = Math.max(sequence.baseHeight, objectHeight);
      const paddedRect: Rect = {
        x: positionedObject.x - objectPadding,
        y: positionedObject.y - objectPadding,
        width: objectWidth + objectPadding * 2,
        height: objectHeight + objectPadding * 2,
      };
      sequence.bounds = updateBounds(sequence.bounds, paddedRect);
      sequence.reservedArea = mergeRects(sequence.reservedArea, paddedRect);

      if (sequence.bounds) {
        const center = {
          x: (sequence.bounds.minX + sequence.bounds.maxX) / 2,
          y: (sequence.bounds.minY + sequence.bounds.maxY) / 2,
        };

        const stateAfterPlacement = useSessionStore.getState();
        const view = stateAfterPlacement.canvasViews[sessionId];
        const layoutOffsets = stateAfterPlacement.layoutOffsets;
        const stageSize = view?.stageSize;
        const currentScale = view?.transform?.k ?? 1;

        let targetScale = currentScale;
        if (stageSize) {
          const availableWidth = Math.max(200, stageSize.width - layoutOffsets.left - layoutOffsets.right);
          const boundsWidth = sequence.bounds.maxX - sequence.bounds.minX + MIN_PADDING * 4;
          if (boundsWidth > 0 && availableWidth > 0) {
            const requiredScale = availableWidth / boundsWidth;
            const adjustedRequired = Math.max(requiredScale, 0.1);
            const softenedScale = Math.max(targetScale - (targetScale - adjustedRequired) * 0.5, 0.1);
            if (softenedScale < targetScale) {
              targetScale = softenedScale;
            }
          }

          const availableHeight = stageSize.height - layoutOffsets.top - layoutOffsets.bottom;
          const boundsHeight = sequence.bounds.maxY - sequence.bounds.minY + MIN_PADDING * 4;
          if (boundsHeight > 0 && availableHeight > 0) {
            const requiredScale = availableHeight / boundsHeight;
            const adjustedRequired = Math.max(requiredScale, 0.1);
            const softenedScale = Math.max(targetScale - (targetScale - adjustedRequired) * 0.5, 0.1);
            if (softenedScale < targetScale) {
              targetScale = softenedScale;
            }
          }
        }

        const offsetX = (layoutOffsets.left - layoutOffsets.right) / 2;
        const offsetY = (layoutOffsets.top - layoutOffsets.bottom) / 2;

        const prevCenter = sequence.lastFocusCenter;
        const prevScale = sequence.lastFocusScale;
        const prevOffset = sequence.lastFocusOffset;

        const centerChanged =
          !prevCenter || Math.hypot(prevCenter.x - center.x, prevCenter.y - center.y) > 1;
        const scaleChanged = prevScale === null || Math.abs(prevScale - targetScale) > 0.01;
        const offsetChanged =
          !prevOffset ||
          Math.abs(prevOffset.x - offsetX) > 0.5 ||
          Math.abs(prevOffset.y - offsetY) > 0.5;

        if (centerChanged || scaleChanged || offsetChanged) {
          sequence.lastFocusCenter = center;
          sequence.lastFocusScale = targetScale;
          sequence.lastFocusOffset = { x: offsetX, y: offsetY };

          requestFocus({
            x: center.x,
            y: center.y,
            smooth: true,
            duration: prevCenter ? 220 : 260,
            scale: targetScale,
            offsetX,
            offsetY,
          });
        }
      }

      if (index > 0) {
        const previousId = sequence.items[index - 1].id;

        const existingConnections = getConnectionsForObject(sessionId, positionedObject.id);
        const alreadyConnected = existingConnections.some(
          (connection) =>
            connection.sourceObjectId === previousId && connection.targetObjectId === positionedObject.id
        );

        if (!alreadyConnected) {
          createConnection(sessionId, previousId, positionedObject.id, 'east', 'west');
        }
      }

      return positionedObject;
    },
    [createConnection, getConnectionsForObject, requestFocus, updateCanvasObject]
  );

  const endSequence = useCallback(() => {
    sequenceRef.current = {
      sessionId: null,
      sequenceKey: null,
      baseX: 0,
      baseY: 0,
      baseHeight: 0,
      items: [],
      bounds: null,
      reservedArea: null,
      lastFocusCenter: null,
      lastFocusScale: null,
      lastFocusOffset: null,
    };
  }, []);

  return {
    startSequence,
    addObjectToSequence,
    endSequence,
  };
}
