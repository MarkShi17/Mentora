# BioRender MCP Integration Notes

## Overview

BioRender provides a remote MCP server at `https://mcp.services.biorender.com/mcp` that allows access to their library of 30,000+ professional scientific illustrations.

## Authentication Method

BioRender uses **OAuth 2.0 authentication** rather than API keys. This means users must:
1. Log in with their BioRender account credentials
2. Approve permissions for the AI assistant to access their BioRender library
3. The system stores an access token for future requests

## Current Limitation in Mentora

**Status**: BioRender MCP is configured but **OAuth authentication is not yet implemented**.

### Why the Limitation Exists

Mentora's backend uses the Anthropic API directly, which doesn't provide a built-in UI for OAuth flows. Implementing OAuth requires:

1. **Authorization Endpoints**
   - `GET /oauth/authorize` - Redirect user to BioRender login
   - `POST /oauth/token` - Exchange authorization code for access token

2. **User Interface**
   - Login button/page for users to authenticate with BioRender
   - Callback URL to handle OAuth redirects from BioRender

3. **Token Management**
   - Securely store access tokens per user
   - Handle token refresh when tokens expire
   - Include tokens in requests to BioRender's MCP server

4. **Session Management**
   - Associate BioRender tokens with Mentora user sessions
   - Maintain token validity across requests

### How It Works in Claude Desktop

Claude Desktop implements all of the above:
- Settings > Connectors > Add custom connector
- Enter BioRender MCP URL: `https://mcp.services.biorender.com/mcp`
- Click "Connect" → Opens BioRender login in browser
- User logs in → Redirected back to Claude Desktop
- Access token stored securely → Can now use BioRender tools

## Workarounds

### Option 1: Use BioRender via Claude Desktop

If you need BioRender illustrations:
1. Open Claude Desktop (or claude.ai)
2. Go to Settings > Connectors
3. Click "Add custom connector"
4. Enter URL: `https://mcp.services.biorender.com/mcp`
5. Click "Connect to BioRender" and log in
6. Now you can search BioRender's library in Claude Desktop

### Option 2: Use Alternative Visualization Tools

Mentora already has excellent biology visualization through:

**Python MCP** (enabled):
- 7 biology diagram templates (cell division, DNA structure, etc.)
- Uses matplotlib for rendering
- No authentication required

**Mermaid MCP** (enabled):
- Process diagrams and flowcharts
- Great for biological pathways and workflows
- No authentication required

**ChatMol MCP** (pending PyMOL installation):
- 3D molecular structure visualization
- PDB protein structure rendering
- No authentication required (uses local PyMOL)

## Future Enhancement: Implement OAuth Support

To add BioRender OAuth support to Mentora, you would need to:

### 1. Create OAuth Routes
```typescript
// app/api/auth/biorender/authorize/route.ts
// Redirect user to BioRender OAuth authorization

// app/api/auth/biorender/callback/route.ts
// Handle OAuth callback, exchange code for token
```

### 2. Add Token Storage
```typescript
// Store per-user BioRender access tokens
// Could use database or encrypted session storage
interface UserTokens {
  userId: string;
  biorenderAccessToken: string;
  biorenderRefreshToken: string;
  expiresAt: Date;
}
```

### 3. Update MCP Client
```typescript
// lib/mcp/client.ts
// Include OAuth access token in requests to BioRender MCP server
headers: {
  'Authorization': `Bearer ${userBiorenderToken}`
}
```

### 4. Create UI for Authentication
```tsx
// components/biorender-auth.tsx
// Button to initiate OAuth flow
// Display connection status
```

## Current Configuration

**Environment Variables** (`.env`):
```bash
ENABLE_BIORENDER=false  # Set to true once OAuth is implemented
BIORENDER_MCP_URL=https://mcp.services.biorender.com/mcp
BIORENDER_OAUTH_CLIENT_ID=  # Obtain from BioRender
BIORENDER_OAUTH_CLIENT_SECRET=  # Obtain from BioRender
```

**MCP Config** (`lib/mcp/config.ts`):
- Server configured to use remote BioRender MCP URL
- OAuth credentials placeholders added
- Currently disabled until OAuth flow is implemented

## References

- BioRender MCP Server: https://mcp.services.biorender.com/mcp
- BioRender Help Article: https://help.biorender.com/hc/en-gb/articles/30870978672157
- MCP Authorization Spec: https://modelcontextprotocol.io/specification/draft/basic/authorization
- Claude MCP Connectors: https://support.claude.com/en/articles/11175166

## Estimated Implementation Effort

- **OAuth Backend** (authorization + token management): 4-6 hours
- **Frontend UI** (auth button + status display): 2-3 hours
- **Token Storage** (database schema + migrations): 2-3 hours
- **Testing & Security Review**: 2-4 hours
- **Total**: ~10-16 hours

---

**Summary**: BioRender MCP is configured in Mentora and points to the correct remote server, but OAuth authentication implementation is required before it can be enabled. Use Claude Desktop for BioRender access, or use Mentora's other visualization tools (Python MCP, Mermaid MCP, ChatMol MCP) as alternatives.
