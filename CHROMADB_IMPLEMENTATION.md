# ChromaDB Implementation Guide

## Current Status

### ✅ What Works
- **ChromaDB Server**: Running in Docker on port 8005
- **Basic RAG Infrastructure**: All code is in place
- **Safe Degradation**: System works fine without ChromaDB

### ❌ Current Issues
- **ChromaDB npm Package Compatibility**: The JavaScript client has module resolution issues with Next.js webpack
- **Multi-modal is Python-only**: Text + Image embeddings not yet available in JS/TS

## What You Need for Full ChromaDB Implementation

### Option 1: Use Python for RAG (Recommended for Multi-modal)

Since multi-modal embeddings are **Python-only**, the best approach is to create a Python microservice for RAG:

```
┌─────────────────┐
│  Next.js Backend│
│  (TypeScript)   │
└────────┬────────┘
         │ HTTP
         ▼
┌─────────────────┐      ┌──────────────┐
│  Python RAG     │─────▶│   ChromaDB   │
│  Microservice   │      │   (Docker)   │
└─────────────────┘      └──────────────┘
```

**Implementation:**

1. **Create Python RAG Service** (`docker/rag-service/`):

```python
# server.py
from fastapi import FastAPI
from chromadb import HttpClient
from chromadb.utils.embedding_functions import OpenCLIPEmbeddingFunction
from chromadb.utils.data_loaders import ImageLoader

app = FastAPI()

# Initialize ChromaDB with multi-modal support
embedding_function = OpenCLIPEmbeddingFunction()
data_loader = ImageLoader()

client = HttpClient(host="chromadb", port=8000)
collection = client.get_or_create_collection(
    name="mentora_knowledge",
    embedding_function=embedding_function,
    data_loader=data_loader
)

@app.post("/ingest")
async def ingest(data: dict):
    """Ingest text, code, images into ChromaDB"""
    ids = data.get("ids")
    documents = data.get("documents")  # Text content
    images = data.get("images")  # Image URIs or base64
    metadatas = data.get("metadatas")

    if images:
        # Ingest with multi-modal support
        collection.add(
            ids=ids,
            images=images,
            metadatas=metadatas
        )
    else:
        # Text-only ingestion
        collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas
        )

    return {"success": True, "count": len(ids)}

@app.post("/search")
async def search(query: dict):
    """Search with text or image query"""
    query_texts = query.get("query_texts")
    query_images = query.get("query_images")
    n_results = query.get("n_results", 5)

    results = collection.query(
        query_texts=query_texts,
        query_images=query_images,
        n_results=n_results,
        include=["documents", "metadatas", "distances"]
    )

    return results

@app.get("/stats")
async def stats():
    """Get collection statistics"""
    count = collection.count()
    return {
        "total_documents": count,
        "collection_name": "mentora_knowledge"
    }
```

2. **Dockerfile** (`docker/rag-service/Dockerfile`):

```dockerfile
FROM python:3.11-slim

WORKDIR /app

RUN pip install fastapi uvicorn chromadb Pillow

COPY server.py .

EXPOSE 8006

CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8006"]
```

3. **Add to docker-compose.yml**:

```yaml
  rag-service:
    build: ./docker/rag-service
    container_name: mentora-rag-service
    ports:
      - "8006:8006"
    environment:
      - CHROMADB_URL=http://chromadb:8000
    networks:
      - mentora-network
    depends_on:
      - chromadb
    profiles:
      - rag
      - full
```

4. **Update TypeScript to call Python service**:

```typescript
// lib/rag/pythonRagClient.ts
export async function ingestToRAG(
  ids: string[],
  documents?: string[],
  images?: string[],
  metadatas?: any[]
) {
  const response = await fetch('http://localhost:8006/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, documents, images, metadatas })
  });
  return response.json();
}

export async function searchRAG(
  queryTexts?: string[],
  queryImages?: string[],
  nResults = 5
) {
  const response = await fetch('http://localhost:8006/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      query_texts: queryTexts,
      query_images: queryImages,
      n_results: nResults
    })
  });
  return response.json();
}
```

**Benefits:**
- ✅ Full multi-modal support (text + images)
- ✅ All ChromaDB Python features available
- ✅ No npm package issues
- ✅ Clean separation of concerns

---

### Option 2: Wait for JS/TS Multi-modal Support

According to ChromaDB docs, JavaScript/TypeScript multi-modal support is "coming soon". When it arrives, you'll be able to use:

```typescript
import { ChromaClient, OpenCLIPEmbeddingFunction, ImageLoader } from 'chromadb';

const embeddingFunction = new OpenCLIPEmbeddingFunction();
const dataLoader = new ImageLoader();

const collection = await client.createCollection({
  name: 'multimodal_collection',
  embeddingFunction,
  dataLoader
});

// Add images
await collection.add({
  ids: ['img1'],
  images: ['https://example.com/image.jpg'],
  metadatas: [{ type: 'diagram' }]
});

// Query with text
const results = await collection.query({
  queryTexts: ['explain this diagram'],
  nResults: 5
});
```

---

### Option 3: Text-Only RAG (Limited)

If you only need text embeddings (no multi-modal), the current setup **should** work once we fix the module resolution:

**Requirements:**
```bash
npm install chromadb@^3.0.1 @chroma-core/openai
```

**Configuration:**
```typescript
import { ChromaClient } from 'chromadb';
import { OpenAIEmbeddingFunction } from '@chroma-core/openai';

const client = new ChromaClient({ path: 'http://chromadb:8000' });

const embeddingFunction = new OpenAIEmbeddingFunction({
  openai_api_key: process.env.OPENAI_API_KEY!,
  openai_model: 'text-embedding-3-small'
});

const collection = await client.createCollection({
  name: 'mentora_knowledge',
  embeddingFunction
});
```

**Limitations:**
- ❌ No image/visual embeddings
- ❌ Text-only similarity search
- ⚠️ Module resolution issues with Next.js webpack

---

## Compatibility Matrix

| Feature | Python | JavaScript/TypeScript |
|---------|--------|-----------------------|
| Text Embeddings | ✅ | ✅ |
| OpenAI Embeddings | ✅ | ✅ (with @chroma-core/openai) |
| Multi-modal (Text + Image) | ✅ | ❌ (Coming Soon) |
| OpenCLIP | ✅ | ❌ (Coming Soon) |
| Image Search | ✅ | ❌ (Coming Soon) |
| Cross-modal Query | ✅ | ❌ (Coming Soon) |

---

## Recommended Approach for Mentora

Given that Mentora is a **visual, multi-modal tutoring platform** that needs:
- LaTeX equation images
- Code visualization
- Diagrams
- Cross-modal search ("show me diagrams related to this code")

**I strongly recommend Option 1: Python RAG Microservice**

### Why?
1. **Multi-modal is critical** for your use case
2. **Python has all features** right now
3. **FastAPI is fast** - similar performance to Node.js
4. **Clean architecture** - separates concerns
5. **Future-proof** - when JS/TS gets multi-modal, migration is easy

### Implementation Time: ~2-3 hours
- 1 hour: Python RAG service setup
- 30 min: Docker integration
- 1 hour: TypeScript client integration
- 30 min: Testing

---

## Alternative: Hybrid Approach

You can also use **both**:
- **Python for multi-modal RAG** (images, diagrams, visual search)
- **TypeScript for simple text search** (chat history, Q&A)

This gives you the best of both worlds!

---

## Current System Status

The current implementation has:
- ✅ ChromaDB server running (port 8005)
- ✅ All RAG code scaffolding in place
- ✅ Safe degradation when ChromaDB unavailable
- ❌ Module resolution issues preventing JS client from working
- ❌ No multi-modal support in JS/TS yet

**Bottom Line**: To get fully working multi-modal RAG, you need a Python microservice. The TypeScript-only approach will be limited to text embeddings until ChromaDB releases JS/TS multi-modal support.

---

## Next Steps

1. **Choose your approach** (I recommend Python microservice)
2. **Implement the chosen solution**
3. **Test with sample data**
4. **Integrate with Mentora's canvas objects**

Let me know which approach you'd like to take, and I can help implement it!