'use client';

import { useCallback, useRef } from 'react';
import { useSessionStore } from '@/lib/session-store';
import type { CanvasObject } from '@/types';

type SequenceItem = {
  id: string;
  x: number;
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
};

const HORIZONTAL_SPACING = 96;

export function useSequentialConnections() {
  const updateCanvasObject = useSessionStore((state) => state.updateCanvasObject);
  const createConnection = useSessionStore((state) => state.createConnection);
  const getConnectionsForObject = useSessionStore((state) => state.getConnectionsForObject);

  const sequenceRef = useRef<SequenceState>({
    sessionId: null,
    sequenceKey: null,
    baseX: 0,
    baseY: 0,
    baseHeight: 0,
    items: [],
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
      let x = basePosition.x;
      let y = basePosition.y;

      if (index === 0) {
        sequence.baseX = basePosition.x;
        sequence.baseY = basePosition.y;
        sequence.baseHeight = object.height;
      } else {
        const previous = sequence.items[index - 1];
        const spacing = Math.max(HORIZONTAL_SPACING, previous.width * 0.2);
        x = previous.x + previous.width + spacing;

        const verticalOffset = sequence.baseHeight > 0
          ? Math.max((sequence.baseHeight - object.height) / 2, 0)
          : 0;
        y = sequence.baseY + verticalOffset;
      }

      const positionedObject: CanvasObject = {
        ...object,
        x,
        y,
      };

      updateCanvasObject(sessionId, positionedObject);

      sequence.items.push({
        id: positionedObject.id,
        x,
        width: positionedObject.width,
        height: positionedObject.height,
      });
      sequence.baseHeight = Math.max(sequence.baseHeight, positionedObject.height);

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
    [createConnection, getConnectionsForObject, updateCanvasObject]
  );

  const endSequence = useCallback(() => {
    sequenceRef.current = {
      sessionId: null,
      sequenceKey: null,
      baseX: 0,
      baseY: 0,
      baseHeight: 0,
      items: [],
    };
  }, []);

  return {
    startSequence,
    addObjectToSequence,
    endSequence,
  };
}
