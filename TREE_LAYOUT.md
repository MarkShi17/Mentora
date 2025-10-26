# Alternating Tree Branch Layout

## Overview

Objects now branch out from the main title in **alternating directions** (left and right), creating a natural tree structure with short connector lines and objects spread far apart vertically.

## Tree Structure

```
                    [Architecture]
                          ↑
                          | (250px)
                          |
[How It Works] ←──────[MENTORA]──────→ [Key Features]
      ↑                 800x200
      | (250px)            |
      |                    | (250px)
                           ↓
                    [Use Cases]
                           |
                           | (250px)
                           ↓
              [Teaching Modes]
                           |
                           | (250px)
                           ↓
                    [Try It Now]
```

## Branching Logic

**Pattern**: Alternates left-right-left-right...

- **Index 0 (even)**: Branches **RIGHT** → Architecture
- **Index 1 (odd)**: Branches **LEFT** → How It Works
- **Index 2 (even)**: Branches **RIGHT** → Key Features
- **Index 3 (odd)**: Branches **LEFT** → Use Cases
- **Index 4 (even)**: Branches **RIGHT** → Teaching Modes
- **Index 5 (odd)**: Branches **LEFT** → Try It Now

## Spacing

- **Horizontal spacing**: 250px (short connectors)
- **Vertical spacing**: 400px (objects spread far apart)
- **Main title size**: 800x200 (large and prominent)

## Voice Triggers

### Trigger 1: "What are you?"
Reveals 2 objects in alternating pattern:
1. **Architecture** (right) - 0ms delay
2. **How It Works** (left) - 150ms delay

### Trigger 2: "What are your features?"
Reveals 4 objects in alternating pattern:
1. **Key Features** (right) - 0ms delay
2. **Use Cases** (left) - 150ms delay
3. **Teaching Modes** (right) - 300ms delay
4. **Try It Now** (left) - 450ms delay

## Animation Sequence

When user asks "what are you?":
```
1. 0ms:   Connection draws to the right
          Architecture appears on right side
2. 150ms: Connection draws to the left
          How It Works appears on left side
```

When user asks "what are your features?":
```
1. 0ms:   Connection draws to the right
          Key Features appears on right side
2. 150ms: Connection draws to the left
          Use Cases appears on left side
3. 300ms: Connection draws to the right
          Teaching Modes appears on right side
4. 450ms: Connection draws to the left
          Try It Now appears on left side
```

## Connection Anchors

- **Right branches**: Source east anchor → Target west anchor
- **Left branches**: Source west anchor → Target east anchor

This creates clean, short connections that branch naturally in both directions!

---

**Status**: ✅ Implemented
**Last Updated**: 2025-10-26
