# Debugging Voice Triggers

## Quick Test Steps

1. **Open the app** - You should see only 1 object: "Mentora - AI-Powered Tutoring Platform"

2. **Open browser console** (F12 or Cmd+Option+I)

3. **Type in the text box**: "what are you"

4. **Check console for logs**:
   ```
   🎯 Demo trigger detected: "architecture" from message: "what are you"
   ✅ Found source object: obj-XXXXXXXX, revealing objects...
   ```

5. **Objects should appear**: Architecture Overview, Tech Stack, How It Works

6. **Check for connections**: Lines should draw from Main Title to the 3 new objects

## Troubleshooting

### No console logs appear

**Check 1: Is the session the demo session?**
```javascript
// In browser console:
const store = useSessionStore.getState();
const session = store.sessions.find(s => s.title.includes('Demo'));
console.log('Demo session:', session);
```

**Check 2: Are messages being added?**
```javascript
// In browser console:
const store = useSessionStore.getState();
const messages = store.messages[store.activeSessionId];
console.log('Messages:', messages);
```

**Check 3: Is the hook running?**
- The hook should log messages when triggered
- If no logs, the hook might not be mounted
- Check that `canvas-stage.tsx` is importing and calling `useDemoVoiceHandler`

### Console logs appear but objects don't reveal

**Check 1: Are objects marked as hidden?**
```javascript
// In browser console:
const store = useSessionStore.getState();
const objects = store.canvasObjects[store.activeSessionId];
console.log('Hidden objects:', objects.filter(o => o.hidden));
console.log('Visible objects:', objects.filter(o => !o.hidden));
```

**Check 2: Are demo groups set correctly?**
```javascript
// In browser console:
const store = useSessionStore.getState();
const objects = store.canvasObjects[store.activeSessionId];
objects.forEach(o => console.log(o.label, '- hidden:', o.hidden, '- group:', o.demoGroup));
```

**Check 3: Is revealDemoObjects being called?**
- Add a console.log in `session-store.ts` inside `revealDemoObjects` action
- Should see objects being unhidden

### Objects appear but no connections

**Check 1: Is createConnection being called?**
```javascript
// In browser console:
const store = useSessionStore.getState();
const connections = store.connections[store.activeSessionId];
console.log('Connections:', connections);
```

**Check 2: Is source object ID valid?**
- Check console logs for "Found source object" message
- Verify the ID matches an actual object

## Manual Testing

### Test in console directly:

```javascript
// Get the store
const store = useSessionStore.getState();
const sessionId = store.activeSessionId;

// Get canvas objects
const objects = store.canvasObjects[sessionId];
console.log('Total objects:', objects.length);

// Find source
const source = objects.find(o => o.demoGroup === 'intro');
console.log('Source object:', source);

// Manually reveal architecture group
store.revealDemoObjects(sessionId, 'architecture', source?.id);

// Check if revealed
const revealed = objects.filter(o => o.demoGroup === 'architecture' && !o.hidden);
console.log('Revealed architecture objects:', revealed);
```

### Test trigger detection:

```javascript
// Copy the detectTrigger function logic
const text = 'what are you';
const lowerText = text.toLowerCase();
const architectureTriggers = ['what are you', 'who are you'];
const matches = architectureTriggers.some(trigger => lowerText.includes(trigger));
console.log('Trigger matches:', matches); // Should be true
```

## Common Issues

### 1. Session is not the demo session
**Solution**: Make sure you're on the "Mentora Demo - Hackathon Showcase" session

### 2. Objects already visible
**Solution**: Refresh the page to reset the demo session

### 3. Multiple reveals happening
**Solution**: The hook tracks revealed groups to prevent duplicates, but a page refresh will reset this

### 4. Trigger phrases not matching
**Solution**: Check the exact text being sent. The match is case-insensitive but must contain the trigger phrase

## Debug Logs to Add

If still having issues, add these console.logs:

**In `use-demo-voice-handler.ts`**:
```typescript
useEffect(() => {
  console.log('🔍 Voice handler check:', {
    sessionId,
    messageCount: messages.length,
    lastMessage: messages[messages.length - 1],
    canvasObjectCount: canvasObjects.length
  });

  // ... rest of code
}, [sessionId, messages, canvasObjects, revealDemoObjects]);
```

**In `session-store.ts` `revealDemoObjects` action**:
```typescript
revealDemoObjects: (sessionId, demoGroup, sourceObjectId) => {
  console.log('🎨 revealDemoObjects called:', { sessionId, demoGroup, sourceObjectId });

  set((state) => {
    const list = state.canvasObjects[sessionId];
    console.log('📦 Canvas objects:', list?.length);

    if (!list) return;

    const objectsToReveal = list.filter(
      (obj) => obj.demoGroup === demoGroup && obj.hidden === true
    );
    console.log('👁️ Objects to reveal:', objectsToReveal.length, objectsToReveal.map(o => o.label));

    // ... rest of code
  });
},
```

## Expected Flow

1. User types "what are you"
2. Message added to store with role='user'
3. Voice handler detects new message
4. Trigger detection runs → finds 'architecture'
5. Source object found (Main Title with demoGroup='intro')
6. `revealDemoObjects` called with ('architecture', sourceId)
7. 3 objects with demoGroup='architecture' set to hidden=false
8. Connections created from source to each revealed object
9. Canvas-stage filters and renders newly visible objects
10. Connection layer draws the lines

## Quick Fixes

### Force reveal without trigger:
```javascript
const store = useSessionStore.getState();
const sessionId = store.activeSessionId;
const objects = store.canvasObjects[sessionId];
const source = objects.find(o => o.demoGroup === 'intro');
store.revealDemoObjects(sessionId, 'architecture', source?.id);
store.revealDemoObjects(sessionId, 'features', source?.id);
```

### Reset demo (hide all again):
```javascript
const store = useSessionStore.getState();
const sessionId = store.activeSessionId;
const objects = store.canvasObjects[sessionId];
objects.forEach(obj => {
  if (obj.demoGroup !== 'intro') {
    obj.hidden = true;
  }
});
// Force re-render
store.updateCanvasObjects(sessionId, [...objects]);
```

---

**Last Updated**: 2025-10-26
