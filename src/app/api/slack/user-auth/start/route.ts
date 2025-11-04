import { NextRequest, NextResponse } from "next/server";
import { encodeState, buildOAuthUrl, getBaseUrl } from "@/lib/slack/oauth";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const agentName = searchParams.get("agentName") || "reverseAgent";
  const appName = searchParams.get("appName");

  const clientId = process.env.SLACK_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "SLACK_CLIENT_ID not configured" },
      { status: 500 }
    );
  }

  const state = encodeState({ agentName, appName });
  const redirectUri = `${getBaseUrl()}/api/slack/user-auth/callback`;

  const authUrl = buildOAuthUrl({
    clientId,
    redirectUri,
    userScope: "app_configurations:write",
    state,
  });

  return NextResponse.redirect(authUrl);
}

