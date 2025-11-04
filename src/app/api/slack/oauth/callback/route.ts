import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { storage } from "@/lib/storage";
import { decodeState, getBaseUrl } from "@/lib/slack/oauth";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (!code || !state) {
      return NextResponse.json(
        { error: "Missing code or state parameter" },
        { status: 400 }
      );
    }

    // Decode app credentials from state
    const appData = decodeState<{
      appId: string;
      clientId: string;
      clientSecret: string;
      signingSecret: string;
      agentName: string;
    }>(state);
    
    console.log("Installing app:", { agentName: appData.agentName, appId: appData.appId });

    // Exchange code for bot token
    const slackClient = new WebClient();
    const response: any = await slackClient.oauth.v2.access({
      client_id: appData.clientId,
      client_secret: appData.clientSecret,
      code,
    });

    if (!response.ok) {
      console.error("OAuth exchange failed:", response.error);
      return NextResponse.redirect(new URL(`/?error=${response.error}`, request.url));
    }

    const { access_token: botToken, team, bot_user_id: botUserId } = response;

    console.log("📦 Received OAuth response:", {
      teamId: team?.id,
      teamName: team?.name,
      botUserId,
      hasBotToken: !!botToken
    });

    // Store app and installation
    const appRecordId = crypto.randomUUID();
    storage.saveApp({
      id: appRecordId,
      userId: "",
      agentName: appData.agentName,
      appId: appData.appId,
      clientId: appData.clientId,
      clientSecret: appData.clientSecret,
      signingSecret: appData.signingSecret,
      createdAt: new Date().toISOString(),
    });
    console.log("💾 Saved app:", { id: appRecordId, agentName: appData.agentName });

    const installationId = crypto.randomUUID();
    storage.saveInstallation({
      id: installationId,
      slackAppId: appRecordId,
      teamId: team?.id,
      teamName: team?.name,
      botToken,
      botUserId,
      installedAt: new Date().toISOString(),
    });
    console.log("💾 Saved installation:", { id: installationId, teamId: team?.id, teamName: team?.name });

    console.log("✅ App installed:", { agentName: appData.agentName, team: team?.name });

    return NextResponse.redirect(
      new URL(`/success?agent=${appData.agentName}&team=${team?.name}`, getBaseUrl())
    );
  } catch (error: any) {
    console.error("Error handling OAuth callback:", error);
    return NextResponse.redirect(
      new URL(`/?error=install_failed`, request.url)
    );
  }
}

