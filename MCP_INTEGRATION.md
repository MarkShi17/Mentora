# MCP Integration Guide

**Model Context Protocol (MCP)** integration for Mentora - enabling specialized brains with tool access.

Last Updated: 2025-10-25

---

## Overview

Mentora now includes a complete MCP client layer that connects to multiple MCP servers, enabling:

- **Sequential Thinking**: Structured step-by-step problem solving
- **Manim Animations**: Mathematical visualizations (Docker-based)
- **Python Execution**: Diagram and visualization generation (Docker-based)
- **GitHub Integration**: Code search and repository access
- **Figma Integration**: Design file and component access

## Architecture

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

## Components Implemented

### 1. Core MCP Client (`lib/mcp/client.ts`)

**MCPClient class** - Manages connection to a single MCP server:

- **Transport Support**: stdio (npx) and HTTP
- **Connection Management**: Connect, disconnect, reconnect
- **Tool Discovery**: Automatically loads available tools from server
- **Health Checks**: Periodic validation of connection
- **Tool Execution**: Call tools with parameters and receive responses

### 2. Connection Manager (`lib/mcp/manager.ts`)

**mcpManager singleton** - Orchestrates all MCP connections:

- Initializes all enabled servers on startup
- Routes tool calls to appropriate servers
- Handles automatic reconnection on failures
- Provides unified status and health reporting
- Periodic health checks (every 5 minutes)

### 3. Configuration (`lib/mcp/config.ts`)

**MCP_SERVERS** registry with all server configurations:

```typescript
{
  'sequential-thinking': {
    transport: 'stdio',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
    enabled: true  // Always enabled
  },
  'manim': {
    transport: 'http',
    url: process.env.MANIM_MCP_URL,
    enabled: process.env.ENABLE_MANIM === 'true'
  },
  // ... more servers
}
```

### 4. Type Definitions (`types/mcp.ts`)

Complete TypeScript types for:
- Server configurations
- Tool definitions
- Tool call requests/responses
- Server states
- Transport types
- Tool-specific input schemas

### 5. Initialization (`lib/mcp/init.ts`)

Lazy initialization system:
- Triggered on first API call
- Singleton pattern prevents duplicate initialization
- Graceful failure handling (server starts even if MCP fails)

## API Endpoints

### GET /api/mcp/status

Get status of all MCP servers and their available tools.

**Response:**
```json
{
  "success": true,
  "timestamp": "2025-10-25T13:50:20.279Z",
  "summary": {
    "total": 1,
    "enabled": 1,
    "connected": 1,
    "disconnected": 0
  },
  "servers": [
    {
      "id": "sequential-thinking",
      "name": "Sequential Thinking",
      "description": "Structured step-by-step problem solving and analysis",
      "status": "connected",
      "transport": "stdio",
      "enabled": true,
      "tools": [
        {
          "name": "sequentialthinking",
          "description": "...",
          "inputSchema": { ... }
        }
      ]
    }
  ]
}
```

### POST /api/mcp/call

Call a tool on an MCP server.

**Request:**
```json
{
  "serverId": "sequential-thinking",
  "toolName": "sequentialthinking",
  "arguments": {
    "thought": "Let me think about solving x^2 - 5x + 6 = 0",
    "thoughtNumber": 1,
    "totalThoughts": 4,
    "nextThoughtNeeded": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "serverId": "sequential-thinking",
  "toolName": "sequentialthinking",
  "content": [
    {
      "type": "text",
      "text": "{\"thoughtNumber\": 1, \"totalThoughts\": 4, ...}"
    }
  ]
}
```

## Environment Variables

Add these to your `.env` file:

```bash
# Sequential Thinking - Always enabled, no config needed

# Manim MCP - Docker-based animation generation
ENABLE_MANIM=false
MANIM_MCP_URL=http://manim-mcp:8000

# Python MCP - Docker-based Python execution
ENABLE_PYTHON=false
PYTHON_MCP_URL=http://python-mcp:8000

# GitHub MCP - Requires personal access token
GITHUB_TOKEN=ghp_your_token_here

# Figma MCP - Requires personal access token
FIGMA_TOKEN=figd_your_token_here
```

## Currently Active

✅ **Sequential Thinking MCP** - Fully operational
- Transport: stdio via npx
- Tool: `sequentialthinking`
- Status: Connected and tested
- No configuration required

## Setup Instructions

### 1. Sequential Thinking (Active)

No setup required - works out of the box via npx.

### 2. GitHub Integration

1. Get a GitHub Personal Access Token:
   - Go to GitHub Settings → Developer settings → Personal access tokens
   - Generate new token with `repo` and `read:org` scopes

2. Add to `.env`:
   ```bash
   GITHUB_TOKEN=ghp_your_token_here
   ```

3. Restart Docker containers:
   ```bash
   docker-compose down
   docker-compose up -d
   ```

### 3. Figma Integration

1. Get a Figma Personal Access Token:
   - Go to Figma Settings → Account → Personal access tokens
   - Generate new token

2. Add to `.env`:
   ```bash
   FIGMA_TOKEN=figd_your_token_here
   ```

3. Restart Docker containers

### 4. Manim MCP (Docker-based)

**Status**: Configuration ready, Docker container pending

Will enable mathematical animation generation. See Docker setup section below.

### 5. Python MCP (Docker-based)

**Status**: Configuration ready, Docker container pending

Will enable Python-based diagram and visualization generation.

## Testing

### Test Status Endpoint

```bash
curl -s http://localhost:3000/api/mcp/status | python3 -m json.tool
```

### Test Sequential Thinking Tool

```bash
curl -X POST http://localhost:3000/api/mcp/call \
  -H "Content-Type: application/json" \
  -d '{
    "serverId": "sequential-thinking",
    "toolName": "sequentialthinking",
    "arguments": {
      "thought": "Analyzing the problem step by step",
      "thoughtNumber": 1,
      "totalThoughts": 3,
      "nextThoughtNeeded": true
    }
  }'
```

## File Structure

```
Mentora/
├── lib/
│   └── mcp/
│       ├── client.ts          # MCP client implementation
│       ├── manager.ts         # Connection manager
│       ├── config.ts          # Server configurations
│       ├── init.ts            # Initialization logic
│       └── index.ts           # Module exports
├── types/
│   └── mcp.ts                 # TypeScript definitions
├── app/api/
│   └── mcp/
│       ├── status/route.ts    # Status endpoint
│       └── call/route.ts      # Tool call endpoint
└── .env.example               # Environment template
```

## Docker Integration

The MCP client runs inside the Mentora backend Docker container and can connect to:

1. **External MCP servers** via stdio/npx (Sequential Thinking, GitHub, Figma)
2. **Dockerized MCP servers** via HTTP (Manim, Python) - pending setup

### Next Steps for Docker MCP Servers

1. Create Dockerfile for Manim MCP server
2. Create Dockerfile for Python MCP server
3. Add services to `docker-compose.yml`
4. Configure networking between containers

## Troubleshooting

### Server shows "disconnected"

- Check environment variables are set
- For stdio servers: Ensure npx can access the internet
- For HTTP servers: Ensure Docker containers are running

### "Server not found" error

- Ensure MCP manager is initialized
- Check `/api/mcp/status` shows server as connected
- Try restarting Docker containers

### Health check failures

- Check Docker logs: `docker logs mentora-backend`
- Verify network connectivity
- Check MCP server is responding

### Module not found errors

- Rebuild Docker containers: `docker-compose build backend`
- Ensure `package-lock.json` includes `@modelcontextprotocol/sdk`

## Features

### Auto-Reconnection

MCP manager automatically reconnects to servers that fail health checks (every 5 minutes).

### Lazy Initialization

MCP connections initialize on first API call, not on server startup. This improves startup time.

### Health Monitoring

Periodic health checks ensure connections remain active. Failed connections trigger automatic reconnection attempts.

### Tool Discovery

Available tools are automatically discovered from each connected server and exposed via the status API.

## Integration with Teaching Agent

The MCP client layer is now ready to be integrated with specialized "brains":

- **MathBrain**: Use Sequential Thinking + Manim for step-by-step math explanations
- **BioBrain**: Use Python MCP for biological diagrams and visualizations
- **CodeBrain**: Use GitHub MCP for code examples and references
- **DesignBrain**: Use Figma MCP for design critiques and component references

## Next Steps

1. ✅ MCP Client Layer - Complete
2. ⏳ Docker containers for Manim and Python MCPs
3. ⏳ Specialized Brain implementations
4. ⏳ Multimodal memory integration (ChromaDB)
5. ⏳ Agent orchestrator to route requests to appropriate brains

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Sequential Thinking Server](https://github.com/modelcontextprotocol/servers/tree/main/src/sequentialthinking)
- [Manim Community](https://www.manim.community/)

---

**Status**: MCP Client Layer fully operational with Sequential Thinking server connected and tested.
