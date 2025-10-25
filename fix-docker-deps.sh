#!/bin/bash

# Fix Docker dependency installation issues
# This script cleans Docker volumes and rebuilds containers

set -e

echo "🧹 Fixing Docker dependency issues..."
echo ""

# Step 1: Stop all running containers
echo "1️⃣ Stopping all running containers..."
docker-compose down

# Step 2: Remove volumes to clear cached node_modules
echo ""
echo "2️⃣ Removing Docker volumes (this clears cached dependencies)..."
docker-compose down -v

# Step 3: Remove any existing images to force fresh build
echo ""
echo "3️⃣ Removing existing images..."
docker-compose down --rmi local || true

# Step 4: Clean Docker build cache
echo ""
echo "4️⃣ Cleaning Docker build cache..."
docker builder prune -f

# Step 5: Rebuild containers from scratch
echo ""
echo "5️⃣ Rebuilding containers from scratch (this may take a few minutes)..."
docker-compose build --no-cache

# Step 6: Start containers
echo ""
echo "6️⃣ Starting containers..."
docker-compose up -d

echo ""
echo "✅ Done! Containers should now be running with fresh dependencies."
echo ""
echo "View logs with: docker-compose logs -f"
echo "Check status with: docker-compose ps"
echo ""
echo "Frontend: http://localhost:3001"
echo "Backend: http://localhost:3000"
