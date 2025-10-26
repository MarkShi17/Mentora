# BioRender OAuth Implementation Guide for Mentora

## Overview

This guide walks you through adding BioRender OAuth authentication to Mentora so users can connect their BioRender accounts and access illustrations directly from your application.

## What You Need to Implement

### 1. OAuth Flow Architecture

```
User → Mentora Frontend → Mentora Backend → BioRender OAuth → User Approves → Token Storage → MCP Client
```

### 2. Required Components

1. **OAuth Routes** - Handle authorization and callback
2. **Token Storage** - Store user tokens securely
3. **Frontend UI** - Connect/disconnect buttons
4. **MCP Client Update** - Include auth tokens in requests

---

## Step 1: Create OAuth API Routes

### A. Authorization Route (`app/api/auth/biorender/authorize/route.ts`)

This redirects users to BioRender's login page:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  // Get the user's session ID (you'll need to implement session management)
  const sessionId = request.cookies.get('session_id')?.value;

  if (!sessionId) {
    return NextResponse.json({ error: 'No session found' }, { status: 401 });
  }

  // BioRender OAuth parameters
  const authUrl = new URL('https://mcp.services.biorender.com/oauth/authorize');
  authUrl.searchParams.set('client_id', process.env.BIORENDER_OAUTH_CLIENT_ID || '');
  authUrl.searchParams.set('redirect_uri', `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/biorender/callback`);
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('scope', 'read:illustrations search:library');
  authUrl.searchParams.set('state', sessionId); // Use session ID as state for security

  return NextResponse.redirect(authUrl.toString());
}
```

### B. Callback Route (`app/api/auth/biorender/callback/route.ts`)

This receives the authorization code and exchanges it for an access token:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // This is the session ID

  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}?error=oauth_failed`);
  }

  try {
    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://mcp.services.biorender.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        grant_type: 'authorization_code',
        code,
        client_id: process.env.BIORENDER_OAUTH_CLIENT_ID,
        client_secret: process.env.BIORENDER_OAUTH_CLIENT_SECRET,
        redirect_uri: `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/biorender/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error('Token exchange failed');
    }

    const tokenData = await tokenResponse.json();

    // Store the tokens (see Step 2 for storage implementation)
    await storeUserTokens(state, {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    });

    // Redirect back to the app with success
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}?biorender_connected=true`);

  } catch (error) {
    console.error('BioRender OAuth error:', error);
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL}?error=oauth_failed`);
  }
}

// Helper function - implementation in Step 2
async function storeUserTokens(sessionId: string, tokens: any) {
  // This will be implemented in Step 2
}
```

### C. Connection Status Route (`app/api/auth/biorender/status/route.ts`)

Check if user has connected BioRender:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const sessionId = request.cookies.get('session_id')?.value;

  if (!sessionId) {
    return NextResponse.json({ connected: false });
  }

  const tokens = await getUserTokens(sessionId);

  return NextResponse.json({
    connected: !!tokens,
    expiresAt: tokens?.expiresAt,
  });
}

// Helper function - implementation in Step 2
async function getUserTokens(sessionId: string) {
  // This will be implemented in Step 2
}
```

### D. Disconnect Route (`app/api/auth/biorender/disconnect/route.ts`)

Allow users to disconnect BioRender:

```typescript
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  const sessionId = request.cookies.get('session_id')?.value;

  if (!sessionId) {
    return NextResponse.json({ error: 'No session found' }, { status: 401 });
  }

  await deleteUserTokens(sessionId);

  return NextResponse.json({ success: true });
}

// Helper function - implementation in Step 2
async function deleteUserTokens(sessionId: string) {
  // This will be implemented in Step 2
}
```

---

## Step 2: Token Storage

You have two options for storing OAuth tokens:

### Option A: In-Memory Storage (Simple, for Development)

Create `lib/auth/tokenStore.ts`:

```typescript
interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

// In-memory storage (lost on server restart)
const tokenStore = new Map<string, TokenData>();

export function storeUserTokens(sessionId: string, tokens: TokenData): void {
  tokenStore.set(sessionId, tokens);
}

export function getUserTokens(sessionId: string): TokenData | undefined {
  const tokens = tokenStore.get(sessionId);

  // Check if token is expired
  if (tokens && tokens.expiresAt < new Date()) {
    tokenStore.delete(sessionId);
    return undefined;
  }

  return tokens;
}

export function deleteUserTokens(sessionId: string): void {
  tokenStore.delete(sessionId);
}

export function getAllUserSessions(): string[] {
  return Array.from(tokenStore.keys());
}
```

### Option B: Database Storage (Production-Ready)

If you add a database (PostgreSQL, MongoDB, etc.), create a schema:

```sql
-- PostgreSQL example
CREATE TABLE biorender_tokens (
  session_id VARCHAR(255) PRIMARY KEY,
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

Then create `lib/auth/tokenStore.ts`:

```typescript
import { db } from '@/lib/db'; // Your database client

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

export async function storeUserTokens(sessionId: string, tokens: TokenData): Promise<void> {
  await db.query(
    `INSERT INTO biorender_tokens (session_id, access_token, refresh_token, expires_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (session_id)
     DO UPDATE SET access_token = $2, refresh_token = $3, expires_at = $4, updated_at = NOW()`,
    [sessionId, tokens.accessToken, tokens.refreshToken, tokens.expiresAt]
  );
}

export async function getUserTokens(sessionId: string): Promise<TokenData | undefined> {
  const result = await db.query(
    `SELECT access_token, refresh_token, expires_at
     FROM biorender_tokens
     WHERE session_id = $1 AND expires_at > NOW()`,
    [sessionId]
  );

  if (result.rows.length === 0) {
    return undefined;
  }

  return {
    accessToken: result.rows[0].access_token,
    refreshToken: result.rows[0].refresh_token,
    expiresAt: result.rows[0].expires_at,
  };
}

export async function deleteUserTokens(sessionId: string): Promise<void> {
  await db.query('DELETE FROM biorender_tokens WHERE session_id = $1', [sessionId]);
}
```

---

## Step 3: Update MCP Client to Include Auth Tokens

Modify `lib/mcp/client.ts` to include BioRender tokens:

```typescript
import { getUserTokens } from '@/lib/auth/tokenStore';

export class MCPClient {
  // ... existing code ...

  async callTool(
    serverId: string,
    toolName: string,
    args: any,
    sessionId?: string
  ): Promise<MCPToolResult> {
    const server = getServerConfig(serverId);

    if (!server) {
      throw new Error(`Server not found: ${serverId}`);
    }

    // Build request headers
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    // Add OAuth token for BioRender
    if (serverId === 'biorender' && sessionId) {
      const tokens = await getUserTokens(sessionId);
      if (tokens) {
        headers['Authorization'] = `Bearer ${tokens.accessToken}`;
      } else {
        throw new Error('BioRender not connected. Please connect your BioRender account.');
      }
    }

    // Make MCP request
    const response = await fetch(`${server.url}/mcp`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: Date.now(),
        method: 'tools/call',
        params: {
          name: toolName,
          arguments: args,
        },
      }),
    });

    // ... rest of existing code ...
  }
}
```

---

## Step 4: Frontend UI Components

### A. BioRender Connection Button

Create `apps/web/components/biorender-connect.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';

export function BioRenderConnect() {
  const [connected, setConnected] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkConnectionStatus();
  }, []);

  async function checkConnectionStatus() {
    try {
      const response = await fetch('/api/auth/biorender/status');
      const data = await response.json();
      setConnected(data.connected);
    } catch (error) {
      console.error('Failed to check BioRender status:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleConnect() {
    window.location.href = '/api/auth/biorender/authorize';
  }

  async function handleDisconnect() {
    setLoading(true);
    try {
      await fetch('/api/auth/biorender/disconnect', { method: 'POST' });
      setConnected(false);
    } catch (error) {
      console.error('Failed to disconnect BioRender:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="flex items-center gap-2">
      {connected ? (
        <>
          <span className="text-green-600">✓ BioRender Connected</span>
          <button
            onClick={handleDisconnect}
            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
          >
            Disconnect
          </button>
        </>
      ) : (
        <button
          onClick={handleConnect}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          Connect BioRender
        </button>
      )}
    </div>
  );
}
```

### B. Add to Settings Page

Add the component to your settings page:

```typescript
import { BioRenderConnect } from '@/components/biorender-connect';

export default function SettingsPage() {
  return (
    <div>
      <h2>Integrations</h2>
      <div className="mt-4">
        <h3>BioRender</h3>
        <p>Connect your BioRender account to access professional scientific illustrations.</p>
        <BioRenderConnect />
      </div>
    </div>
  );
}
```

---

## Step 5: Environment Variables

Update your `.env` file:

```bash
# BioRender OAuth (you need to get these from BioRender)
BIORENDER_OAUTH_CLIENT_ID=your_client_id_here
BIORENDER_OAUTH_CLIENT_SECRET=your_client_secret_here

# App URL for OAuth callback
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

---

## Step 6: Getting BioRender OAuth Credentials

**You need to contact BioRender to get OAuth credentials:**

1. Email BioRender support: support@biorender.com
2. Request: "OAuth client credentials for MCP integration"
3. Provide:
   - Your application name: "Mentora"
   - Redirect URI: `http://localhost:3001/api/auth/biorender/callback` (dev)
   - Redirect URI: `https://your-domain.com/api/auth/biorender/callback` (production)
   - Requested scopes: `read:illustrations search:library`

They will provide:
- `client_id`
- `client_secret`

---

## Step 7: Session Management (Important!)

The implementation above assumes you have session management. If you don't have it yet, here's a simple implementation:

Create `lib/auth/session.ts`:

```typescript
import { cookies } from 'next/headers';
import { randomUUID } from 'crypto';

export function getOrCreateSession(): string {
  const cookieStore = cookies();
  let sessionId = cookieStore.get('session_id')?.value;

  if (!sessionId) {
    sessionId = randomUUID();
    cookieStore.set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }

  return sessionId;
}
```

Then use it in your routes:

```typescript
import { getOrCreateSession } from '@/lib/auth/session';

export async function GET(request: NextRequest) {
  const sessionId = getOrCreateSession();
  // ... rest of code ...
}
```

---

## Testing the Implementation

### 1. Start your application
```bash
npm run dev  # or docker-compose up
```

### 2. Navigate to settings
- Go to your settings page
- You should see "Connect BioRender" button

### 3. Click "Connect BioRender"
- You'll be redirected to BioRender login
- Log in with your BioRender account
- Approve permissions
- You'll be redirected back to Mentora

### 4. Test in conversation
Ask: "Search BioRender for CRISPR diagrams"

The system should:
- Detect you want to use BioRender
- Include your auth token in the request
- Return BioRender illustrations

---

## Estimated Implementation Time

- **OAuth Routes**: 2-3 hours
- **Token Storage** (in-memory): 1 hour
- **Token Storage** (database): 2-3 hours
- **MCP Client Update**: 1 hour
- **Frontend UI**: 2 hours
- **Testing & Debugging**: 2-3 hours

**Total: 8-12 hours** (depending on database choice)

---

## Troubleshooting

### "OAuth credentials not found"
- Make sure `BIORENDER_OAUTH_CLIENT_ID` and `BIORENDER_OAUTH_CLIENT_SECRET` are set in `.env`
- Restart your server after adding env vars

### "Redirect URI mismatch"
- Check that the redirect URI in BioRender's OAuth settings matches exactly: `http://localhost:3001/api/auth/biorender/callback`

### "Token expired"
- Implement token refresh logic (see Advanced section below)

### "CORS errors"
- BioRender's OAuth server should handle CORS correctly
- If issues persist, check that you're using the correct OAuth endpoints

---

## Advanced: Token Refresh

BioRender tokens expire. Implement auto-refresh:

```typescript
async function refreshBioRenderToken(sessionId: string): Promise<void> {
  const tokens = await getUserTokens(sessionId);

  if (!tokens?.refreshToken) {
    throw new Error('No refresh token available');
  }

  const response = await fetch('https://mcp.services.biorender.com/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      grant_type: 'refresh_token',
      refresh_token: tokens.refreshToken,
      client_id: process.env.BIORENDER_OAUTH_CLIENT_ID,
      client_secret: process.env.BIORENDER_OAUTH_CLIENT_SECRET,
    }),
  });

  const newTokens = await response.json();

  await storeUserTokens(sessionId, {
    accessToken: newTokens.access_token,
    refreshToken: newTokens.refresh_token,
    expiresAt: new Date(Date.now() + newTokens.expires_in * 1000),
  });
}
```

Call this in your MCP client before making requests if token is close to expiration.

---

## Summary

1. ✅ Create 4 OAuth API routes
2. ✅ Implement token storage (in-memory or database)
3. ✅ Update MCP client to include auth tokens
4. ✅ Add frontend UI for connecting BioRender
5. ✅ Get OAuth credentials from BioRender
6. ✅ Implement session management
7. ✅ Test the complete flow

Once complete, users can connect their BioRender accounts and Mentora will have access to all 30,000+ professional scientific illustrations!
