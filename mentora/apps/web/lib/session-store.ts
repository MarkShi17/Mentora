import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "@/lib/utils";
import {
  mockCanvasObjects,
  mockMessages,
  mockSessions,
  mockSources,
  mockTimeline,
  mockTranscripts
} from "@/lib/mock-data";
import {
  CanvasObject,
  Message,
  Session,
  SourceLink,
  TimelineEvent
} from "@/types";

type SessionState = {
  sessions: Session[];
  activeSessionId: string | null;
  messages: Record<string, Message[]>;
  canvasObjects: Record<string, CanvasObject[]>;
  sources: Record<string, SourceLink[]>;
  timeline: Record<string, TimelineEvent[]>;
  transcripts: Record<string, string>;
  voiceActive: boolean;
  sourcesDrawerOpen: boolean;
  captionsEnabled: boolean;
  setActiveSession: (sessionId: string) => void;
  createSession: (payload: { title: string }) => string;
  addMessage: (sessionId: string, message: Omit<Message, "id" | "timestamp">) => void;
  updateCanvasObject: (sessionId: string, object: CanvasObject) => void;
  toggleObjectSelection: (sessionId: string, objectId: string) => void;
  clearObjectSelection: (sessionId: string) => void;
  setSources: (sessionId: string, sources: SourceLink[]) => void;
  setVoiceActive: (value: boolean) => void;
  appendTimelineEvent: (sessionId: string, event: Omit<TimelineEvent, "id" | "timestamp">) => void;
  setSourcesDrawerOpen: (open: boolean) => void;
  setCaptionsEnabled: (enabled: boolean) => void;
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
    voiceActive: false,
    sourcesDrawerOpen: false,
    captionsEnabled: true,
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
    }
  }))
);
