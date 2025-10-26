import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { nanoid } from "@/lib/utils";
import {
  BrainType,
  CanvasObject,
  ConnectionAnchor,
  Message,
  ObjectConnection,
  Pin,
  Session,
  SourceLink,
  TimelineEvent,
  VoiceOption
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
  smooth?: boolean;
  duration?: number;
  scale?: number;
  offsetX?: number;
  offsetY?: number;
} | null;

type FocusTargetInput = NonNullable<FocusTarget>;

type Settings = {
  preferredName: string;
  voice: VoiceOption;
  explanationLevel: "beginner" | "intermediate" | "advanced";
};

type VoiceInputState = {
  isLiveTutorOn: boolean;
  spacebarTranscript: string;
  isPushToTalkActive: boolean;
};

type BrainState = {
  brainType: BrainType | null;
  brainName: string | null;
  confidence: number | null;
  reasoning: string | null;
};

type MCPToolStatus = {
  toolName: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  startTime?: number;
  endTime?: number;
  error?: string;
};

type CanvasAction = {
  type: 'add' | 'delete' | 'move' | 'resize' | 'connect' | 'disconnect';
  timestamp: number;
  objects?: CanvasObject[]; // State before action (for undo)
  metadata?: any; // Additional info about the action
};

type CanvasHistory = {
  undoStack: CanvasAction[];
  redoStack: CanvasAction[];
};

type SessionState = {
  sessions: Session[];
  activeSessionId: string | null;
  messages: Record<string, Message[]>;
  canvasObjects: Record<string, CanvasObject[]>;
  connections: Record<string, ObjectConnection[]>;
  canvasHistory: Record<string, CanvasHistory>;
  sources: Record<string, SourceLink[]>;
  timeline: Record<string, TimelineEvent[]>;
  transcripts: Record<string, string>;
  pins: Record<string, Pin[]>;
  voiceActive: boolean;
  sourcesDrawerOpen: boolean;
  sidebarOpen: boolean;
  timelineOpen: boolean;
  captionsEnabled: boolean;
  sessionsWithFirstInput: Record<string, boolean>;
  canvasMode: "pan" | "lasso" | "pin";
  canvasViews: Record<string, CanvasView>;
  selectionMethods: Record<string, "click" | "lasso">;
  lastSelectedObjectIds: Record<string, string | null>;
  focusTarget: FocusTarget;
  layoutOffsets: {
    left: number;
    right: number;
    top: number;
    bottom: number;
  };
  settings: Settings;
  voiceInputState: VoiceInputState;
  stopStreamingCallback: (() => void) | null;
  rerunQuestionCallback: ((question: string) => void) | null;
  activeBrain: Record<string, BrainState>;
  mcpToolStatus: Record<string, MCPToolStatus[]>;
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
  revealDemoObjects: (sessionId: string, demoGroup: 'architecture' | 'features', sourceObjectId?: string) => void;
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
  setSidebarOpen: (open: boolean) => void;
  setTimelineOpen: (open: boolean) => void;
  setCaptionsEnabled: (enabled: boolean) => void;
  markSessionAsHavingFirstInput: (sessionId: string) => void;
  setCanvasMode: (mode: "pan" | "lasso" | "pin") => void;
  addPin: (sessionId: string, payload: { x: number; y: number; label?: string }) => Pin | null;
  removePin: (sessionId: string, pinId: string) => void;
  setCanvasView: (sessionId: string, view: CanvasView) => void;
  requestFocus: (target: FocusTargetInput) => void;
  clearFocus: () => void;
  setLayoutOffset: (side: 'left' | 'right' | 'top' | 'bottom', value: number) => void;
  updateSettings: (settings: Partial<Settings>) => void;
  setLiveTutorOn: (on: boolean) => void;
  setSpacebarTranscript: (transcript: string) => void;
  setIsPushToTalkActive: (active: boolean) => void;
  setStopStreamingCallback: (callback: (() => void) | null) => void;
  setRerunQuestionCallback: (callback: ((question: string) => void) | null) => void;
  createConnection: (sessionId: string, sourceObjectId: string, targetObjectId: string, sourceAnchor: ConnectionAnchor, targetAnchor: ConnectionAnchor) => string;
  deleteConnection: (sessionId: string, connectionId: string) => void;
  deleteConnectionsByObjectId: (sessionId: string, objectId: string) => void;
  getConnectionsForObject: (sessionId: string, objectId: string) => ObjectConnection[];
  getConnectionsByAnchor: (sessionId: string, objectId: string, anchor: ConnectionAnchor) => ObjectConnection[];
  setBrainState: (sessionId: string, brain: BrainState) => void;
  addMCPToolStatus: (sessionId: string, tool: MCPToolStatus) => void;
  updateMCPToolStatus: (sessionId: string, toolName: string, updates: Partial<MCPToolStatus>) => void;
  clearMCPToolStatus: (sessionId: string) => void;
  // Undo/Redo actions
  pushCanvasAction: (sessionId: string, action: Omit<CanvasAction, 'timestamp'>) => void;
  undoCanvasAction: (sessionId: string) => void;
  redoCanvasAction: (sessionId: string) => void;
  canUndo: (sessionId: string) => boolean;
  canRedo: (sessionId: string) => boolean;
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
      connections: {},
      canvasHistory: {},
      sources: {},
      timeline: {},
      transcripts: {},
      pins: {},
      voiceActive: false,
      sourcesDrawerOpen: false,
      sidebarOpen: true,
      timelineOpen: false,
      captionsEnabled: true,
      sessionsWithFirstInput: {},
      canvasMode: "pan",
      canvasViews: {},
      selectionMethods: {},
      lastSelectedObjectIds: {},
      focusTarget: null,
      layoutOffsets: {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0,
      },
      settings: {
        preferredName: "",
        voice: 'alloy' as VoiceOption,
        explanationLevel: "intermediate"
      },
      voiceInputState: {
        isLiveTutorOn: false,
        spacebarTranscript: "",
        isPushToTalkActive: false
      },
      stopStreamingCallback: null,
      rerunQuestionCallback: null,
      activeBrain: {},
      mcpToolStatus: {},
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
          state.connections[newSession.id] = [];
          state.sources[newSession.id] = [];
          state.timeline[newSession.id] = [];
          state.transcripts[newSession.id] = "";
          state.pins[newSession.id] = [];
          state.activeBrain[newSession.id] = { brainType: null, brainName: null, confidence: null, reasoning: null };
          state.mcpToolStatus[newSession.id] = [];
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
          state.connections[id] = [];
          state.sources[id] = [];
          state.timeline[id] = [];
          state.transcripts[id] = "";
          state.pins[id] = [];
          state.activeBrain[id] = { brainType: null, brainName: null, confidence: null, reasoning: null };
          state.mcpToolStatus[id] = [];
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
        delete state.connections[sessionId];
        delete state.sources[sessionId];
        delete state.timeline[sessionId];
        delete state.transcripts[sessionId];
        delete state.pins[sessionId];
        delete state.canvasViews[sessionId];
        delete state.selectionMethods[sessionId];
        delete state.lastSelectedObjectIds[sessionId];
        delete state.activeBrain[sessionId];
        delete state.mcpToolStatus[sessionId];

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
      // Save state before update for undo
      const state = get();
      const currentObjects = [...(state.canvasObjects[sessionId] || [])];

      set((state) => {
        state.canvasObjects[sessionId] = objects;
      });

      // Push to undo stack (this handles move/resize operations)
      get().pushCanvasAction(sessionId, {
        type: 'move', // Generic type for any object update
        objects: currentObjects,
      });
    },
    deleteCanvasObjects: (sessionId, objectIds) => {
      // Save state before deletion for undo
      const state = get();
      const currentObjects = [...(state.canvasObjects[sessionId] || [])];

      set((state) => {
        const list = state.canvasObjects[sessionId];
        if (!list) {
          return;
        }
        // Filter out objects with IDs in the objectIds array
        state.canvasObjects[sessionId] = list.filter((obj) => !objectIds.includes(obj.id));


        // Clear selection method and last selected object
        delete state.selectionMethods[sessionId];
        state.lastSelectedObjectIds[sessionId] = null;
      });

      // Push to undo stack
      get().pushCanvasAction(sessionId, {
        type: 'delete',
        objects: currentObjects,
        metadata: { deletedIds: objectIds }
      });
    },
    revealDemoObjects: (sessionId, demoGroup, sourceObjectId) => {
      const state = get();
      const list = state.canvasObjects[sessionId];
      if (!list) {
        return;
      }

      // Find all objects in the demo group that are hidden
      const objectsToReveal = list.filter(
        (obj) => obj.demoGroup === demoGroup && obj.hidden === true
      );

      if (objectsToReveal.length === 0) {
        return;
      }

      const sourceObj = list.find((obj) => obj.id === sourceObjectId);
      if (!sourceObj) {
        return;
      }

      // Calculate sequential left-to-right chain positions
      // Objects chain sequentially: A -> B -> C -> D (sideways tree)
      const HORIZONTAL_SPACING = 100; // Distance between sequential objects
      const VERTICAL_SPACING = 50; // Small vertical offset for visual variety

      // Start from source position
      let currentX = sourceObj.x + (sourceObj.width || 800) + HORIZONTAL_SPACING;
      let currentY = sourceObj.y;
      let previousObjectId = sourceObjectId;

      // Position and reveal each object with staggered animation delays
      console.log(`🎬 Revealing ${objectsToReveal.length} objects with sequential animation`);

      objectsToReveal.forEach((obj, index) => {
        const objWidth = obj.width || 600;
        const objHeight = obj.height || 200;
        const delay = index * 150; // 150ms delay between each reveal for animation effect

        // Capture current values for the setTimeout closure
        const targetX = currentX;
        const targetY = currentY;
        const prevId = previousObjectId;

        console.log(`⏱️  Object ${index + 1}/${objectsToReveal.length}: "${obj.label}" will appear in ${delay}ms`);

        setTimeout(() => {
          console.log(`✨ Revealing object: "${obj.label}" at (${targetX}, ${targetY})`);

          set((state) => {
            const targetObj = state.canvasObjects[sessionId]?.find(o => o.id === obj.id);
            if (targetObj) {
              targetObj.hidden = false;
              targetObj.x = targetX;
              targetObj.y = targetY;
            }
          });

          // Create connection from PREVIOUS object to THIS object (sequential chain)
          console.log(`🔗 Creating connection: ${prevId} -> ${obj.id}`);
          get().createConnection(sessionId, prevId, obj.id, 'east', 'west');
        }, delay);

        // Update for next iteration
        currentX += objWidth + HORIZONTAL_SPACING;
        currentY += VERTICAL_SPACING; // Slight vertical stagger
        previousObjectId = obj.id;
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
    setSidebarOpen: (open) => {
      set((state) => {
        state.sidebarOpen = open;
      });
    },
    setTimelineOpen: (open) => {
      set((state) => {
        state.timelineOpen = open;
      });
    },
    setCaptionsEnabled: (enabled) => {
      set((state) => {
        state.captionsEnabled = enabled;
      });
    },
    markSessionAsHavingFirstInput: (sessionId) => {
      set((state) => {
        state.sessionsWithFirstInput[sessionId] = true;
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
    setLayoutOffset: (side, value) => {
      set((state) => {
        state.layoutOffsets[side] = Math.max(0, value);
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
    },
    createConnection: (sessionId, sourceObjectId, targetObjectId, sourceAnchor, targetAnchor) => {
      const connection: ObjectConnection = {
        id: `conn-${nanoid(6)}`,
        sourceObjectId,
        targetObjectId,
        sourceAnchor,
        targetAnchor,
        createdAt: new Date().toISOString()
      };
      set((state) => {
        if (!state.connections[sessionId]) {
          state.connections[sessionId] = [];
        }
        state.connections[sessionId].push(connection);
      });
      return connection.id;
    },
    deleteConnection: (sessionId, connectionId) => {
      set((state) => {
        const list = state.connections[sessionId];
        if (!list) {
          return;
        }
        state.connections[sessionId] = list.filter((conn) => conn.id !== connectionId);
      });
    },
    deleteConnectionsByObjectId: (sessionId, objectId) => {
      set((state) => {
        const list = state.connections[sessionId];
        if (!list) {
          return;
        }
        // Remove all connections where this object is either source or target
        state.connections[sessionId] = list.filter(
          (conn) => conn.sourceObjectId !== objectId && conn.targetObjectId !== objectId
        );
      });
    },
    getConnectionsForObject: (sessionId, objectId) => {
      const state = get();
      const connections = state.connections[sessionId] || [];
      return connections.filter(
        (conn) => conn.sourceObjectId === objectId || conn.targetObjectId === objectId
      );
    },
    getConnectionsByAnchor: (sessionId, objectId, anchor) => {
      const state = get();
      const connections = state.connections[sessionId] || [];
      return connections.filter(
        (conn) => 
          (conn.sourceObjectId === objectId && conn.sourceAnchor === anchor) ||
          (conn.targetObjectId === objectId && conn.targetAnchor === anchor)
      );
    },
    setBrainState: (sessionId, brain) => {
      set((state) => {
        state.activeBrain[sessionId] = brain;
      });
    },
    addMCPToolStatus: (sessionId, tool) => {
      set((state) => {
        if (!state.mcpToolStatus[sessionId]) {
          state.mcpToolStatus[sessionId] = [];
        }
        state.mcpToolStatus[sessionId].push(tool);
      });
    },
    updateMCPToolStatus: (sessionId, toolName, updates) => {
      set((state) => {
        const tools = state.mcpToolStatus[sessionId];
        if (!tools) return;

        const tool = tools.find(t => t.toolName === toolName && t.status === 'running');
        if (tool) {
          Object.assign(tool, updates);
        }
      });
    },
    clearMCPToolStatus: (sessionId) => {
      set((state) => {
        state.mcpToolStatus[sessionId] = [];
      });
    },

    // Undo/Redo implementation
    pushCanvasAction: (sessionId, action) => {
      set((state) => {
        if (!state.canvasHistory[sessionId]) {
          state.canvasHistory[sessionId] = { undoStack: [], redoStack: [] };
        }

        const history = state.canvasHistory[sessionId];
        const MAX_HISTORY = 50; // Limit history size

        // Add action with timestamp
        history.undoStack.push({ ...action, timestamp: Date.now() });

        // Trim history if too large
        if (history.undoStack.length > MAX_HISTORY) {
          history.undoStack.shift();
        }

        // Clear redo stack when new action is performed
        history.redoStack = [];
      });
    },

    undoCanvasAction: (sessionId) => {
      const state = get();
      const history = state.canvasHistory[sessionId];

      if (!history || history.undoStack.length === 0) {
        return;
      }

      set((draft) => {
        const currentHistory = draft.canvasHistory[sessionId];
        if (!currentHistory) return;

        const action = currentHistory.undoStack.pop();
        if (!action) return;

        // Save current state to redo stack before undoing
        const currentObjects = [...(draft.canvasObjects[sessionId] || [])];

        currentHistory.redoStack.push({
          ...action,
          objects: currentObjects,
        });

        // Restore previous state
        if (action.objects) {
          draft.canvasObjects[sessionId] = action.objects;
        }

        console.log('↩️ Undo action:', action.type);
      });
    },

    redoCanvasAction: (sessionId) => {
      const state = get();
      const history = state.canvasHistory[sessionId];

      if (!history || history.redoStack.length === 0) {
        return;
      }

      set((draft) => {
        const currentHistory = draft.canvasHistory[sessionId];
        if (!currentHistory) return;

        const action = currentHistory.redoStack.pop();
        if (!action) return;

        // Save current state to undo stack before redoing
        const currentObjects = [...(draft.canvasObjects[sessionId] || [])];

        currentHistory.undoStack.push({
          ...action,
          objects: currentObjects,
        });

        // Restore redo state
        if (action.objects) {
          draft.canvasObjects[sessionId] = action.objects;
        }

        console.log('↪️ Redo action:', action.type);
      });
    },

    canUndo: (sessionId) => {
      const state = get();
      const history = state.canvasHistory[sessionId];
      return !!(history && history.undoStack.length > 0);
    },

    canRedo: (sessionId) => {
      const state = get();
      const history = state.canvasHistory[sessionId];
      return !!(history && history.redoStack.length > 0);
    }
    };
  })
);
