#!/bin/bash

# Mentora Setup Verification Script

echo "======================================"
echo "  Mentora Setup Verification"
echo "======================================"
echo ""

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: package.json not found"
    echo "   Please run this script from the Mentora project root"
    exit 1
fi

echo "📦 Checking required files..."
echo ""

# Check backend package-lock.json
if [ -f "package-lock.json" ]; then
    echo "✅ Backend package-lock.json exists"
else
    echo "❌ Backend package-lock.json missing"
    echo "   Run: npm install"
    exit 1
fi

# Check frontend package-lock.json
if [ -f "mentora/apps/web/package-lock.json" ]; then
    echo "✅ Frontend package-lock.json exists"
else
    echo "❌ Frontend package-lock.json missing"
    echo "   Run: cd mentora/apps/web && npm install"
    exit 1
fi

# Check .env file
if [ -f ".env" ]; then
    echo "✅ .env file exists"

    # Check if API keys are set (not just example values)
    if grep -q "OPENAI_API_KEY=sk-" .env && grep -q "ANTHROPIC_API_KEY=sk-ant-" .env; then
        echo "✅ API keys appear to be configured"
    else
        echo "⚠️  API keys may not be set in .env"
    fi
else
    echo "⚠️  .env file not found (will use .env.example)"
fi

echo ""
echo "🐳 Checking Docker setup..."
echo ""

# Check if Docker is running
if command -v docker &> /dev/null; then
    if docker info &> /dev/null; then
        echo "✅ Docker is installed and running"
    else
        echo "❌ Docker is installed but not running"
        echo "   Please start Docker Desktop"
        exit 1
    fi
else
    echo "⚠️  Docker not found (optional for development)"
fi

# Check docker-compose
if command -v docker-compose &> /dev/null; then
    echo "✅ docker-compose is installed"
else
    echo "⚠️  docker-compose not found (optional for development)"
fi

echo ""
echo "======================================"
echo "  Verification Complete! ✓"
echo "======================================"
echo ""
echo "Ready to start:"
echo ""
echo "  Full Stack (Docker):    docker-compose up"
echo "  Backend Only:           npm run dev"
echo "  Frontend Only:          cd mentora/apps/web && npm run dev"
echo ""
echo "Access:"
echo "  Frontend UI:            http://localhost:3001"
echo "  Backend API:            http://localhost:3000"
echo ""
