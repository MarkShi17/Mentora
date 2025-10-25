#!/bin/bash

# Brain Selection Tester using curl
# Tests which brain is selected for different types of questions

echo "🧠 Brain Selection Tester (curl-based)"
echo "======================================"
echo ""

# Test questions for different brain types
declare -a math_questions=(
    "What is the derivative of x^2?"
    "Explain the Pythagorean theorem"
    "Create a sin(x) plot from 0 to 2π"
    "How do you solve quadratic equations?"
)

declare -a biology_questions=(
    "Explain cell division"
    "What is photosynthesis?"
    "How does DNA replication work?"
    "Describe the human circulatory system"
)

declare -a code_questions=(
    "How do you implement a binary search?"
    "Explain object-oriented programming"
    "What is recursion?"
    "How do you debug JavaScript code?"
)

declare -a design_questions=(
    "What are the principles of good UI design?"
    "Explain color theory"
    "How do you create a responsive layout?"
    "What is typography?"
)

declare -a general_questions=(
    "What is the capital of France?"
    "Explain the water cycle"
    "How does the stock market work?"
    "What is artificial intelligence?"
)

# Function to test a question and check backend logs
test_question() {
    local question="$1"
    local expected="$2"
    local session_id="test_$(date +%s)_$$"
    
    echo "Testing: \"$question\""
    echo "Expected brain: $expected"
    
    # Make the API call
    response=$(curl -s -X POST http://localhost:3000/api/qa \
        -H "Content-Type: application/json" \
        -d "{\"question\": \"$question\", \"sessionId\": \"$session_id\", \"mode\": \"guided\"}")
    
    if [ $? -eq 0 ]; then
        echo "✅ API call successful"
        
        # Check if we got canvas objects (indicates brain worked)
        canvas_count=$(echo "$response" | jq '.canvasObjects | length' 2>/dev/null || echo "0")
        echo "   Canvas objects created: $canvas_count"
        
        # Check backend logs for brain selection
        echo "   Checking backend logs for brain selection..."
        brain_log=$(docker logs mentora-backend --tail 20 2>&1 | grep -E "Brain selected.*$session_id" | tail -1)
        
        if [ -n "$brain_log" ]; then
            echo "   Brain selection log found: $brain_log"
        else
            echo "   ⚠️  No brain selection log found for this session"
        fi
        
    else
        echo "❌ API call failed"
    fi
    
    echo ""
    sleep 1
}

# Test all question types
echo "📚 Testing Math Questions:"
echo "------------------------"
for question in "${math_questions[@]}"; do
    test_question "$question" "math"
done

echo "🧬 Testing Biology Questions:"
echo "----------------------------"
for question in "${biology_questions[@]}"; do
    test_question "$question" "biology"
done

echo "💻 Testing Code Questions:"
echo "-------------------------"
for question in "${code_questions[@]}"; do
    test_question "$question" "code"
done

echo "🎨 Testing Design Questions:"
echo "---------------------------"
for question in "${design_questions[@]}"; do
    test_question "$question" "design"
done

echo "🌍 Testing General Questions:"
echo "----------------------------"
for question in "${general_questions[@]}"; do
    test_question "$question" "general"
done

echo "✨ Brain selection testing complete!"
echo ""
echo "To see detailed brain selection logs, run:"
echo "docker logs mentora-backend --tail 50 | grep 'Brain selected'"