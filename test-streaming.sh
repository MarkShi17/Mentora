#!/bin/bash

# Test the streaming QA endpoint with the new event-based format

echo "Testing Streaming QA Endpoint with Progressive Object Updates"
echo "============================================================"
echo ""

# Create a session first
echo "1. Creating session..."
SESSION_RESPONSE=$(curl -s -X POST http://localhost:3000/api/sessions \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "math",
    "title": "Streaming Test Session"
  }')

SESSION_ID=$(echo $SESSION_RESPONSE | grep -o '"id":"[^"]*"' | sed 's/"id":"//' | sed 's/"//')

if [ -z "$SESSION_ID" ]; then
  echo "Failed to create session"
  exit 1
fi

echo "   ✓ Session created: $SESSION_ID"
echo ""

# Test streaming endpoint
echo "2. Testing streaming QA with object generation..."
echo "   Question: 'Explain what a parabola is and show me the equation y = x^2'"
echo ""
echo "   Streaming response:"
echo "   ------------------"

curl -N -X POST http://localhost:3000/api/qa-stream \
  -H "Content-Type: application/json" \
  -d "{
    \"sessionId\": \"$SESSION_ID\",
    \"question\": \"Explain what a parabola is and show me the equation y = x^2\",
    \"mode\": \"direct\",
    \"stream\": true
  }" 2>/dev/null | while IFS= read -r line; do
    if [[ $line == data:* ]]; then
      # Remove "data: " prefix and parse JSON
      json="${line#data: }"

      # Extract event type
      type=$(echo "$json" | grep -o '"type":"[^"]*"' | sed 's/"type":"//' | sed 's/"//' | head -1)

      if [ ! -z "$type" ]; then
        case "$type" in
          "brain_selected")
            brain=$(echo "$json" | grep -o '"brainName":"[^"]*"' | sed 's/"brainName":"//' | sed 's/"//')
            echo "   🧠 Brain selected: $brain"
            ;;
          "text_chunk")
            text=$(echo "$json" | grep -o '"text":"[^"]*"' | sed 's/"text":"//' | sed 's/"//')
            echo "   📝 Text: $text"
            ;;
          "canvas_object")
            obj_type=$(echo "$json" | grep -o '"type":"[^"]*"' | sed 's/"type":"//' | sed 's/"//g' | tail -1)
            gen_state=$(echo "$json" | grep -o '"generationState":"[^"]*"' | sed 's/"generationState":"//' | sed 's/"//')
            placeholder=$(echo "$json" | grep -o '"placeholder":[^,}]*' | sed 's/"placeholder"://')

            if [ "$placeholder" = "true" ] || [ "$gen_state" = "generating" ]; then
              echo "   ⏳ Object placeholder: type=$obj_type (generating...)"
            else
              echo "   ✅ Object complete: type=$obj_type"
            fi
            ;;
          "audio_chunk")
            echo "   🔊 Audio generated for sentence"
            ;;
          "complete")
            echo "   ✅ Streaming complete!"
            break
            ;;
          "error")
            message=$(echo "$json" | grep -o '"message":"[^"]*"' | sed 's/"message":"//' | sed 's/"//')
            echo "   ❌ Error: $message"
            break
            ;;
        esac
      fi
    fi
done

echo ""
echo "============================================================"
echo "Test complete!"