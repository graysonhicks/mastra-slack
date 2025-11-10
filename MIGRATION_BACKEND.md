# Backend Migration - Slack Integration

## Goal
Copy existing Slack routes from Next.js to Cloud, swap storage from JSON file to database.

**Effort:** ~1 day

---

## Current Routes (What Works)

```
src/app/api/slack/
├── events/route.ts           → Handle Slack webhooks
├── oauth/callback/route.ts   → App installation
├── user-auth/start/route.ts  → Start OAuth
├── user-auth/callback/route.ts → Create app
└── apps/route.ts             → List apps
```

**Strategy:** Copy these files, change from Next.js to Hono syntax.

---

## New File Structure

```
deployers/cloud/src/slack/
├── events.ts              # Webhook handler
├── oauth-callback.ts      # App installation
├── user-auth-start.ts     # Start OAuth
├── user-auth-callback.ts  # Create app + manifest
├── connections.ts         # Get/disconnect endpoints
├── storage.ts             # Database queries
├── verify.ts              # Signature verification
├── oauth.ts               # OAuth helpers
├── manifest.ts            # App manifest generation
└── index.ts               # Register routes
```

---

## Migration Pattern

### Before (Next.js)
```typescript
import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const data = JSON.parse(body);
  
  storage.saveInstallation(data);
  
  return NextResponse.json({ ok: true });
}
```

### After (Hono)
```typescript
import { Context } from 'hono';

export async function POST(c: Context) {
  const body = await c.req.text();
  const data = JSON.parse(body);
  
  const storage = getStorage(c);
  await storage.saveInstallation(data);
  
  return c.json({ ok: true });
}
```

**Changes:**
- `NextRequest` → `Context` (from Hono)
- `request.text()` → `c.req.text()`
- `NextResponse.json()` → `c.json()`
- `storage.method()` → `await storage.method()` (now async)
- That's it!

---

## Files to Copy + Adapt

### 1. Events Handler
**Copy from:** `src/app/api/slack/events/route.ts`  
**Copy to:** `deployers/cloud/src/slack/events.ts`

**Changes:**
```typescript
// Before
export async function POST(request: NextRequest) {
  const body = await request.text();
  // ...
  const installation = storage.getInstallationByTeamId(teamId);
  return NextResponse.json({ ok: true });
}

// After
export async function handleEvents(c: Context) {
  const body = await c.req.text();
  // ...
  const storage = new SlackStorage(c.get('db'));
  const installation = await storage.getInstallationByTeamId(teamId);
  return c.json({ ok: true });
}
```

### 2. OAuth Callback
**Copy from:** `src/app/api/slack/oauth/callback/route.ts`  
**Copy to:** `deployers/cloud/src/slack/oauth-callback.ts`

**Changes:**
```typescript
// Before
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  // ...
  storage.saveInstallation(installation);
  return NextResponse.redirect(url);
}

// After  
export async function handleOAuthCallback(c: Context) {
  const code = c.req.query("code");
  // ...
  const storage = new SlackStorage(c.get('db'));
  await storage.saveInstallation(installation);
  return c.redirect(url);
}
```

### 3. User Auth Start
**Copy from:** `src/app/api/slack/user-auth/start/route.ts`  
**Copy to:** `deployers/cloud/src/slack/user-auth-start.ts`

Minimal changes - just swap `NextResponse.redirect()` → `c.redirect()`

### 4. User Auth Callback
**Copy from:** `src/app/api/slack/user-auth/callback/route.ts`  
**Copy to:** `deployers/cloud/src/slack/user-auth-callback.ts`

Same pattern as above.

### 5. Utility Files (Copy As-Is)

These need zero changes:

**Copy:** `src/lib/slack/verify.ts` → `deployers/cloud/src/slack/verify.ts`  
**Copy:** `src/lib/slack/oauth.ts` → `deployers/cloud/src/slack/oauth.ts`  
**Copy:** `src/lib/slack/manifest-generator.ts` → `deployers/cloud/src/slack/manifest.ts`

---

## New Storage File

Replace in-memory Map with simple database queries.

**File:** `deployers/cloud/src/slack/storage.ts`

```typescript
import { Database } from '@libsql/client';

export interface SlackApp {
  id: string;
  userId: string;
  agentName: string;
  appId: string;
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  createdAt: string;
}

export interface SlackInstallation {
  id: string;
  slackAppId: string;
  teamId: string;
  teamName: string;
  botToken: string;
  botUserId: string;
  installedAt: string;
}

export class SlackStorage {
  constructor(private db: Database) {}

  async saveApp(app: SlackApp) {
    await this.db.execute({
      sql: `INSERT INTO slack_apps 
            (id, user_id, agent_name, app_id, client_id, client_secret, signing_secret, created_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [app.id, app.userId, app.agentName, app.appId, app.clientId, app.clientSecret, app.signingSecret, app.createdAt],
    });
  }

  async getApp(id: string): Promise<SlackApp | null> {
    const result = await this.db.execute({
      sql: 'SELECT * FROM slack_apps WHERE id = ?',
      args: [id],
    });
    return result.rows[0] as SlackApp || null;
  }

  async saveInstallation(installation: SlackInstallation) {
    await this.db.execute({
      sql: `INSERT INTO slack_installations 
            (id, slack_app_id, team_id, team_name, bot_token, bot_user_id, installed_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
      args: [
        installation.id,
        installation.slackAppId,
        installation.teamId,
        installation.teamName,
        installation.botToken,
        installation.botUserId,
        installation.installedAt,
      ],
    });
  }

  async getInstallationByTeamId(teamId: string): Promise<SlackInstallation | null> {
    const result = await this.db.execute({
      sql: 'SELECT * FROM slack_installations WHERE team_id = ?',
      args: [teamId],
    });
    return result.rows[0] as SlackInstallation || null;
  }

  async getAppByAgentName(userId: string, agentName: string): Promise<SlackApp | null> {
    const result = await this.db.execute({
      sql: 'SELECT * FROM slack_apps WHERE user_id = ? AND agent_name = ?',
      args: [userId, agentName],
    });
    return result.rows[0] as SlackApp || null;
  }

  async deleteApp(appId: string) {
    await this.db.execute({
      sql: 'DELETE FROM slack_apps WHERE id = ?',
      args: [appId],
    });
    // Installations cascade delete automatically
  }
}
```

**Total:** ~80 lines

---

## New Connections Endpoint

For the frontend to fetch connection status.

**File:** `deployers/cloud/src/slack/connections.ts`

```typescript
import { Context } from 'hono';
import { SlackStorage } from './storage';

export async function getConnection(c: Context) {
  const agentName = c.req.param('agentName');
  const user = c.get('user'); // From Cloud auth
  
  const storage = new SlackStorage(c.get('db'));
  const app = await storage.getAppByAgentName(user.id, agentName);
  
  if (!app) {
    return c.json({ error: 'Not found' }, 404);
  }

  const installations = await storage.getInstallationsByAppId(app.id);
  if (installations.length === 0) {
    return c.json({ error: 'Not found' }, 404);
  }

  const installation = installations[0];
  
  return c.json({
    agentName,
    teamId: installation.teamId,
    teamName: installation.teamName,
    botUserId: installation.botUserId,
    installedAt: installation.installedAt,
  });
}

export async function disconnect(c: Context) {
  const agentName = c.req.param('agentName');
  const user = c.get('user');
  
  const storage = new SlackStorage(c.get('db'));
  const app = await storage.getAppByAgentName(user.id, agentName);
  
  if (!app) {
    return c.json({ error: 'Not found' }, 404);
  }

  await storage.deleteApp(app.id);
  
  return c.json({ ok: true });
}
```

---

## Route Registration

**File:** `deployers/cloud/src/slack/index.ts`

```typescript
import { Hono } from 'hono';
import { handleEvents } from './events';
import { handleOAuthCallback } from './oauth-callback';
import { startUserAuth } from './user-auth-start';
import { handleUserAuthCallback } from './user-auth-callback';
import { getConnection, disconnect } from './connections';

const slack = new Hono();

slack.post('/events', handleEvents);
slack.get('/oauth/callback', handleOAuthCallback);
slack.get('/auth/start', startUserAuth);
slack.get('/auth/callback', handleUserAuthCallback);
slack.get('/connections/:agentName', getConnection);
slack.post('/connections/:agentName/disconnect', disconnect);

export default slack;
```

**File:** `deployers/cloud/src/index.ts` (modify)

```typescript
import slack from './slack';

// ... other routes ...

app.route('/v1/slack', slack);
```

---

## Environment Variables

Same as current app:

```bash
SLACK_CLIENT_ID=123456789.123456789
SLACK_CLIENT_SECRET=abc123def456
```

---

## Helper to Get Storage

Add helper to get database connection:

```typescript
// In routes
function getStorage(c: Context): SlackStorage {
  return new SlackStorage(c.get('db'));
}
```

---

## Testing

### 1. Test Webhook
```bash
curl -X POST http://localhost:4111/v1/slack/events \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"test123"}'

# Should return: {"challenge":"test123"}
```

### 2. Test OAuth
Navigate to: `http://localhost:4111/v1/slack/auth/start?agentName=test-agent`

Should redirect to Slack.

### 3. Test Connection Endpoint
```bash
curl http://localhost:4111/v1/slack/connections/test-agent

# Should return connection or 404
```

---

## Total Code

- **5 route files:** ~500 lines (mostly copied)
- **1 storage file:** ~80 lines (new)
- **1 connections file:** ~40 lines (new)
- **3 utility files:** ~130 lines (copied as-is)
- **1 index file:** ~20 lines (new)

**Total:** ~770 lines (mostly copy-paste)

**Time:** ~1 day

---

## Checklist

- [ ] Copy events handler, adapt to Hono
- [ ] Copy OAuth callback, adapt to Hono
- [ ] Copy user auth start, adapt to Hono
- [ ] Copy user auth callback, adapt to Hono
- [ ] Copy utility files as-is
- [ ] Create storage.ts with database queries
- [ ] Create connections.ts for get/disconnect
- [ ] Register routes in index.ts
- [ ] Test webhook endpoint
- [ ] Test OAuth flow end-to-end
- [ ] Test connection endpoints

**Done!**

