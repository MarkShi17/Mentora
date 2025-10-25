import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "@/lib/utils";
import {
  CanvasObject,
  Message,
  Pin,
  Session,
  SourceLink,
  TimelineEvent
} from "@/types";

type TransformState = {
  x: number;
  y: number;
  k: number;
};

type CanvasView = {
  transform: TransformState;
  stageSize: { width: number; height: number } | null;
};

type FocusTarget = {
  x: number;
  y: number;
  id?: string;
} | null;

type SessionState = {
  sessions: Session[];
  activeSessionId: string | null;
  messages: Record<string, Message[]>;
  canvasObjects: Record<string, CanvasObject[]>;
  sources: Record<string, SourceLink[]>;
  timeline: Record<string, TimelineEvent[]>;
  transcripts: Record<string, string>;
  pins: Record<string, Pin[]>;
  voiceActive: boolean;
  sourcesDrawerOpen: boolean;
  captionsEnabled: boolean;
  canvasMode: "pan" | "lasso" | "pin";
  canvasViews: Record<string, CanvasView>;
  selectionMethods: Record<string, "click" | "lasso">;
  lastSelectedObjectIds: Record<string, string | null>;
  focusTarget: FocusTarget;
  setActiveSession: (sessionId: string) => void;
  createSession: (payload: { title: string }) => Promise<string>;
  addMessage: (sessionId: string, message: Omit<Message, "id" | "timestamp">) => void;
  updateCanvasObject: (sessionId: string, object: CanvasObject) => void;
  toggleObjectSelection: (sessionId: string, objectId: string, keepOthers?: boolean) => void;
  clearObjectSelection: (sessionId: string) => void;
  setSelectedObjects: (sessionId: string, ids: string[]) => void;
  setSelectionMethod: (sessionId: string, method: "click" | "lasso") => void;
  setLastSelectedObject: (sessionId: string, objectId: string | null) => void;
  bringToFront: (sessionId: string, objectId: string) => void;
  setSources: (sessionId: string, sources: SourceLink[]) => void;
  setVoiceActive: (value: boolean) => void;
  appendTimelineEvent: (sessionId: string, event: Omit<TimelineEvent, "id" | "timestamp">) => void;
  setSourcesDrawerOpen: (open: boolean) => void;
  setCaptionsEnabled: (enabled: boolean) => void;
  setCanvasMode: (mode: "pan" | "lasso" | "pin") => void;
  addPin: (sessionId: string, payload: { x: number; y: number; label?: string }) => Pin | null;
  removePin: (sessionId: string, pinId: string) => void;
  setCanvasView: (sessionId: string, view: CanvasView) => void;
  requestFocus: (target: { x: number; y: number; id?: string }) => void;
  clearFocus: () => void;
};

const withImmer = immer<SessionState>;

export const useSessionStore = create<SessionState>()(
  withImmer((set, get) => {
    // Create a default session on initialization
    const defaultSessionId = `session-${nanoid(6)}`;
    const now = new Date().toISOString();
    const defaultSession: Session = {
      id: defaultSessionId,
      title: "Getting Started",
      createdAt: now
    };

    // Test object at (0,0) to verify centering
    const testObject1: CanvasObject = {
      id: "test-obj-1",
      type: "text",
      label: "Test Object 1",
      x: 0,
      y: 0,
      width: 200,
      height: 100,
      color: "#3b82f6",
      selected: false,
      zIndex: 1,
      data: {
        content: "This object is at (0,0)\nIt should appear in the visual center of the canvas."
      },
      metadata: {
        description: "Test object for canvas centering"
      }
    };

    // Second test object for multi-selection testing
    const testObject2: CanvasObject = {
      id: "test-obj-2",
      type: "diagram",
      label: "Test Object 2",
      x: 400,
      y: 0,
      width: 250,
      height: 150,
      color: "#10b981",
      selected: false,
      zIndex: 2,
      data: {
        svg: '<svg viewBox="0 0 200 100"><rect x="10" y="10" width="180" height="80" fill="#10b981" opacity="0.3" rx="8"/><text x="100" y="55" text-anchor="middle" fill="#059669" font-size="16">Diagram</text></svg>'
      },
      metadata: {
        description: "Test object for multi-selection"
      }
    };

    return {
      sessions: [defaultSession],
      activeSessionId: defaultSessionId,
      messages: { [defaultSessionId]: [] },
      canvasObjects: { [defaultSessionId]: [testObject1, testObject2] },
      sources: { [defaultSessionId]: [] },
      timeline: { [defaultSessionId]: [] },
      transcripts: { [defaultSessionId]: "" },
      pins: { [defaultSessionId]: [] },
      voiceActive: false,
      sourcesDrawerOpen: false,
      captionsEnabled: true,
      canvasMode: "pan",
      canvasViews: {},
      selectionMethods: {},
      lastSelectedObjectIds: {},
      focusTarget: null,
    setActiveSession: (sessionId) => {
      set((state) => {
        if (!state.sessions.find((s) => s.id === sessionId)) {
          return;
        }
        state.activeSessionId = sessionId;
      });
    },
    createSession: async ({ title }) => {
      try {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const response = await fetch(`${apiUrl}/api/sessions`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            title,
            subject: "general"
          })
        });
        
        if (!response.ok) {
          throw new Error("Failed to create session");
        }
        
        const data = await response.json();
        const newSession = data.session;
        
        set((state) => {
          state.sessions.unshift(newSession);
          state.activeSessionId = newSession.id;
          state.messages[newSession.id] = [];
          state.canvasObjects[newSession.id] = [];
          state.sources[newSession.id] = [];
          state.timeline[newSession.id] = [];
          state.transcripts[newSession.id] = "";
          state.pins[newSession.id] = [];
        });
        
        return newSession.id;
      } catch (error) {
        // Fallback to local session creation if backend fails
        const id = `session-${nanoid(6)}`;
        const now = new Date().toISOString();
        const newSession: Session = {
          id,
          title,
          createdAt: now
        };
        set((state) => {
          state.sessions.unshift(newSession);
          state.activeSessionId = id;
          state.messages[id] = [];
          state.canvasObjects[id] = [];
          state.sources[id] = [];
          state.timeline[id] = [];
          state.transcripts[id] = "";
          state.pins[id] = [];
        });
        return id;
      }
    },
    addMessage: (sessionId, message) => {
      set((state) => {
        const msg: Message = {
          id: `msg-${nanoid(8)}`,
          timestamp: new Date().toISOString(),
          ...message
        };
        if (!state.messages[sessionId]) {
          state.messages[sessionId] = [];
        }
        state.messages[sessionId].push(msg);
      });
    },
    updateCanvasObject: (sessionId, object) => {
      set((state) => {
        const list = state.canvasObjects[sessionId] ?? [];
        const idx = list.findIndex((item) => item.id === object.id);
        if (idx >= 0) {
          list[idx] = object;
        } else {
          list.push(object);
        }
        state.canvasObjects[sessionId] = list;
      });
    },
    toggleObjectSelection: (sessionId, objectId, keepOthers = false) => {
      set((state) => {
        const list = state.canvasObjects[sessionId];
        if (!list) {
          return;
        }
        if (keepOthers) {
          // Multi-select: toggle the clicked object without clearing others
          state.canvasObjects[sessionId] = list.map((item) =>
            item.id === objectId ? { ...item, selected: !item.selected } : item
          );
        } else {
          // Single select: toggle the clicked object and clear others
          state.canvasObjects[sessionId] = list.map((item) =>
            item.id === objectId ? { ...item, selected: !item.selected } : { ...item, selected: false }
          );
        }
      });
    },
    clearObjectSelection: (sessionId) => {
      set((state) => {
        const list = state.canvasObjects[sessionId];
        if (!list) {
          return;
        }
        state.canvasObjects[sessionId] = list.map((item) => ({ ...item, selected: false }));
      });
    },
    setSelectedObjects: (sessionId, ids) => {
      set((state) => {
        const list = state.canvasObjects[sessionId];
        if (!list) {
          return;
        }
        const idSet = new Set(ids);
        state.canvasObjects[sessionId] = list.map((item) => ({
          ...item,
          selected: idSet.has(item.id)
        }));
      });
    },
    setSources: (sessionId, sources) => {
      set((state) => {
        state.sources[sessionId] = sources;
      });
    },
    setVoiceActive: (value) => {
      set((state) => {
        state.voiceActive = value;
      });
    },
    appendTimelineEvent: (sessionId, event) => {
      set((state) => {
        const timelineEvent: TimelineEvent = {
          id: `tl-${nanoid(6)}`,
          timestamp: new Date().toISOString(),
          ...event
        };
        if (!state.timeline[sessionId]) {
          state.timeline[sessionId] = [];
        }
        state.timeline[sessionId].push(timelineEvent);
      });
    },
    setSourcesDrawerOpen: (open) => {
      set((state) => {
        state.sourcesDrawerOpen = open;
      });
    },
    setCaptionsEnabled: (enabled) => {
      set((state) => {
        state.captionsEnabled = enabled;
      });
    },
    setCanvasMode: (mode) => {
      set((state) => {
        state.canvasMode = mode;
      });
    },
    addPin: (sessionId, payload) => {
      const { x, y, label } = payload;
      const state = get();
      if (!state.sessions.some((session) => session.id === sessionId)) {
        return null;
      }
      const existingPins = state.pins[sessionId] ?? [];
      const pin: Pin = {
        id: `pin-${nanoid(6)}`,
        label: label?.trim() || `Pin ${existingPins.length + 1}`,
        x,
        y,
        createdAt: new Date().toISOString()
      };
      set((state) => {
        if (!state.pins[sessionId]) {
          state.pins[sessionId] = [];
        }
        state.pins[sessionId].push(pin);
      });
      return pin;
    },
    removePin: (sessionId, pinId) => {
      set((state) => {
        const list = state.pins[sessionId];
        if (!list) {
          return;
        }
        state.pins[sessionId] = list.filter((pin) => pin.id !== pinId);
      });
    },
    setCanvasView: (sessionId, view) => {
      set((state) => {
        state.canvasViews[sessionId] = {
          transform: { ...view.transform },
          stageSize: view.stageSize ? { ...view.stageSize } : null
        };
      });
    },
    setSelectionMethod: (sessionId, method) => {
      set((state) => {
        state.selectionMethods[sessionId] = method;
      });
    },
    setLastSelectedObject: (sessionId, objectId) => {
      set((state) => {
        state.lastSelectedObjectIds[sessionId] = objectId;
      });
    },
    bringToFront: (sessionId, objectId) => {
      set((state) => {
        const list = state.canvasObjects[sessionId];
        if (!list) {
          return;
        }
        // Find the highest current zIndex
        const maxZIndex = Math.max(...list.map(obj => obj.zIndex || 0), 0);
        // Update the object's zIndex to be highest + 1
        state.canvasObjects[sessionId] = list.map((item) =>
          item.id === objectId ? { ...item, zIndex: maxZIndex + 1 } : item
        );
      });
    },
    requestFocus: (target) => {
      set((state) => {
        state.focusTarget = target;
      });
    },
    clearFocus: () => {
      set((state) => {
        state.focusTarget = null;
      });
    }
    };
  })
);
