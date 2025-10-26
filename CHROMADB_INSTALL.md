# ChromaDB Installation Fix

## Issue
The `chromadb` npm package has missing peer dependencies that cause build errors:
```
Module not found: Can't resolve '@chroma-core/default-embed'
```

## Solution

### Option 1: Run Without ChromaDB (Default)
The system now uses dynamic imports and will work without ChromaDB installed. Simply set:
```bash
ENABLE_RAG=false
```

### Option 2: Install ChromaDB Dependencies

If you want to use RAG features, you need to install ChromaDB and its dependencies:

```bash
# Remove old chromadb if it exists
rm -rf node_modules/chromadb node_modules/.chromadb*

# Install with all dependencies
npm install chromadb@1.8.1 chromadb-default-embed

# Or use the Docker container approach (recommended)
docker-compose --profile rag up -d
```

### Option 3: Use ChromaDB in Docker Only

The easiest approach is to run ChromaDB in Docker and keep the Node.js dependencies optional:

1. Start ChromaDB container:
```bash
docker-compose up -d chromadb
```

2. Set environment variables:
```env
ENABLE_RAG=true
CHROMADB_URL=http://localhost:8005
```

3. The backend will use HTTP API to communicate with ChromaDB, avoiding npm package issues.

## Why This Happens

ChromaDB's npm package doesn't properly declare all its dependencies, particularly:
- `@chroma-core/default-embed`
- Various embedding function dependencies

The dynamic import approach we've implemented allows the system to:
1. Run without ChromaDB when RAG is disabled
2. Load ChromaDB only when actually needed
3. Gracefully handle missing dependencies

## Verification

Test if RAG is working (when enabled):
```bash
# Check stats
curl http://localhost:3000/api/rag/stats

# If you get an error about ChromaDB not being available,
# it means the package isn't installed but the system is still working
```

## Recommended Setup

For production or hassle-free development:
1. Use Docker for ChromaDB: `docker-compose --profile rag up -d`
2. Keep `ENABLE_RAG=true` in `.env`
3. Don't install chromadb npm package locally
4. Let Docker handle all ChromaDB dependencies

This approach avoids all npm dependency issues while still providing full RAG functionality.