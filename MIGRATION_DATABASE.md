# Database Migration - Slack Integration

## Goal
Create two simple tables to replace the JSON file storage.

**Effort:** ~2 hours

---

## Current Storage (JSON File)

```json
{
  "apps": {
    "app-1": {
      "id": "app-1",
      "userId": "user-1",
      "agentName": "reverseAgent",
      "appId": "A12345",
      "clientId": "123.456",
      "clientSecret": "abc123",
      "signingSecret": "xyz789",
      "createdAt": "2025-01-15T10:00:00Z"
    }
  },
  "installations": {
    "inst-1": {
      "id": "inst-1",
      "slackAppId": "app-1",
      "teamId": "T12345",
      "teamName": "Acme Inc",
      "botToken": "xoxb-token",
      "botUserId": "U12345",
      "installedAt": "2025-01-15T10:05:00Z"
    }
  }
}
```

**Replace with:** 2 database tables

---

## Tables

### 1. slack_apps

Stores Slack apps created via Manifest API.

```sql
CREATE TABLE slack_apps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  app_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  signing_secret TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_slack_apps_user_agent ON slack_apps(user_id, agent_name);
```

**Columns:**
- `id` - UUID
- `user_id` - Cloud user ID
- `agent_name` - Mastra agent name (e.g., "reverseAgent")
- `app_id` - Slack's app ID (e.g., "A12345")
- `client_id` - OAuth client ID
- `client_secret` - OAuth client secret
- `signing_secret` - Webhook signature secret
- `created_at` - ISO timestamp

**Index:** Fast lookup by user + agent name

---

### 2. slack_installations

Tracks which workspaces have installed which apps.

```sql
CREATE TABLE slack_installations (
  id TEXT PRIMARY KEY,
  slack_app_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT,
  bot_token TEXT NOT NULL,
  bot_user_id TEXT NOT NULL,
  installed_at TEXT NOT NULL,
  FOREIGN KEY (slack_app_id) REFERENCES slack_apps(id) ON DELETE CASCADE
);

CREATE INDEX idx_slack_installations_team ON slack_installations(team_id);
CREATE INDEX idx_slack_installations_app ON slack_installations(slack_app_id);
```

**Columns:**
- `id` - UUID
- `slack_app_id` - Foreign key to slack_apps.id
- `team_id` - Slack workspace team ID (e.g., "T12345")
- `team_name` - Workspace name (for display)
- `bot_token` - Bot OAuth token (xoxb-...)
- `bot_user_id` - Slack bot user ID
- `installed_at` - ISO timestamp

**Index:** Fast lookup by team ID (for webhook routing)

**Cascade Delete:** Deleting an app automatically deletes its installations

---

## Migration Script

**File:** `deployers/cloud/db/migrations/001_slack.sql`

```sql
-- Slack Integration Tables

CREATE TABLE IF NOT EXISTS slack_apps (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  app_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  client_secret TEXT NOT NULL,
  signing_secret TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_slack_apps_user_agent 
  ON slack_apps(user_id, agent_name);

CREATE TABLE IF NOT EXISTS slack_installations (
  id TEXT PRIMARY KEY,
  slack_app_id TEXT NOT NULL,
  team_id TEXT NOT NULL,
  team_name TEXT,
  bot_token TEXT NOT NULL,
  bot_user_id TEXT NOT NULL,
  installed_at TEXT NOT NULL,
  FOREIGN KEY (slack_app_id) REFERENCES slack_apps(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_slack_installations_team 
  ON slack_installations(team_id);

CREATE INDEX IF NOT EXISTS idx_slack_installations_app 
  ON slack_installations(slack_app_id);
```

---

## Run Migration

### Development
```bash
sqlite3 cloud.db < deployers/cloud/db/migrations/001_slack.sql
```

### Production
Add to Cloud's migration system (however Cloud handles migrations).

---

## Verify Migration

```sql
-- Check tables exist
.tables

-- Check schema
.schema slack_apps
.schema slack_installations

-- Test insert
INSERT INTO slack_apps (id, user_id, agent_name, app_id, client_id, client_secret, signing_secret, created_at)
VALUES ('test-1', 'user-1', 'test-agent', 'A123', 'C123', 'secret', 'sign', datetime('now'));

-- Check it worked
SELECT * FROM slack_apps;

-- Clean up test
DELETE FROM slack_apps WHERE id = 'test-1';
```

---

## Query Examples

### Save App
```sql
INSERT INTO slack_apps (id, user_id, agent_name, app_id, client_id, client_secret, signing_secret, created_at)
VALUES (?, ?, ?, ?, ?, ?, ?, ?);
```

### Get App by User + Agent
```sql
SELECT * FROM slack_apps 
WHERE user_id = ? AND agent_name = ?;
```

### Save Installation
```sql
INSERT INTO slack_installations (id, slack_app_id, team_id, team_name, bot_token, bot_user_id, installed_at)
VALUES (?, ?, ?, ?, ?, ?, ?);
```

### Get Installation by Team (for webhook routing)
```sql
SELECT * FROM slack_installations WHERE team_id = ?;
```

### Get App + Installation (for webhook)
```sql
SELECT a.*, i.* 
FROM slack_installations i
JOIN slack_apps a ON i.slack_app_id = a.id
WHERE i.team_id = ?;
```

### Delete App (cascade deletes installations)
```sql
DELETE FROM slack_apps WHERE id = ?;
```

---

## Storage Class Methods

The storage class needs these methods (see `MIGRATION_BACKEND.md` for full implementation):

```typescript
class SlackStorage {
  // Apps
  async saveApp(app: SlackApp)
  async getApp(id: string): Promise<SlackApp | null>
  async getAppByAgentName(userId: string, agentName: string): Promise<SlackApp | null>
  async deleteApp(id: string)
  
  // Installations
  async saveInstallation(installation: SlackInstallation)
  async getInstallationByTeamId(teamId: string): Promise<SlackInstallation | null>
  async getInstallationsByAppId(appId: string): Promise<SlackInstallation[]>
}
```

---

## Rollback (if needed)

**File:** `deployers/cloud/db/migrations/001_slack_rollback.sql`

```sql
DROP INDEX IF EXISTS idx_slack_installations_app;
DROP INDEX IF EXISTS idx_slack_installations_team;
DROP TABLE IF EXISTS slack_installations;

DROP INDEX IF EXISTS idx_slack_apps_user_agent;
DROP TABLE IF EXISTS slack_apps;
```

---

## Data Types

All timestamps stored as ISO 8601 strings:
```
"2025-01-15T10:00:00Z"
```

Convert in code:
```typescript
// To database
createdAt: new Date().toISOString()

// From database
createdAt: new Date(row.created_at)
```

---

## Security

### Bot Tokens
If Cloud requires encryption, encrypt `bot_token` and `client_secret`:

```typescript
// Before insert
const encrypted = await encrypt(botToken);

// After select
const decrypted = await decrypt(row.bot_token);
```

Otherwise, database-level encryption is sufficient.

---


## Total Code

- **Migration script:** ~30 lines SQL
- **No code changes** - just schema

**Time:** ~2 hours (including testing)

---

## Checklist

- [ ] Write migration script
- [ ] Test migration on dev database
- [ ] Verify tables created
- [ ] Verify indexes created
- [ ] Test inserting data
- [ ] Test querying data
- [ ] Test cascade delete
- [ ] Run on staging
- [ ] Verify storage class works
- [ ] Run on production

**Done!**

