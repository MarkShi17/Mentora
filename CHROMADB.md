# ChromaDB RAG Integration

**Complete guide to Mentora's Retrieval-Augmented Generation (RAG) system using ChromaDB.**

---

## What is RAG?

RAG (Retrieval-Augmented Generation) enhances AI responses by retrieving relevant information from past conversations and canvas objects. When you ask a question, the system:

1. **Searches** your knowledge base for similar past conversations and objects
2. **Retrieves** the most relevant content
3. **Augments** Claude's response with this context for better, more personalized answers

---

## Architecture

Mentora uses a **Python microservice architecture** for RAG:

```
┌─────────────┐         ┌─────────────┐         ┌─────────────┐
│   Next.js   │  HTTP   │  Python RAG │  HTTP   │  ChromaDB   │
│   Backend   │ ──────> │   Service   │ ──────> │  (Vector DB)│
│  (Port 3000)│         │ (Port 8006) │         │ (Port 8005) │
└─────────────┘         └─────────────┘         └─────────────┘
                                │
                                │ OpenAI API
                                ▼
                        ┌─────────────┐
                        │   OpenAI    │
                        │  Embeddings │
                        └─────────────┘
```

### Components:

- **Next.js Backend**: Handles chat requests, calls RAG service
- **Python RAG Service**: FastAPI microservice for document ingestion and search
- **ChromaDB**: Vector database for storing embeddings
- **OpenAI Embeddings**: Converts text to vectors using `text-embedding-3-small` model

---

## Quick Start

### 1. Set Required API Keys

Edit `.env` file:

```bash
# Required for Claude AI
ANTHROPIC_API_KEY=sk-ant-api03-YOUR-KEY-HERE

# Required for RAG embeddings
OPENAI_API_KEY=sk-proj-YOUR-KEY-HERE

# RAG Configuration
ENABLE_RAG=true
```

### 2. Start with RAG Enabled

```bash
docker-compose --profile rag up -d
```

That's it! Your Mentora app with RAG is now running.

### 3. Access Your App

- **Frontend**: http://localhost:3001
- **Backend API**: http://localhost:3000
- **RAG Service**: http://localhost:8006
- **ChromaDB**: http://localhost:8005

---

## How It Works

### Automatic Ingestion

When you chat with Mentora:

1. **After each conversation turn**, the system automatically:
   - Saves your question and Claude's response
   - Saves any canvas objects created (equations, code, diagrams)
   - Generates embeddings using OpenAI
   - Stores everything in ChromaDB

2. **Before responding to new questions**, the system:
   - Searches ChromaDB for similar past conversations
   - Retrieves the top 5 most relevant results (configurable)
   - Adds this context to Claude's prompt
   - Claude generates a response informed by past interactions

### What Gets Saved:

- ✅ Conversation questions and responses
- ✅ LaTeX equations
- ✅ Code blocks
- ✅ Text annotations
- ✅ Diagram descriptions
- ✅ Graph data

### Metadata Tracked:

- Session ID
- Subject (math, biology, code, design)
- Object types
- Timestamps
- Relevance scores

---

## Configuration

### Environment Variables

All RAG settings are in `.env`:

```bash
# Enable/disable RAG
ENABLE_RAG=true

# Service URLs (Docker internal)
RAG_SERVICE_URL=http://rag-service:8006
CHROMADB_URL=http://chromadb:8000

# ChromaDB collection name
CHROMADB_COLLECTION=mentora_knowledge

# OpenAI embedding model
EMBEDDING_MODEL=text-embedding-3-small

# Search parameters
RAG_TOP_K=5                      # Number of results to retrieve
RAG_MIN_RELEVANCE_SCORE=0.4      # Minimum similarity score (0-1)

# Auto-ingestion
RAG_AUTO_INGEST=true             # Automatically save conversations
```

### Adjusting Search Behavior

**Get more context** (may include less relevant results):
```bash
RAG_TOP_K=10
RAG_MIN_RELEVANCE_SCORE=0.3
```

**Get only highly relevant context** (fewer but more precise results):
```bash
RAG_TOP_K=3
RAG_MIN_RELEVANCE_SCORE=0.85
```

---

## Docker Commands

### Start All Services (Without RAG)

```bash
docker-compose up -d
```

### Start with RAG

```bash
docker-compose --profile rag up -d
```

### Stop Services

```bash
docker-compose down
```

### Stop and Clear RAG Data

```bash
docker-compose --profile rag down -v
```

**Warning**: `-v` flag deletes all stored conversations and embeddings!

### Restart RAG Service Only

```bash
docker-compose --profile rag restart rag-service
```

### View RAG Service Logs

```bash
docker logs mentora-rag-service --tail 50 -f
```

### Check Service Status

```bash
docker ps --filter "name=mentora"
```

---

## Testing the RAG System

### 1. Check RAG Health

```bash
curl http://localhost:8006/health
```

Expected response:
```json
{
  "status": "healthy",
  "chromadb": "chromadb:8000",
  "collection": "mentora_knowledge"
}
```

### 2. Check RAG Stats

```bash
curl http://localhost:8006/stats
```

Expected response:
```json
{
  "total_documents": 0,
  "collection_name": "mentora_knowledge",
  "by_type": {},
  "by_subject": {},
  "is_healthy": true
}
```

### 3. Test Backend RAG Integration

```bash
curl http://localhost:3000/api/rag/stats
```

Expected response:
```json
{
  "enabled": true,
  "available": true,
  "isHealthy": true,
  "totalDocuments": 0,
  "config": {
    "ragServiceUrl": "http://rag-service:8006",
    "embeddingModel": "text-embedding-3-small",
    "autoIngest": true
  }
}
```

### 4. Test Ingestion (Manual)

```bash
curl -X POST http://localhost:8006/ingest \
  -H "Content-Type: application/json" \
  -d '{
    "ids": ["test-1"],
    "documents": ["The Krebs cycle generates ATP in cells."],
    "metadatas": [{
      "type": "conversation",
      "subject": "biology",
      "sessionId": "test"
    }]
  }'
```

### 5. Test Search

```bash
curl -X POST http://localhost:8006/search \
  -H "Content-Type: application/json" \
  -d '{
    "query_texts": ["How does cellular respiration work?"],
    "n_results": 3
  }'
```

---

## API Endpoints

### RAG Service (Port 8006)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Check service health |
| `/stats` | GET | Get collection statistics |
| `/ingest` | POST | Add documents to RAG |
| `/search` | POST | Search for similar documents |
| `/clear` | DELETE | Clear entire collection (dev only) |
| `/delete` | DELETE | Delete specific documents |

### Backend API (Port 3000)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/rag/stats` | GET | Get RAG system status |
| `/api/health` | GET | Backend health check |

---

## Troubleshooting

### RAG Service Not Starting

**Problem**: `mentora-rag-service` shows as "unhealthy" or restarting

**Check logs**:
```bash
docker logs mentora-rag-service --tail 50
```

**Common causes**:

1. **OpenAI API key invalid**
   ```
   ERROR: 401 Unauthorized
   ```
   **Fix**: Update `OPENAI_API_KEY` in `.env`

2. **ChromaDB not ready**
   ```
   ERROR: Could not connect to ChromaDB
   ```
   **Fix**: Wait 30 seconds for ChromaDB to initialize, or restart:
   ```bash
   docker-compose --profile rag restart chromadb rag-service
   ```

3. **Port already in use**
   ```
   ERROR: Port 8006 already allocated
   ```
   **Fix**: Stop conflicting services or change port in `docker-compose.yml`

### Backend Can't Connect to RAG

**Problem**: Backend shows RAG as unavailable

**Check**:
```bash
docker exec mentora-backend curl http://rag-service:8006/health
```

**Fix**: Ensure all services are on the same network:
```bash
docker-compose --profile rag down
docker-compose --profile rag up -d
```

### No Context Retrieved

**Problem**: RAG system is healthy but doesn't find relevant context

**Possible causes**:

1. **No documents ingested yet**: Chat a few times first to build the knowledge base

2. **Relevance threshold too high**:
   ```bash
   # In .env
   RAG_MIN_RELEVANCE_SCORE=0.5  # Lower threshold
   ```

3. **Not enough results**:
   ```bash
   # In .env
   RAG_TOP_K=10  # Get more results
   ```

### ChromaDB Data Corruption

**Problem**: ChromaDB returns errors about corrupted data

**Fix**: Clear and restart:
```bash
docker-compose --profile rag down -v
docker-compose --profile rag up -d
```

**Warning**: This deletes all stored knowledge!

---

## Data Persistence

### Where Data is Stored

ChromaDB data is stored in a Docker volume:

```bash
# View volumes
docker volume ls | grep chromadb

# Inspect volume
docker volume inspect mentora_chromadb-data
```

### Backup RAG Data

```bash
# Stop services
docker-compose --profile rag down

# Backup volume
docker run --rm -v mentora_chromadb-data:/data -v $(pwd):/backup \
  alpine tar czf /backup/chromadb-backup.tar.gz /data

# Restart services
docker-compose --profile rag up -d
```

### Restore RAG Data

```bash
# Stop services
docker-compose --profile rag down

# Remove old volume
docker volume rm mentora_chromadb-data

# Restore from backup
docker run --rm -v mentora_chromadb-data:/data -v $(pwd):/backup \
  alpine tar xzf /backup/chromadb-backup.tar.gz -C /

# Restart services
docker-compose --profile rag up -d
```

---

## Advanced Usage

### Disable RAG

Set in `.env`:
```bash
ENABLE_RAG=false
```

Then restart:
```bash
docker-compose restart backend
```

### Clear Knowledge Base (Keep Service Running)

```bash
curl -X DELETE http://localhost:8006/clear
```

### Delete Specific Session Data

```bash
curl -X DELETE http://localhost:8006/delete \
  -H "Content-Type: application/json" \
  -d '{"where": {"sessionId": "session-id-here"}}'
```

### Query by Subject

```bash
curl -X POST http://localhost:8006/search \
  -H "Content-Type: application/json" \
  -d '{
    "query_texts": ["quadratic formula"],
    "n_results": 5,
    "where": {"subject": "math"}
  }'
```

---

## Performance Considerations

### Embedding Generation

- Each document generates ~1536 dimensions (OpenAI `text-embedding-3-small`)
- Costs: $0.00002 per 1K tokens
- Speed: ~100ms per document

### Search Performance

- **< 1,000 documents**: Near-instant search (<50ms)
- **1,000-10,000 documents**: Fast search (<200ms)
- **> 10,000 documents**: Still fast (<500ms)

ChromaDB uses HNSW (Hierarchical Navigable Small World) algorithm for efficient similarity search.

### Scaling

For production use with many users:

1. Use external ChromaDB server (not Docker container)
2. Enable authentication
3. Consider using persistent disk storage
4. Monitor embedding API costs

---

## Security Notes

### Current Setup (Development)

- ⚠️ **No authentication** on ChromaDB
- ⚠️ **No authentication** on RAG service
- ⚠️ **Ports exposed** to localhost only

### Production Recommendations

1. **Enable ChromaDB authentication**:
   ```yaml
   # docker-compose.yml
   chromadb:
     environment:
       - CHROMA_SERVER_AUTH_PROVIDER=chromadb.auth.token.TokenAuthServerProvider
       - CHROMA_SERVER_AUTH_CREDENTIALS=your-secure-token
   ```

2. **Add RAG service authentication**: Implement API key middleware in FastAPI

3. **Use environment-specific configs**: Different settings for dev/staging/prod

4. **Network isolation**: Use internal Docker networks only

5. **Encrypt sensitive data**: Use secrets management for API keys

---

## Version Compatibility

**Current versions**:
- ChromaDB Server: `0.5.23`
- ChromaDB Python Client: `0.5.23`
- OpenAI Python SDK: `1.57.2`
- FastAPI: `0.115.5`

**Important**: ChromaDB server and client versions MUST match to avoid compatibility issues.

---

## FAQ

### Do I need RAG?

**Use RAG if**:
- You want the AI to remember past conversations
- You want context-aware responses across sessions
- You're building a personalized tutoring experience

**Skip RAG if**:
- You only need simple, stateless Q&A
- You want to minimize API costs
- You don't need conversation history

### How much does RAG cost?

**OpenAI Embedding costs** (text-embedding-3-small):
- $0.00002 per 1,000 tokens
- Average conversation: ~500 tokens = $0.00001
- 10,000 conversations: ~$0.10

**Very affordable** for most use cases.

### Can I use a different embedding model?

Yes! Change in `.env`:

```bash
# OpenAI models
EMBEDDING_MODEL=text-embedding-3-small   # Cheapest, fast
EMBEDDING_MODEL=text-embedding-3-large   # Better quality, 5x cost

# Would require code changes for other providers
```

### Can I use RAG without OpenAI?

Yes, but requires code changes to use alternative embedding models (e.g., Sentence Transformers, Cohere). OpenAI embeddings are currently hardcoded in the Python RAG service.

### How do I monitor RAG usage?

Check stats endpoint regularly:
```bash
curl http://localhost:8006/stats
```

Or view in your app at: http://localhost:3000/api/rag/stats

---

## Support

If you encounter issues:

1. **Check logs**: `docker logs mentora-rag-service --tail 100`
2. **Check health**: `curl http://localhost:8006/health`
3. **Verify API keys**: Ensure valid `OPENAI_API_KEY` in `.env`
4. **Restart services**: `docker-compose --profile rag restart`

For persistent issues, check:
- Docker disk space: `docker system df`
- Network connectivity: `docker network inspect mentora_mentora-network`
- Port conflicts: `netstat -an | grep 8006`

---

## Summary

**To use RAG in Mentora**:

1. Set `OPENAI_API_KEY` and `ANTHROPIC_API_KEY` in `.env`
2. Run: `docker-compose --profile rag up -d`
3. Open: http://localhost:3001
4. Start chatting - RAG works automatically!

**That's all you need to know to use ChromaDB RAG in Mentora.** 🚀
