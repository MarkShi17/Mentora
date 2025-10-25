import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "@/lib/utils";
import {
  mockCanvasObjects,
  mockMessages,
  mockPins,
  mockSessions,
  mockSources,
  mockTimeline,
  mockTranscripts
} from "@/lib/mock-data";
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
  canvasViews: Record<string, CanvasView>;
  voiceActive: boolean;
  sourcesDrawerOpen: boolean;
  captionsEnabled: boolean;
  canvasMode: "pan" | "lasso" | "pin";
  focusTarget: FocusTarget;
  setActiveSession: (sessionId: string) => void;
  createSession: (payload: { title: string }) => string;
  addMessage: (sessionId: string, message: Omit<Message, "id" | "timestamp">) => void;
  updateCanvasObject: (sessionId: string, object: CanvasObject) => void;
  toggleObjectSelection: (sessionId: string, objectId: string) => void;
  clearObjectSelection: (sessionId: string) => void;
  setSelectedObjects: (sessionId: string, ids: string[]) => void;
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
  withImmer((set, get) => ({
    sessions: mockSessions,
    activeSessionId: mockSessions[0]?.id ?? null,
    messages: mockMessages,
    canvasObjects: mockCanvasObjects,
    sources: mockSources,
    timeline: mockTimeline,
    transcripts: mockTranscripts,
    pins: mockSessions.reduce<Record<string, Pin[]>>((acc, session) => {
      const source = mockPins[session.id] ?? [];
      acc[session.id] = source.map((pin) => ({ ...pin }));
      return acc;
    }, {}),
    canvasViews: {},
    voiceActive: false,
    sourcesDrawerOpen: false,
    captionsEnabled: true,
    canvasMode: "pan",
    focusTarget: null,
    setActiveSession: (sessionId) => {
      set((state) => {
        if (!state.sessions.find((s) => s.id === sessionId)) {
          return;
        }
        state.activeSessionId = sessionId;
      });
    },
    createSession: ({ title }) => {
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
        state.canvasViews[id] = { transform: { x: 0, y: 0, k: 1 }, stageSize: null };
      });
      return id;
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
    toggleObjectSelection: (sessionId, objectId) => {
      set((state) => {
        const list = state.canvasObjects[sessionId];
        if (!list) {
          return;
        }
        state.canvasObjects[sessionId] = list.map((item) =>
          item.id === objectId ? { ...item, selected: !item.selected } : { ...item, selected: false }
        );
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
  }))
);
