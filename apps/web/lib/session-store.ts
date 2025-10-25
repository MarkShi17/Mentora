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

type Settings = {
  preferredName: string;
  voice: string;
  explanationLevel: "beginner" | "intermediate" | "advanced";
};

type VoiceInputState = {
  isLiveTutorOn: boolean;
  spacebarTranscript: string;
  isPushToTalkActive: boolean;
};

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
  settings: Settings;
  voiceInputState: VoiceInputState;
  stopStreamingCallback: (() => void) | null;
  rerunQuestionCallback: ((question: string) => void) | null;
  setActiveSession: (sessionId: string) => void;
  createSession: (payload: { title: string }) => Promise<string>;
  updateSessionTitle: (sessionId: string, title: string) => void;
  deleteSession: (sessionId: string) => void;
  // initializeDefaultSession: () => Promise<void>; // Removed - no longer auto-creating sessions
  addMessage: (sessionId: string, message: Omit<Message, "id" | "timestamp">) => string;
  updateMessage: (sessionId: string, messageId: string, updates: Partial<Omit<Message, "id" | "timestamp">>) => void;
  removeMessage: (sessionId: string, messageId: string) => void;
  updateCanvasObject: (sessionId: string, object: CanvasObject) => void;
  updateCanvasObjects: (sessionId: string, objects: CanvasObject[]) => void;
  deleteCanvasObjects: (sessionId: string, objectIds: string[]) => void;
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
  updateSettings: (settings: Partial<Settings>) => void;
  setLiveTutorOn: (on: boolean) => void;
  setSpacebarTranscript: (transcript: string) => void;
  setIsPushToTalkActive: (active: boolean) => void;
  setStopStreamingCallback: (callback: (() => void) | null) => void;
  setRerunQuestionCallback: (callback: ((question: string) => void) | null) => void;
};

const withImmer = immer<SessionState>;

export const useSessionStore = create<SessionState>()(
  withImmer((set, get) => {
    // Initialize with empty state - we'll create a session when the app loads
    return {
      sessions: [],
      activeSessionId: null,
      messages: {},
      canvasObjects: {},
      sources: {},
      timeline: {},
      transcripts: {},
      pins: {},
      voiceActive: false,
      sourcesDrawerOpen: false,
      captionsEnabled: true,
      canvasMode: "pan",
      canvasViews: {},
      selectionMethods: {},
      lastSelectedObjectIds: {},
      focusTarget: null,
      settings: {
        preferredName: "",
        voice: "alloy",
        explanationLevel: "intermediate"
      },
      voiceInputState: {
        isLiveTutorOn: false,
        spacebarTranscript: "",
        isPushToTalkActive: false
      },
      stopStreamingCallback: null,
      rerunQuestionCallback: null,
    setActiveSession: (sessionId) => {
      set((state) => {
        if (!state.sessions.find((s) => s.id === sessionId)) {
          return;
        }
        state.activeSessionId = sessionId;
      });
    },
    // initializeDefaultSession: async () => {
    //   const state = get();
    //   // Only create a default session if we don't have any sessions
    //   if (state.sessions.length === 0) {
    //     const now = new Date();
    //     const hours = now.getHours();
    //     const minutes = now.getMinutes();
    //     const ampm = hours >= 12 ? 'PM' : 'AM';
    //     const displayHours = hours % 12 || 12;
    //     const displayMinutes = minutes.toString().padStart(2, '0');
    //     const timeString = `${displayHours}:${displayMinutes} ${ampm}`;
    //     const title = `New Lesson ${timeString}`;
        
    //     try {
    //       await get().createSession({ title });
    //     } catch (error) {
    //       console.error("Failed to create default session:", error);
    //     }
    //   }
    // },
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
          const errorText = await response.text();
          console.error("Session creation failed:", errorText);
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
    updateSessionTitle: (sessionId, title) => {
      set((state) => {
        const session = state.sessions.find((s) => s.id === sessionId);
        if (session) {
          session.title = title;
        }
      });
    },
    deleteSession: (sessionId) => {
      set((state) => {
        // Remove session from sessions array
        state.sessions = state.sessions.filter((s) => s.id !== sessionId);

        // Clean up all related data
        delete state.messages[sessionId];
        delete state.canvasObjects[sessionId];
        delete state.sources[sessionId];
        delete state.timeline[sessionId];
        delete state.transcripts[sessionId];
        delete state.pins[sessionId];
        delete state.canvasViews[sessionId];
        delete state.selectionMethods[sessionId];
        delete state.lastSelectedObjectIds[sessionId];

        // If we deleted the active session, switch to another session or set to null
        if (state.activeSessionId === sessionId) {
          state.activeSessionId = state.sessions.length > 0 ? state.sessions[0].id : null;
        }
      });
    },
    addMessage: (sessionId, message) => {
      const msg: Message = {
        id: `msg-${nanoid(8)}`,
        timestamp: new Date().toISOString(),
        ...message
      };
      set((state) => {
        if (!state.messages[sessionId]) {
          state.messages[sessionId] = [];
        }
        state.messages[sessionId].push(msg);
      });
      return msg.id;
    },
    updateMessage: (sessionId, messageId, updates) => {
      set((state) => {
        const messages = state.messages[sessionId];
        if (!messages) return;

        const msgIndex = messages.findIndex(m => m.id === messageId);
        if (msgIndex >= 0) {
          state.messages[sessionId][msgIndex] = {
            ...messages[msgIndex],
            ...updates
          };
        }
      });
    },
    removeMessage: (sessionId, messageId) => {
      set((state) => {
        const messages = state.messages[sessionId];
        if (!messages) return;

        state.messages[sessionId] = messages.filter(m => m.id !== messageId);
      });
    },
    updateCanvasObject: (sessionId, object) => {
      set((state) => {
        if (!state.canvasObjects[sessionId]) {
          state.canvasObjects[sessionId] = [];
        }
        const idx = state.canvasObjects[sessionId].findIndex((item) => item.id === object.id);
        if (idx >= 0) {
          state.canvasObjects[sessionId][idx] = object;
        } else {
          state.canvasObjects[sessionId].push(object);
        }
      });
    },
    updateCanvasObjects: (sessionId, objects) => {
      set((state) => {
        state.canvasObjects[sessionId] = objects;
      });
    },
    deleteCanvasObjects: (sessionId, objectIds) => {
      set((state) => {
        const list = state.canvasObjects[sessionId];
        if (!list) {
          return;
        }
        // Filter out objects with IDs in the objectIds array
        state.canvasObjects[sessionId] = list.filter((obj) => !objectIds.includes(obj.id));

        // Clear selection method and last selected object
        state.selectionMethods[sessionId] = undefined;
        state.lastSelectedObjectIds[sessionId] = null;
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
    },
    updateSettings: (settings) => {
      set((state) => {
        state.settings = { ...state.settings, ...settings };
      });
    },
    setLiveTutorOn: (on) => {
      set((state) => {
        state.voiceInputState.isLiveTutorOn = on;
      });
    },
    setSpacebarTranscript: (transcript) => {
      set((state) => {
        state.voiceInputState.spacebarTranscript = transcript;
      });
    },
    setIsPushToTalkActive: (active) => {
      set((state) => {
        state.voiceInputState.isPushToTalkActive = active;
      });
    },
    setStopStreamingCallback: (callback) => {
      set((state) => {
        state.stopStreamingCallback = callback;
      });
    },
    setRerunQuestionCallback: (callback) => {
      set((state) => {
        state.rerunQuestionCallback = callback;
      });
    }
    };
  })
);
