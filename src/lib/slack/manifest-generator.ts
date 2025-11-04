import { AgentInfo } from "../mastra-client";

/**
 * Generate a Slack app manifest dynamically based on agent info
 */
export function generateSlackAppManifest(
  agentInfo: AgentInfo,
  webhookBaseUrl: string
) {
  // Short description: ~10 words max
  const shortDescription = agentInfo.description || "AI Assistant powered by Mastra";
  
  // Long description: must be at least 175 characters per Slack requirements
  // Use instructions if available (includes examples), otherwise pad description
  let longDescription = agentInfo.instructions || agentInfo.description || "AI Assistant powered by Mastra";
  
  // Ensure minimum length of 175 characters
  if (longDescription.length < 175) {
    longDescription = `${agentInfo.description || "AI Assistant"} - This bot is powered by Mastra, an AI agent framework. It uses advanced language models to process your messages and provide intelligent responses. The bot maintains conversation context and can handle complex interactions while staying focused on its specific capabilities.`;
  }

  return {
    display_information: {
      name: agentInfo.name,
      description: shortDescription,
      long_description: longDescription,
      background_color: "#2563eb",
    },
    features: {
      app_home: {
        home_tab_enabled: false,
        messages_tab_enabled: true,
        messages_tab_read_only_enabled: false,
      },
      bot_user: {
        display_name: agentInfo.name,
        always_online: true,
      },
    },
    oauth_config: {
      redirect_urls: [`${webhookBaseUrl}/api/slack/oauth/callback`],
      scopes: {
        bot: [
          "chat:write",
          "app_mentions:read",
          "channels:history",
          "im:history",
        ],
      },
    },
    settings: {
      event_subscriptions: {
        request_url: `${webhookBaseUrl}/api/slack/events`,
        bot_events: ["app_mention", "message.im"],
      },
      interactivity: {
        is_enabled: false,
      },
      org_deploy_enabled: false,
      socket_mode_enabled: false,
    },
  };
}

