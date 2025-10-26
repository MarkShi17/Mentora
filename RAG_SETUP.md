# ChromaDB Multi-Modal RAG Setup Guide

## Overview

Mentora now includes a multi-modal Retrieval-Augmented Generation (RAG) system using ChromaDB. This allows the AI tutor to:

- **Learn from previous sessions**: Retrieve knowledge from past conversations and canvas objects
- **Multi-modal search**: Query using both text and highlighted images/diagrams
- **Cross-session memory**: "Show me the equation we worked on yesterday"
- **Smart context**: Ground responses in previously generated explanations and visualizations

## Architecture

```
User Question + Highlighted Objects
         ↓
    ChromaDB Query
         ↓
    Retrieved Context
         ↓
    Enhanced Response
         ↓
    Auto-Ingestion
```

## Important: Installation Note

⚠️ **ChromaDB Package Issue**: The `chromadb` npm package has missing dependencies. See [CHROMADB_INSTALL.md](./CHROMADB_INSTALL.md) for solutions.

**Recommended**: Use Docker for ChromaDB (no npm package needed):
```bash
docker-compose --profile rag up -d
```

## Quick Start

### 1. Enable RAG in Environment

Add to your `.env` file:

```bash
# ChromaDB RAG Configuration
ENABLE_RAG=true
CHROMADB_URL=http://chromadb:8000
CHROMADB_COLLECTION=mentora_knowledge
CHROMA_AUTH_TOKEN=test-token  # Change in production

# Embedding Model (uses OpenAI API key)
EMBEDDING_MODEL=text-embedding-ada-002

# RAG Parameters
RAG_TOP_K=5
RAG_MIN_RELEVANCE_SCORE=0.7
RAG_AUTO_INGEST=true
```

### 2. Start ChromaDB Service

```bash
# Start with RAG profile
docker-compose --profile rag up -d

# Or start everything
docker-compose --profile full up -d
```

### 3. Verify ChromaDB Health

```bash
# Check if ChromaDB is running
curl http://localhost:8005/api/v1/heartbeat

# Get RAG statistics
curl http://localhost:3000/api/rag/stats
```

## How It Works

### Automatic Ingestion

When RAG is enabled, Mentora automatically:

1. **Stores canvas objects**: Every LaTeX equation, code block, diagram, etc.
2. **Saves conversations**: Questions and answers with linked objects
3. **Maintains metadata**: Session ID, subject, timestamps, tags

### Retrieval Process

When a user asks a question:

1. **Query construction**:
   - Current message
   - Highlighted canvas objects
   - Recent chat history summary

2. **Multi-modal search**:
   - Text similarity for documents
   - Image embeddings for visual objects (if highlighted)

3. **Context enhancement**:
   - Top K relevant snippets
   - Referenced object IDs
   - Relevance scores

4. **Response generation**:
   - Claude receives retrieved context
   - References previous knowledge
   - More informed, grounded answers

## API Endpoints

### Ingestion

**POST /api/rag/ingest**
```json
{
  "sessionId": "session_xyz",
  "objectIds": ["obj_1", "obj_2"],  // Optional: specific objects
  "ingestAll": false  // Optional: ingest entire session
}
```

### Search

**POST /api/rag/search**
```json
{
  "query": "quadratic formula",
  "subject": "math",  // Optional filter
  "topK": 5,
  "includeMetadata": true
}
```

### Statistics

**GET /api/rag/stats**
```json
{
  "totalDocuments": 142,
  "byType": {
    "canvas_object": 87,
    "conversation": 55
  },
  "bySubject": {
    "math": 45,
    "code": 52,
    "biology": 45
  },
  "recentIngestions": 12,
  "isHealthy": true
}
```

### Clear Collection (Dev Only)

**DELETE /api/rag/clear**
- Only works in development mode
- Completely resets the knowledge base

## Configuration Options

### Embedding Models

The system uses OpenAI's text embeddings by default. Options:

```bash
# OpenAI (default, requires OPENAI_API_KEY)
EMBEDDING_MODEL=text-embedding-ada-002

# Alternative models can be configured
EMBEDDING_MODEL=text-embedding-3-small
EMBEDDING_MODEL=text-embedding-3-large
```

### Retrieval Parameters

```bash
# Number of results to retrieve
RAG_TOP_K=5  # Range: 1-20

# Minimum similarity score (0-1)
RAG_MIN_RELEVANCE_SCORE=0.7  # Lower = more results

# Auto-ingest after each response
RAG_AUTO_INGEST=true  # Set false to disable
```

### Authentication

For production, set a secure auth token:

```bash
CHROMA_AUTH_TOKEN=your-secure-token-here
```

## Usage Examples

### Example 1: Cross-Session Learning

**Session 1**:
```
User: "Explain the quadratic formula"
Mentora: [Creates LaTeX equation and explanation]
```

**Session 2** (next day):
```
User: "Show me that formula from yesterday"
Mentora: [Retrieves and displays the exact equation]
```

### Example 2: Visual Context

```
User: [Highlights a code block] "Optimize this"
Mentora: [Retrieves similar code patterns from knowledge base]
```

### Example 3: Subject-Specific Retrieval

```
User: "What topics have we covered in biology?"
Mentora: [Retrieves all biology-related content]
```

## Troubleshooting

### ChromaDB Connection Issues

```bash
# Check if service is running
docker ps | grep chromadb

# View logs
docker logs mentora-chromadb

# Restart service
docker-compose restart chromadb
```

### Embedding Errors

Ensure your OpenAI API key is set:
```bash
echo $OPENAI_API_KEY
```

### Storage Issues

ChromaDB data is persisted in a Docker volume:
```bash
# View volume
docker volume inspect mentora_chromadb-data

# Clear data (careful!)
docker volume rm mentora_chromadb-data
```

## Performance Tuning

### For Faster Retrieval

```bash
# Reduce number of results
RAG_TOP_K=3

# Increase minimum score threshold
RAG_MIN_RELEVANCE_SCORE=0.8
```

### For Better Coverage

```bash
# Increase results
RAG_TOP_K=10

# Lower threshold
RAG_MIN_RELEVANCE_SCORE=0.5
```

### Memory Usage

ChromaDB stores embeddings in memory by default. For large knowledge bases:

1. Monitor container memory: `docker stats chromadb`
2. Increase memory limits in docker-compose.yml if needed
3. Consider persistent disk storage for production

## Development Tips

### Testing RAG Locally

```bash
# 1. Start only ChromaDB
docker-compose up chromadb

# 2. Run backend locally
npm run dev

# 3. Test ingestion
curl -X POST http://localhost:3000/api/rag/ingest \
  -H "Content-Type: application/json" \
  -d '{"sessionId": "test", "ingestAll": true}'

# 4. Test search
curl -X POST http://localhost:3000/api/rag/search \
  -H "Content-Type: application/json" \
  -d '{"query": "recursion"}'
```

### Debugging

Enable debug logging:
```javascript
// In your code
logger.debug('RAG query', { query, results });
```

View ChromaDB directly:
```python
import chromadb
client = chromadb.HttpClient(host="localhost", port=8005)
collection = client.get_collection("mentora_knowledge")
print(collection.count())
```

## Production Considerations

1. **Authentication**: Use strong CHROMA_AUTH_TOKEN
2. **Backup**: Regularly backup the chromadb-data volume
3. **Monitoring**: Track ingestion rates and query latency
4. **Scaling**: Consider clustering for high-traffic deployments
5. **Privacy**: Be mindful of storing user conversations

## Future Enhancements

- [ ] Image embedding support for visual similarity
- [ ] User-specific collections for privacy
- [ ] Scheduled cleanup of old data
- [ ] Export/import knowledge base
- [ ] Fine-tuning embedding models

## Support

For issues or questions:
1. Check logs: `docker logs mentora-chromadb`
2. Verify configuration: `GET /api/rag/stats`
3. Test search: `POST /api/rag/search`
4. Clear and restart if needed (dev only)