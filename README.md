# Slack + Mastra Integration

Dynamically create Slack apps that route messages to Mastra agents. Each agent becomes its own bot with separate credentials and conversation memory.

## Quick Start

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Environment Variables

Create `.env.local`:

```bash
# Required
OPENAI_API_KEY=sk-your-key-here

# For Slack webhooks (update after running ngrok)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Optional (defaults shown)
MASTRA_API_URL=http://localhost:4111
```

### 3. Create Base Slack App

This is the parent app that creates other apps. You only do this once.

1. Go to [https://api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From scratch**
2. Name it "Mastra" (or anything), select your workspace
3. Go to **OAuth & Permissions**:
   - Add redirect URL: `http://localhost:3000/api/slack/user-auth/callback`
   - **User Token Scopes**: Add `app_configurations:write`
4. Go to **Basic Information**:
   - Copy **Client ID** and **Client Secret** to `.env.local`:

```bash
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
```

### 4. Start Server & Expose with ngrok

Terminal 1:
```bash
pnpm dev
```

Terminal 2:
```bash
ngrok http 3000
```

Copy the ngrok HTTPS URL and update `.env.local`:
```bash
NEXT_PUBLIC_APP_URL=https://abc123.ngrok.app
```

Restart `pnpm dev` after changing env vars.

### 5. Create Agent Apps

1. Open `http://localhost:3000`
2. Click **Install to Slack** for any agent
3. Authorize the base Mastra app (first time only)
4. Install the created agent app to your workspace
5. Message the bot in Slack!

## How It Works

### Architecture
- **One Slack app per agent** - Each agent (reverseAgent, capsAgent, numbersAgent) gets its own bot
- **Dynamic creation** - Apps are created programmatically via Slack's Manifest API
- **Event routing** - Webhook handler looks up agent by team ID and forwards messages
- **Memory per thread** - Each Slack thread maintains separate conversation context

### Message Flow
```
Slack message → /api/slack/events → lookup agent → mastra.agent.generate() → post response
```

## Adding New Agents

1. Create agent file in `src/mastra/agents/`:

```typescript
// src/mastra/agents/my-agent.ts
import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";

export const myAgent = new Agent({
  name: "my-agent",
  description: "What this agent does",
  instructions: "Detailed instructions with examples...",
  model: "openai/gpt-4o-mini",
  tools: [/* your tools */],
  memory: new Memory({
    options: { lastMessages: 20 }
  }),
});
```

2. Register in `src/mastra/index.ts`:

```typescript
import { myAgent } from "./agents/my-agent";

export const mastra = new Mastra({
  agents: { reverseAgent, capsAgent, numbersAgent, myAgent },
  // ...
});
```

3. Add to description map in `src/app/api/agents/route.ts`:

```typescript
const descriptionMap: Record<string, string> = {
  // ...
  myAgent: "What this agent does",
};
```

4. Refresh the UI - it will appear in the table!

## Troubleshooting

**ngrok URL not working?**
- Make sure `NEXT_PUBLIC_APP_URL` uses HTTPS ngrok URL
- Restart Next.js after changing env vars

**Bot not responding?**
- Check both servers are running (`pnpm dev`)
- Check `.slack-storage.json` has the installation
- Look for signature verification errors in terminal

**"Invalid manifest" error?**
- Restart Mastra server to pick up agent changes
- Check agent has `description` field (or it will use instructions)

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   └── slack/
│   │       ├── events/          # Webhook handler
│   │       ├── oauth/           # App installation
│   │       └── user-auth/       # User authorization for app creation
│   └── page.tsx                 # UI dashboard
├── lib/
│   ├── mastra-client.ts         # API client for Mastra
│   ├── storage.ts               # Storage (JSON file for demo)
│   └── slack/
│       ├── manifest-generator.ts # Dynamic manifest creation
│       └── verify.ts             # Signature verification
└── mastra/
    ├── agents/                   # Agent definitions
    └── index.ts                  # Mastra instance
```

## Production Considerations

For production, replace:
- File storage → PostgreSQL/MySQL
- ngrok → Real domain with SSL
- Add user authentication
- Encrypt bot tokens at rest
- Add monitoring and error tracking
