/**
 * Utility functions for Slack OAuth flows
 */

export function encodeState<T extends Record<string, any>>(data: T): string {
  return Buffer.from(JSON.stringify(data)).toString("base64");
}

export function decodeState<T = Record<string, any>>(state: string): T {
  return JSON.parse(Buffer.from(state, "base64").toString());
}

export function getBaseUrl(): string {
  return process.env.SLACK_REDIRECT_URL || "http://localhost:3000";
}

export function buildOAuthUrl(params: {
  clientId: string;
  redirectUri: string;
  scope?: string;
  userScope?: string;
  state: string;
}): string {
  const url = new URL("https://slack.com/oauth/v2/authorize");
  url.searchParams.set("client_id", params.clientId);
  url.searchParams.set("redirect_uri", params.redirectUri);
  url.searchParams.set("state", params.state);
  
  if (params.scope) {
    url.searchParams.set("scope", params.scope);
  }
  if (params.userScope) {
    url.searchParams.set("user_scope", params.userScope);
  }
  
  return url.toString();
}

