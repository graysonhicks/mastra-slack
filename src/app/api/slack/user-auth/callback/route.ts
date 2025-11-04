import { NextRequest, NextResponse } from "next/server";
import { WebClient } from "@slack/web-api";
import { storage } from "@/lib/storage";
import { getAgentInfo } from "@/lib/mastra-client";
import { generateSlackAppManifest } from "@/lib/slack/manifest-generator";
import { decodeState, encodeState, getBaseUrl } from "@/lib/slack/oauth";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const error = searchParams.get("error");

    if (error) {
      return NextResponse.redirect(new URL(`/?error=${error}`, request.url));
    }

    if (!code || !state) {
      return NextResponse.redirect(new URL("/?error=missing_params", request.url));
    }

    // Decode agent data from state parameter
    const { agentName = "reverseAgent", appName } = decodeState<{
      agentName?: string;
      appName?: string;
    }>(state);

    console.log("Decoded state:", { agentName, appName });

    // Exchange code for user token
    const slackClient = new WebClient();
    const tokenResponse: any = await slackClient.oauth.v2.access({
      client_id: process.env.SLACK_CLIENT_ID!,
      client_secret: process.env.SLACK_CLIENT_SECRET!,
      code: code,
    });

    if (!tokenResponse.ok) {
      return NextResponse.redirect(
        new URL(`/?error=${tokenResponse.error}`, request.url)
      );
    }

    const userToken = tokenResponse.authed_user.access_token;
    const userId = tokenResponse.authed_user.id;

    // Create the app using their token
    const agentInfo = await getAgentInfo(agentName);
    const manifest = generateSlackAppManifest(agentInfo, getBaseUrl());
    
    // Override name if user provided one
    if (appName) {
      manifest.display_information.name = appName;
      manifest.features.bot_user.display_name = appName;
    }

    // Create the Slack app
    const userSlackClient = new WebClient(userToken);
    const createResponse: any = await userSlackClient.apps.manifest.create({
      manifest: manifest as any,
    });

    if (!createResponse.ok || !createResponse.credentials || !createResponse.app_id) {
      console.error("Manifest creation failed:", createResponse);
      return NextResponse.redirect(
        new URL(`/?error=app_creation_failed`, request.url)
      );
    }

    const { app_id: appId, credentials, team_domain } = createResponse;
    console.log("✅ Slack app created:", { appId, teamDomain: team_domain });

    // Store the app
    storage.saveApp({
      id: crypto.randomUUID(),
      userId,
      agentName,
      appId,
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      signingSecret: credentials.signing_secret,
      createdAt: new Date().toISOString(),
    });

    // Encode app credentials in state for installation
    const installState = encodeState({
      appId,
      clientId: credentials.client_id,
      clientSecret: credentials.client_secret,
      signingSecret: credentials.signing_secret,
      agentName,
    });

    // Build installation URL
    const installUrl = createResponse.oauth_authorize_url
      ? `${createResponse.oauth_authorize_url}&state=${installState}`
      : `https://slack.com/oauth/v2/authorize?client_id=${credentials.client_id}&scope=chat:write,app_mentions:read,channels:history,im:history&state=${installState}`;

    return NextResponse.redirect(installUrl);
  } catch (error: any) {
    console.error("Error in user auth callback:", error);
    if (error.data) {
      console.error("Error details:", JSON.stringify(error.data, null, 2));
    }
    return NextResponse.redirect(
      new URL(`/?error=callback_failed`, request.url)
    );
  }
}

