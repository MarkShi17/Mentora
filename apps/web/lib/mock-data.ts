import { CanvasObject, Message, Pin, Session, SourceLink, TimelineEvent } from "@/types";

const BASE_TIMESTAMP = Date.parse("2024-01-15T15:30:00.000Z");
const isoPlus = (minutes: number) => new Date(BASE_TIMESTAMP + minutes * 60_000).toISOString();

export const mockSessions: Session[] = [
  {
    id: "session-1",
    title: "Exploring Linked Lists",
    createdAt: isoPlus(0)
  },
  {
    id: "session-2",
    title: "Visualizing Calculus Limits",
    createdAt: isoPlus(90)
  }
];

export const mockMessages: Record<string, Message[]> = {
  "session-1": [
    {
      id: "m-1",
      role: "assistant",
      content:
        "Welcome! Let's break down linked lists by building a simple mental model together.",
      timestamp: isoPlus(1)
    },
    {
      id: "m-2",
      role: "user",
      content: "How do pointers actually move through the list?",
      timestamp: isoPlus(3)
    }
  ],
  "session-2": [
    {
      id: "m-3",
      role: "assistant",
      content: "Let's explore how the function behaves as we approach the limit.",
      timestamp: isoPlus(95)
    }
  ]
};

export const mockCanvasObjects: Record<string, CanvasObject[]> = {
  "session-1": [
    {
      id: "obj-1",
      type: "diagram",
      label: "Node Diagram",
      x: 0,
      y: 0,
      width: 180,
      height: 120,
      color: "#38bdf8",
      metadata: {
        description: "Nodes linked via next pointers."
      }
    },
    {
      id: "obj-2",
      type: "note",
      label: "Traversal Steps",
      x: 200,
      y: 0,
      width: 160,
      height: 200,
      color: "#f97316"
    }
  ],
  "session-2": [
    {
      id: "obj-3",
      type: "formula",
      label: "lim_{x→0} sin(x)/x",
      x: 0,
      y: 0,
      width: 220,
      height: 80,
      color: "#a855f7"
    }
  ]
};

export const mockSources: Record<string, SourceLink[]> = {
  "session-1": [
    {
      id: "src-1",
      title: "CS50 Linked Lists",
      url: "https://example.com/cs50-linked-lists",
      snippet: "Linked lists store references (pointers) to the next node.",
      score: 0.92
    },
    {
      id: "src-2",
      title: "Visualizing Pointers",
      url: "https://example.com/pointer-visuals",
      snippet: "Visualization techniques to understand pointer updates.",
      score: 0.87
    }
  ],
  "session-2": [
    {
      id: "src-3",
      title: "Squeeze Theorem Example",
      url: "https://example.com/squeeze-theorem",
      snippet: "Understanding limits with bounding functions.",
      score: 0.81
    }
  ]
};

export const mockTimeline: Record<string, TimelineEvent[]> = {
  "session-1": [
    {
      id: "timeline-1",
      timestamp: isoPlus(2),
      type: "prompt",
      description: "Learner asked about pointer traversal."
    },
    {
      id: "timeline-2",
      timestamp: isoPlus(4),
      type: "visual",
      description: "Generated diagram showing linked list nodes."
    }
  ],
  "session-2": [
    {
      id: "timeline-3",
      timestamp: isoPlus(97),
      type: "response",
      description: "Mentor explained behavior near zero."
    }
  ]
};

export const mockTranscripts: Record<string, string> = {
  // "session-1": "Assistant: Welcome! User: How do pointers move through the list?",
  // "session-2": "Assistant: Let's explore the limit together."
};

export const mockPins: Record<string, Pin[]> = {
  "session-1": [],
  "session-2": []
};
