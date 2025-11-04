import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { storage } from "@/lib/storage";
import { verifySlackRequest } from "@/lib/slack/verify";
import { sendToAgent } from "@/lib/mastra-client";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const payload = JSON.parse(body);

    // Handle URL verification challenge
    if (payload.type === "url_verification") {
      console.log("✅ URL verification challenge received");
      return NextResponse.json({ challenge: payload.challenge });
    }

    // Get Slack signature headers
    const slackSignature = request.headers.get("x-slack-signature");
    const slackTimestamp = request.headers.get("x-slack-request-timestamp");

    if (!slackSignature || !slackTimestamp) {
      return NextResponse.json(
        { error: "Missing Slack signature headers" },
        { status: 401 }
      );
    }

    // Get team ID from payload
    const teamId = payload.team_id;
    if (!teamId) {
      return NextResponse.json(
        { error: "Missing team_id in payload" },
        { status: 400 }
      );
    }

    console.log("🔍 Looking up installation for team:", teamId);

    // Look up the installation and app
    const installation = storage.getInstallationByTeamId(teamId);
    const app = installation ? storage.getApp(installation.slackAppId) : null;

    if (!installation || !app) {
      console.error("❌ Installation or app not found for team:", teamId);
      console.log("Available installations:", storage.getAllInstallations());
      console.log("Available apps:", storage.getAllApps().map(a => ({
        id: a.id,
        appId: a.appId,
        agentName: a.agentName
      })));
      return NextResponse.json(
        { error: "Installation not found" },
        { status: 404 }
      );
    }

    console.log("✅ Found installation:", {
      teamId: installation.teamId,
      teamName: installation.teamName,
      agentName: app.agentName
    });

    // Verify the request signature
    const isValid = verifySlackRequest(
      app.signingSecret,
      slackSignature,
      slackTimestamp,
      body
    );

    if (!isValid) {
      console.error("Invalid Slack signature");
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Handle event
    if (payload.event) {
      const event = payload.event;

      // Ignore bot messages and message edits
      if (event.bot_id || event.subtype) {
        return NextResponse.json({ ok: true });
      }

      // Handle app mentions and direct messages
      if (event.type === "app_mention" || event.type === "message") {
        let messageText = event.text || "";
        const userId = event.user;
        const channelId = event.channel;
        const threadTs = event.thread_ts || event.ts;

        console.log("📨 Raw message received:", {
          agentName: app.agentName,
          rawText: messageText,
          user: userId,
        });

        // Strip out bot mention from message (e.g., "<@U09Q8NJLYJ6> hello" -> "hello")
        messageText = messageText.replace(/<@[A-Z0-9]+>/g, "").trim();

        console.log("📤 Cleaned message to send:", messageText);

        // Process message asynchronously (don't await - respond to Slack immediately)
        (async () => {
          try {
            const response = await sendToAgent({
              message: messageText,
              agentName: app.agentName,
              resource: `slack-${teamId}-${userId}`,
              thread: `slack-${channelId}-${threadTs}`,
            });

            console.log("📥 Agent response:", response.text);

            // Post response back to Slack
            const slackClient = new WebClient(installation.botToken);
            await slackClient.chat.postMessage({
              channel: channelId,
              text: response.text,
              thread_ts: event.thread_ts || event.ts, // Reply in thread, or start one if channel mention
            });

            console.log("✅ Response sent to Slack");
          } catch (error) {
            console.error("Error processing message:", error);
            // Optionally send error message to Slack
          }
        })();
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Error handling Slack event:", error);
    return NextResponse.json(
      { error: "Failed to handle event" },
      { status: 500 }
    );
  }
}

