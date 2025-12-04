import { WebClient } from "@slack/web-api";
import type { Mastra } from "@mastra/core/mastra";

const SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const TOOL_ICONS = ["🔄", "⚙️", "🔧", "⚡"];

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export interface StreamingOptions {
  mastra: Mastra;
  slackClient: WebClient;
  channel: string;
  threadTs: string;
  agentName: string;
  message: string;
  resourceId: string;
  threadId: string;
}

type Status = "thinking" | "tool_call" | "responding";

interface State {
  text: string;
  status: Status;
  toolName?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Convert kebab-case/snake_case to Title Case */
const formatToolName = (id: string) =>
  id
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");

/** Get animated status text for Slack message */
function getStatusText(state: State, frame: number): string {
  const spinner = SPINNER[frame % SPINNER.length];
  const toolIcon = TOOL_ICONS[frame % TOOL_ICONS.length];

  switch (state.status) {
    case "thinking":
      return `${spinner} Thinking...`;
    case "tool_call":
      return `${toolIcon} Using ${state.toolName}...`;
    case "responding":
      return `${spinner} Responding...`;
  }
}

/** Build a map from internal tool names (_0, _1) to actual tool IDs */
async function buildToolMap(
  mastra: Mastra,
  agentName: string
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  try {
    const agent = mastra.getAgent(agentName);
    const tools = await agent?.getTools();
    if (tools) {
      Object.entries(tools).forEach(([key, tool], index) => {
        // Map _0, _1, etc. to the actual tool ID
        const toolId = (tool as any).id || (tool as any).name || key;
        map.set(`_${index}`, toolId);
      });
    }
  } catch (e) {
    console.error("Error building tool map:", e);
  }
  return map;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Stream a response from Mastra agent to Slack with live status updates
 */
export async function streamToSlack(options: StreamingOptions): Promise<void> {
  const {
    mastra,
    slackClient,
    channel,
    threadTs,
    agentName,
    message,
    resourceId,
    threadId,
  } = options;

  const state: State = { text: "", status: "thinking" };
  const toolMap = await buildToolMap(mastra, agentName);

  let messageTs: string | undefined;
  let frame = 0;
  let animationTimer: NodeJS.Timeout | undefined;

  // Update Slack message with current status
  const updateMessage = async () => {
    if (!messageTs) return;
    try {
      await slackClient.chat.update({
        channel,
        ts: messageTs,
        text: getStatusText(state, frame),
      });
    } catch {
      // Ignore update errors
    }
  };

  try {
    // Post initial message
    const initial = await slackClient.chat.postMessage({
      channel,
      thread_ts: threadTs,
      text: getStatusText(state, 0),
    });
    messageTs = initial.ts as string;

    // Start animation loop
    animationTimer = setInterval(() => {
      frame++;
      updateMessage();
    }, 300);

    // Get agent and stream
    const agent = mastra.getAgent(agentName);
    if (!agent) {
      throw new Error(`Agent "${agentName}" not found`);
    }

    const result = await agent.stream(message, {
      resourceId,
      threadId,
      onChunk: (chunk) => {
        // Handle tool calls
        if (chunk.type === "tool-call") {
          const internalName = (chunk as any).payload?.toolName || "tool";
          // Map internal name (_0) to actual tool ID (reverse-text)
          const toolId = toolMap.get(internalName) || internalName;
          state.status = "tool_call";
          state.toolName = formatToolName(toolId);
          console.log(`🔧 Tool call: ${state.toolName}`);
        } else if (chunk.type === "tool-result") {
          state.status = "responding";
        }
      },
    });

    // Process the text stream
    for await (const chunk of result.textStream) {
      if (chunk) {
        state.text += chunk;
        state.status = "responding";
      }
    }

    // Stop animation
    clearInterval(animationTimer);

    // Send final response
    await slackClient.chat.update({
      channel,
      ts: messageTs,
      text: state.text || "Sorry, I couldn't generate a response.",
    });

    console.log("✅ Response sent to Slack");
  } catch (error) {
    console.error("❌ Error streaming to Slack:", error);

    if (animationTimer) clearInterval(animationTimer);

    // Format error message for Slack
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorText = `❌ Error: ${errorMessage}`;

    if (messageTs) {
      await slackClient.chat
        .update({
          channel,
          ts: messageTs,
          text: errorText,
        })
        .catch(() => {});
    } else {
      // If we never got a message posted, post the error as a new message
      await slackClient.chat
        .postMessage({
          channel,
          thread_ts: threadTs,
          text: errorText,
        })
        .catch(() => {});
    }

    throw error;
  }
}
