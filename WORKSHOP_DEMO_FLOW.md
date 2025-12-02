WORKSHOP DEMO FLOW: SLACK + MASTRA INTEGRATION

═══════════════════════════════════════════════════════

OVERVIEW

Connect a Mastra agent to Slack so it responds to messages as a bot with conversation memory.

Duration: 45-60 minutes

═══════════════════════════════════════════════════════

PART 1: INTRODUCTION (10 MIN)

Architecture Overview

User → Slack Webhook → /api/slack/events → Verify Signature → Mastra Agent → Response → Slack

What You'll Learn
• Create a Slack app and configure webhooks
• Route Slack messages to a Mastra agent
• Maintain conversation memory per thread
• Verify webhook signatures for security
• Build custom agents with tools

═══════════════════════════════════════════════════════

PART 2: SETUP (15 MIN)

Environment Setup

Step 1: Install dependencies
    pnpm install

Step 2: Create .env.local file with:
    OPENAI_API_KEY=sk-your-key
    NEXT_PUBLIC_APP_URL=http://localhost:3000
    SLACK_CLIENT_ID=your-client-id
    SLACK_CLIENT_SECRET=your-client-secret
    SLACK_SIGNING_SECRET=your-signing-secret
    SLACK_BOT_TOKEN=xoxb-your-bot-token


Create Slack App

1. Go to https://api.slack.com/apps → Create New App → From scratch

2. OAuth & Permissions → Bot Token Scopes:
   • app_mentions:read
   • chat:write

3. Event Subscriptions → Enable and subscribe to:
   • app_mention
   • message.im

4. Copy credentials to .env.local

5. Install App to workspace


Start Servers

Terminal 1:
    pnpm dev

Terminal 2:
    ngrok http 3000

Update Event Subscriptions URL in Slack:
    https://your-ngrok-url.ngrok-free.app/api/slack/events

═══════════════════════════════════════════════════════

PART 3: TEST THE AGENT (10 MIN)

Demo the Reverse Agent

Message the bot in Slack:
• "hello" → "olleh"
• "Hello World!" → "!dlroW olleH"


Show the Code Flow

AGENT DEFINITION (src/mastra/agents/reverse-agent.ts):

    const reverseTextTool = createTool({
      id: "reverse-text",
      execute: async ({ context }) => {
        return context.text.split("").reverse().join("");
      },
    });

    export const reverseAgent = new Agent({
      name: "reverse-agent",
      instructions: "Use the reverse-text tool and return only the reversed text",
      tools: [reverseTextTool],
      memory: new Memory({ options: { lastMessages: 20 } }),
    });


EVENT HANDLER (src/app/api/slack/events/route.ts):

    // 1. Receive webhook
    const payload = JSON.parse(body);

    // 2. Verify signature
    const isValid = verifySlackRequest(
      process.env.SLACK_SIGNING_SECRET!,
      slackSignature!,
      slackTimestamp!,
      body
    );

    // 3. Send to agent
    const response = await sendToAgent({
      message: messageText,
      agentName: "reverse-agent",
      thread: `slack-${event.channel}-${event.thread_ts || event.ts}`,
    });

    // 4. Post response
    await slackClient.chat.postMessage({
      channel: event.channel,
      text: response.text,
    });

═══════════════════════════════════════════════════════

PART 4: MEMORY & THREADS (10 MIN)

Demonstrate Thread Memory

Thread 1:
• "My favorite color is blue"
• "What's my favorite color?" → "blue"

Thread 2:
• "My favorite color is red"
• "What's my favorite color?" → "red"

Back to Thread 1:
• "What's my favorite color?" → Still "blue"!


How It Works

Each unique thread ID gets isolated memory:

    thread: `slack-${event.channel}-${event.thread_ts || event.ts}`

═══════════════════════════════════════════════════════

PART 5: SECURITY (10 MIN)

Signature Verification (src/lib/slack/verify.ts)

    export function verifySlackRequest(
      signingSecret: string,
      slackSignature: string,
      timestamp: string,
      body: string
    ): boolean {
      // 1. Prevent replay attacks (5-minute window)
      const time = Math.floor(Date.now() / 1000);
      if (Math.abs(time - parseInt(timestamp)) > 60 * 5) {
        return false;
      }

      // 2. Generate HMAC signature
      const sigBasestring = `v0:${timestamp}:${body}`;
      const mySignature = 'v0=' + 
        crypto.createHmac('sha256', signingSecret)
          .update(sigBasestring)
          .digest('hex');

      // 3. Compare (timing-safe)
      return crypto.timingSafeEqual(
        Buffer.from(mySignature),
        Buffer.from(slackSignature)
      );
    }

Key Points:
• Verifies requests are from Slack
• Prevents replay attacks
• Uses HMAC SHA256

═══════════════════════════════════════════════════════

PART 6: BUILD A CUSTOM AGENT (15 MIN)

Create Weather Agent

CREATE src/mastra/agents/weather-agent.ts:

    import { Agent } from "@mastra/core/agent";
    import { Memory } from "@mastra/memory";
    import { createTool } from "@mastra/core/tools";
    import { z } from "zod";

    const checkWeatherTool = createTool({
      id: "check-weather",
      description: "Get current weather for a location",
      inputSchema: z.object({
        location: z.string(),
      }),
      execute: async ({ context }) => {
        // Mock data for demo
        const conditions = ["sunny", "rainy", "cloudy", "stormy"];
        const condition = conditions[Math.floor(Math.random() * conditions.length)];
        const temp = Math.floor(Math.random() * 30) + 50;
        
        return {
          location: context.location,
          condition,
          temperature: temp,
          precipitation: condition === "rainy" || condition === "stormy" ? "60%" : "10%"
        };
      },
    });

    export const weatherAgent = new Agent({
      name: "weather-agent",
      description: "Weather assistant with umbrella recommendations",
      instructions: `You are a weather assistant. Use check-weather tool and 
        always mention if user needs an umbrella based on conditions.`,
      model: "openai/gpt-4o-mini",
      tools: [checkWeatherTool],
      memory: new Memory({ options: { lastMessages: 20 } }),
    });


REGISTER in src/mastra/index.ts:

    import { weatherAgent } from "./agents/weather-agent";

    export const mastra = new Mastra({
      agents: { reverseAgent, capsAgent, numbersAgent, weatherAgent },
      // ...
    });


UPDATE webhook handler in src/app/api/slack/events/route.ts:

    agentName: "weather-agent",  // or use env var


TEST:
• "What's the weather in San Francisco?"
• "Do I need an umbrella in NYC?"

═══════════════════════════════════════════════════════

PART 7: WRAP UP (5 MIN)

Production Checklist
☐ Replace JSON storage with database
☐ Deploy to real domain (not ngrok)
☐ Encrypt tokens at rest
☐ Add error handling & retries
☐ Implement rate limiting
☐ Add monitoring/logging


Key Files
    src/
    ├── app/api/slack/
    │   ├── events/route.ts       # Webhook handler
    │   └── oauth/callback/...    # OAuth flow
    ├── lib/slack/verify.ts       # Signature verification
    └── mastra/
        ├── agents/               # Agent definitions
        └── index.ts              # Mastra config

═══════════════════════════════════════════════════════

Q&A (10-15 MIN)

Common Questions

Q: Can I use external APIs in tools?
A: Yes! Replace mock data with real API calls.

Q: How do I handle long operations?
A: Respond to Slack immediately, process in background:

    return NextResponse.json({ ok: true });
    (async () => {
      const result = await longOperation();
      await slackClient.chat.postMessage({...});
    })();

Q: Can I route to multiple agents?
A: Yes! Use environment variables, slash commands, or message parsing.

Q: How do I add slash commands?
A: Configure in Slack app settings, create handler at /api/slack/commands.

═══════════════════════════════════════════════════════

TROUBLESHOOTING

Problem: Invalid signature
Solution: Check SLACK_SIGNING_SECRET matches Slack app

Problem: Event Subscriptions won't verify
Solution: Server must be running before configuring URL

Problem: Bot not responding
Solution: Verify ngrok URL is HTTPS and updated

Problem: Agent not found
Solution: Check agent registered in mastra/index.ts

Problem: Memory not working
Solution: Verify thread parameter is consistent

═══════════════════════════════════════════════════════

QUICK REFERENCE

Setup Checklist
☐ Clone repo, run pnpm install
☐ Create Slack app with bot scopes
☐ Configure Event Subscriptions
☐ Set environment variables
☐ Start dev server + ngrok
☐ Test in Slack


Architecture
One Slack app → One Mastra agent → Direct webhook routing


Scaling
After basics, explore:
• Dynamic app creation (Manifest API)
• Multi-agent routing
• Centralized management

═══════════════════════════════════════════════════════

RESOURCES

• Mastra: https://mastra.ai/docs
• Slack API: https://api.slack.com/
• Events API: https://api.slack.com/apis/connections/events-api
