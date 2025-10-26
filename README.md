# Mentora - Voice-Interactive AI Mentor with a Spatial Memory Canvas

Complete full-stack Agentic tutoring platform using multimodal RAG and MCPs to explain, visualize, and remember like a human mentor.

---

## Architecture

**Full-Stack Application:**
- **Frontend**: React + Next.js + D3.js (Port 3001)
- **Backend**: Next.js API Routes + Claude AI (Port 3000)
- **Docker**: Multi-service containerized deployment

---

## Features

- **Voice-Interactive Teaching Agent**: Powered by Claude Sonnet 4.5  
- **Canvas Object Management**: Create and manage LaTeX equations, graphs, code blocks, diagrams, and text  
- **Session Management**: Track teaching sessions with full conversation history  
- **Context-Aware**: References highlighted objects and maintains spatial awareness  
- **TTS & Transcription**: OpenAI Whisper for speech-to-text and TTS-1 for text-to-speech  
- **Socratic Teaching**: Guides students with questions rather than direct answers (configurable)  
- **Multi-Modal RAG** (NEW): ChromaDB-powered knowledge retrieval from past sessions and canvas objects  

---

## Tech Stack

- **Framework**: Next.js 14 (App Router)  
- **Language**: TypeScript (strict mode)  
- **LLM**: Claude Sonnet 4.5 (Anthropic)  
- **Transcription**: OpenAI Whisper API  
- **TTS**: OpenAI TTS-1  
- **Storage**: In-memory (Map) + ChromaDB for RAG  
- **Vector DB**: ChromaDB for multi-modal embeddings  
- **Docker**: Multi-stage builds for dev and production  

---

## Prerequisites

- Node.js 20+  
- Docker and Docker Compose (optional)  
- OpenAI API key  
- Anthropic API key  

---

## Quick Start

### 1. Clone and Install

```bash
cd Mentora
npm install
````

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# Required API Keys
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Basic Configuration
NODE_ENV=development
LOG_LEVEL=info

# Optional: Enable RAG (Retrieval-Augmented Generation)
ENABLE_RAG=true
CHROMADB_URL=http://chromadb:8000
RAG_AUTO_INGEST=true
```

---

### 3. Run Full Stack Application

**Option A: Full Stack with Docker (Recommended)**

```bash
docker-compose up
```

* Frontend: [http://localhost:3001](http://localhost:3001)
* Backend API: [http://localhost:3000](http://localhost:3000)

**Option B: Backend Only (for API development)**

```bash
npm run dev
```

* Backend API runs at [http://localhost:3000](http://localhost:3000)

**Option C: Frontend Separately (for UI development)**

```bash
cd apps/web
npm install
npm run dev
```

* Frontend runs at [http://localhost:3001](http://localhost:3001)

---

### 4. Test Health Check

```bash
curl http://localhost:3000/api/health
```

Expected response:

```json
{
  "status": "ok",
  "timestamp": 1234567890,
  "version": "0.1.0"
}
```

---

## MCP Integration Guide

**Model Context Protocol (MCP)** integration for Mentora - enabling specialized brains with tool access.

**Last Updated:** 2025-10-25

---

### Overview

Mentora includes a complete MCP client layer connecting to multiple MCP servers, enabling:

* **Sequential Thinking**: Structured step-by-step problem solving
* **Manim Animations**: Mathematical visualizations (Docker-based)
* **Python Execution**: Diagram and visualization generation (Docker-based)
* **Biology Diagram Generator**: Curated biology schematics (via Python MCP)
* **GitHub Integration**: Code search and repository access
* **Figma Integration**: Design file and component access

---

### Architecture

```
┌─────────────────────────────────────────────────────────┐
│                 Mentora Backend                          │
│                                                          │
│  ┌────────────────────────────────────────────────────┐ │
│  │         MCP Connection Manager                     │ │
│  │  • Manages all MCP server connections             │ │
│  │  • Handles reconnection and health checks         │ │
│  │  • Routes tool calls to appropriate servers       │ │
│  └────────────────────────────────────────────────────┘ │
│                         │                                │
│         ┌───────────────┼──────────────┬────────────┐   │
│         ▼               ▼              ▼            ▼   │
│  ┌───────────┐  ┌────────────┐  ┌─────────┐  ┌────────┐│
│  │Sequential │  │   Manim    │  │ Python  │  │GitHub  ││
│  │ Thinking  │  │    MCP     │  │  MCP    │  │  MCP   ││
│  │(stdio/npx)│  │   (HTTP)   │  │ (HTTP)  │  │(stdio) ││
│  └───────────┘  └────────────┘  └─────────┘  └────────┘│
└─────────────────────────────────────────────────────────┘
```

---

### Components Implemented

1. **Core MCP Client (`lib/mcp/client.ts`)**: Manages single MCP server connection, tool discovery, and execution
2. **Connection Manager (`lib/mcp/manager.ts`)**: Orchestrates all MCP connections, automatic reconnections, unified status reporting
3. **Configuration (`lib/mcp/config.ts`)**: Server registry with transport types and enable flags
4. **Type Definitions (`types/mcp.ts`)**: TypeScript types for server configs, tools, requests/responses
5. **Initialization (`lib/mcp/init.ts`)**: Lazy initialization, singleton pattern, graceful failure handling

---

### API Endpoints

**GET** `/api/mcp/status` – Returns status of all MCP servers

**POST** `/api/mcp/call` – Calls a tool on an MCP server

---

### Setup Instructions

* **Sequential Thinking**: Works out of the box via npx
* **GitHub Integration**: Requires Personal Access Token in `.env`
* **Figma Integration**: Requires Personal Access Token in `.env`
* **Manim MCP**: Docker container pending
* **Python MCP**: Docker container pending

---

### Next Steps

* Docker containers for Manim and Python MCPs
* Specialized Brain implementations
* Multimodal memory integration (ChromaDB)
* Agent orchestrator to route requests

---

## ChromaDB RAG Integration

**Retrieval-Augmented Generation (RAG)** enhances AI responses by retrieving relevant context from past conversations and canvas objects.

---

### Architecture

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

---

### Quick Start

1. Set API keys (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`) in `.env`
2. Run with RAG:

```bash
docker-compose --profile rag up -d
```

3. Frontend: [http://localhost:3001](http://localhost:3001)
   Backend API: [http://localhost:3000](http://localhost:3000)

---

### Testing RAG

* `/health` – Check service health
* `/stats` – Collection statistics
* `/ingest` – Add documents
* `/search` – Retrieve similar documents

Check logs if issues arise:

```bash
docker logs mentora-rag-service --tail 50 -f
```

---

### Configuration

* `.env` settings: `RAG_TOP_K`, `RAG_MIN_RELEVANCE_SCORE`, `ENABLE_RAG`, `CHROMADB_URL`, etc.
* Adjust search precision and context amount with `RAG_TOP_K` and `RAG_MIN_RELEVANCE_SCORE`

---

### Data Persistence

* Stored in Docker volume: `mentora_chromadb-data`
* Backup/restore via `docker run` + `tar`

---

### Security Notes

* Dev: No authentication, ports exposed to localhost only
* Prod: Enable ChromaDB auth, API keys, internal networks, encrypted secrets

---

### Version Compatibility

* ChromaDB Server/Client: `0.5.23`
* OpenAI Python SDK: `1.57.2`
* FastAPI: `0.115.5`

---

## Teaching Agent API Endpoints

* **Sessions**: Create, list, retrieve details
* **QA**: Ask questions and receive responses
* **Canvas Management**: Create, update, highlight objects
* **Voice Interaction**: Stream audio to/from TTS and Whisper

