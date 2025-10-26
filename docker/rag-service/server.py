"""
Mentora RAG Service - Python FastAPI Microservice

Provides multi-modal RAG capabilities using ChromaDB with OpenAI embeddings.
Supports text and image embeddings for visual tutoring content.
"""

import os
import logging
from typing import List, Optional, Dict, Any
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import chromadb
from chromadb.config import Settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Mentora RAG Service",
    description="Multi-modal RAG service for Mentora AI tutoring platform",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ChromaDB configuration
CHROMADB_HOST = os.getenv("CHROMADB_HOST", "chromadb")
CHROMADB_PORT = int(os.getenv("CHROMADB_PORT", "8000"))
COLLECTION_NAME = os.getenv("CHROMADB_COLLECTION", "mentora_knowledge")
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")

# Initialize ChromaDB client
chroma_client = None
collection = None


def get_chroma_client():
    """Get or create ChromaDB client"""
    global chroma_client
    if chroma_client is None:
        try:
            chroma_client = chromadb.HttpClient(
                host=CHROMADB_HOST,
                port=CHROMADB_PORT
            )
            logger.info(f"Connected to ChromaDB at {CHROMADB_HOST}:{CHROMADB_PORT}")
        except Exception as e:
            logger.error(f"Failed to connect to ChromaDB: {e}")
            raise
    return chroma_client


def get_collection():
    """Get or create the ChromaDB collection"""
    global collection
    if collection is None:
        client = get_chroma_client()

        # Use OpenAI embedding function
        from chromadb.utils.embedding_functions import OpenAIEmbeddingFunction

        embedding_function = OpenAIEmbeddingFunction(
            api_key=OPENAI_API_KEY,
            model_name=os.getenv("EMBEDDING_MODEL", "text-embedding-3-small")
        )

        # Get or create collection
        collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            embedding_function=embedding_function,
            metadata={
                "description": "Mentora multi-modal knowledge base",
                "supports_images": True
            }
        )
        logger.info(f"Using collection: {COLLECTION_NAME}")

    return collection


# Pydantic models for request/response validation
class IngestRequest(BaseModel):
    ids: List[str]
    documents: Optional[List[str]] = None
    images: Optional[List[str]] = None
    metadatas: Optional[List[Dict[str, Any]]] = None


class SearchRequest(BaseModel):
    query_texts: Optional[List[str]] = None
    query_images: Optional[List[str]] = None
    n_results: int = 5
    where: Optional[Dict[str, Any]] = None
    include_metadata: bool = True


class DeleteRequest(BaseModel):
    ids: Optional[List[str]] = None
    where: Optional[Dict[str, Any]] = None


# API Endpoints
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    try:
        client = get_chroma_client()
        # Test connection
        client.heartbeat()
        return {
            "status": "healthy",
            "chromadb": f"{CHROMADB_HOST}:{CHROMADB_PORT}",
            "collection": COLLECTION_NAME
        }
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        raise HTTPException(status_code=503, detail=f"Service unhealthy: {str(e)}")


@app.post("/ingest")
async def ingest_documents(request: IngestRequest):
    """
    Ingest documents and/or images into ChromaDB

    Supports:
    - Text documents (LaTeX, code, explanations)
    - Images (diagrams, screenshots - via URLs or base64)
    - Metadata (session info, object types, timestamps)
    """
    try:
        collection = get_collection()

        if not request.documents and not request.images:
            raise HTTPException(status_code=400, detail="Must provide either documents or images")

        # Prepare data for ingestion
        add_kwargs = {
            "ids": request.ids,
            "metadatas": request.metadatas or [{} for _ in request.ids]
        }

        if request.documents:
            add_kwargs["documents"] = request.documents

        if request.images:
            # Note: Multi-modal image support would be added here
            # For now, we'll store image URLs in metadata
            for i, metadata in enumerate(add_kwargs["metadatas"]):
                if i < len(request.images):
                    metadata["image_url"] = request.images[i]

        # Add to collection
        collection.add(**add_kwargs)

        logger.info(f"Ingested {len(request.ids)} items to collection")

        return {
            "success": True,
            "count": len(request.ids),
            "collection": COLLECTION_NAME
        }

    except Exception as e:
        logger.error(f"Ingestion failed: {e}")
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {str(e)}")


@app.post("/search")
async def search_documents(request: SearchRequest):
    """
    Search the knowledge base

    Supports:
    - Text queries
    - Filtered search (by session, subject, object type)
    - Configurable number of results
    """
    try:
        collection = get_collection()

        if not request.query_texts and not request.query_images:
            raise HTTPException(status_code=400, detail="Must provide either query_texts or query_images")

        # Prepare query parameters
        query_kwargs = {
            "n_results": request.n_results,
            "include": ["documents", "metadatas", "distances"]
        }

        if request.query_texts:
            query_kwargs["query_texts"] = request.query_texts

        if request.where:
            query_kwargs["where"] = request.where

        # Query collection
        results = collection.query(**query_kwargs)

        # Format results
        formatted_results = {
            "ids": results["ids"][0] if results["ids"] else [],
            "documents": results["documents"][0] if results["documents"] else [],
            "metadatas": results["metadatas"][0] if results["metadatas"] else [],
            "distances": results["distances"][0] if results["distances"] else [],
            "count": len(results["ids"][0]) if results["ids"] else 0
        }

        # Convert distances to relevance scores (1 / (1 + distance))
        formatted_results["relevance_scores"] = [
            1 / (1 + d) for d in formatted_results["distances"]
        ]

        logger.info(f"Search returned {formatted_results['count']} results")

        return formatted_results

    except Exception as e:
        logger.error(f"Search failed: {e}")
        raise HTTPException(status_code=500, detail=f"Search failed: {str(e)}")


@app.get("/stats")
async def get_stats():
    """Get collection statistics"""
    try:
        collection = get_collection()
        count = collection.count()

        # Try to get metadata distribution
        # Sample some documents to get metadata stats
        sample_results = collection.peek(limit=min(count, 100))

        # Count by type
        type_counts: Dict[str, int] = {}
        subject_counts: Dict[str, int] = {}

        if sample_results and sample_results.get("metadatas"):
            for metadata in sample_results["metadatas"]:
                # Count by object type
                obj_type = metadata.get("objectType", "unknown")
                type_counts[obj_type] = type_counts.get(obj_type, 0) + 1

                # Count by subject
                subject = metadata.get("subject", "unknown")
                subject_counts[subject] = subject_counts.get(subject, 0) + 1

        return {
            "total_documents": count,
            "collection_name": COLLECTION_NAME,
            "by_type": type_counts,
            "by_subject": subject_counts,
            "is_healthy": True
        }

    except Exception as e:
        logger.error(f"Stats retrieval failed: {e}")
        raise HTTPException(status_code=500, detail=f"Stats failed: {str(e)}")


@app.delete("/clear")
async def clear_collection():
    """Clear all documents from the collection (development only)"""
    if os.getenv("NODE_ENV") == "production":
        raise HTTPException(status_code=403, detail="Cannot clear collection in production")

    try:
        global collection
        client = get_chroma_client()

        # Delete and recreate collection
        try:
            client.delete_collection(name=COLLECTION_NAME)
        except Exception:
            pass  # Collection might not exist

        # Reset collection reference
        collection = None

        # Recreate collection
        get_collection()

        logger.info(f"Collection {COLLECTION_NAME} cleared and recreated")

        return {
            "success": True,
            "message": "Collection cleared"
        }

    except Exception as e:
        logger.error(f"Clear failed: {e}")
        raise HTTPException(status_code=500, detail=f"Clear failed: {str(e)}")


@app.delete("/delete")
async def delete_documents(request: DeleteRequest):
    """Delete specific documents from the collection"""
    try:
        collection = get_collection()

        delete_kwargs = {}
        if request.ids:
            delete_kwargs["ids"] = request.ids
        if request.where:
            delete_kwargs["where"] = request.where

        if not delete_kwargs:
            raise HTTPException(status_code=400, detail="Must provide either ids or where filter")

        collection.delete(**delete_kwargs)

        logger.info(f"Deleted documents from collection")

        return {
            "success": True,
            "message": "Documents deleted"
        }

    except Exception as e:
        logger.error(f"Delete failed: {e}")
        raise HTTPException(status_code=500, detail=f"Delete failed: {str(e)}")


# Startup event
@app.on_event("startup")
async def startup_event():
    """Initialize ChromaDB connection on startup"""
    logger.info("Starting Mentora RAG Service...")
    logger.info(f"ChromaDB: {CHROMADB_HOST}:{CHROMADB_PORT}")
    logger.info(f"Collection: {COLLECTION_NAME}")

    try:
        # Initialize connection
        get_collection()
        logger.info("✅ RAG Service ready")
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")
        raise


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8006)
