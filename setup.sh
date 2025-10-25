#!/bin/bash

# Mentora Backend - Automated Setup Script

set -e

echo "======================================"
echo "  Mentora Backend Setup"
echo "======================================"
echo ""

# Check Node.js version
echo "📦 Checking Node.js version..."
NODE_VERSION=$(node --version 2>/dev/null || echo "not found")
if [[ "$NODE_VERSION" == "not found" ]]; then
    echo "❌ Node.js is not installed!"
    echo "   Please install Node.js 20+ from https://nodejs.org"
    exit 1
fi
echo "✅ Node.js version: $NODE_VERSION"
echo ""

# Check npm
echo "📦 Checking npm..."
NPM_VERSION=$(npm --version 2>/dev/null || echo "not found")
if [[ "$NPM_VERSION" == "not found" ]]; then
    echo "❌ npm is not installed!"
    exit 1
fi
echo "✅ npm version: $NPM_VERSION"
echo ""

# Install dependencies
echo "📥 Installing dependencies..."
npm install
echo "✅ Dependencies installed"
echo ""

# Check for .env file
if [ ! -f .env ]; then
    echo "⚠️  .env file not found!"
    echo "📄 Creating .env from template..."
    cp .env.example .env
    echo "✅ .env file created"
    echo ""
    echo "🔑 IMPORTANT: Edit .env and add your API keys!"
    echo "   - OPENAI_API_KEY=sk-..."
    echo "   - ANTHROPIC_API_KEY=sk-ant-..."
    echo ""
    echo "   Get API keys from:"
    echo "   - OpenAI: https://platform.openai.com/api-keys"
    echo "   - Anthropic: https://console.anthropic.com/"
    echo ""
else
    echo "✅ .env file exists"

    # Check if API keys are set
    if grep -q "OPENAI_API_KEY=sk-" .env && grep -q "ANTHROPIC_API_KEY=sk-ant-" .env; then
        echo "✅ API keys appear to be configured"
    else
        echo "⚠️  API keys may not be configured correctly"
        echo "   Please verify your .env file contains valid API keys"
    fi
    echo ""
fi

# Run type check
echo "🔍 Running TypeScript type check..."
if npm run type-check > /dev/null 2>&1; then
    echo "✅ TypeScript compilation successful"
else
    echo "⚠️  TypeScript errors found (non-critical for development)"
fi
echo ""

echo "======================================"
echo "  Setup Complete! 🎉"
echo "======================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Edit .env and add your API keys (if not done already)"
echo ""
echo "2. Start the development server:"
echo "   npm run dev"
echo ""
echo "3. Or use Docker:"
echo "   docker-compose up"
echo ""
echo "4. Test the API:"
echo "   curl http://localhost:3000/api/health"
echo ""
echo "📖 See README.md for full documentation"
echo "🚀 See QUICKSTART.md for usage examples"
echo ""
