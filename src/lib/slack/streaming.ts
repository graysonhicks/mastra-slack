import { WebClient } from "@slack/web-api";

const MASTRA_API_URL = process.env.MASTRA_API_URL || "http://localhost:4111";

// Loading animation frames (Braille spinner)
const LOADING_EMOJIS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
const WORKFLOW_EMOJIS = ["🔄", "⚙️", "🔧", "⚡"];

export interface StreamingOptions {
  slackClient: WebClient;
  channel: string;
  threadTs: string;
  agentName: string;
  message: string;
  resource: string;
  thread: string;
  updateInterval?: number; // milliseconds between updates
  showWorkflowStatus?: boolean; // Show "thinking", "using tools", etc.
  streamPartialText?: boolean; // Stream partial text as it arrives (default: false)
}

export interface WorkflowStep {
  status: "thinking" | "tool_call" | "responding";
  toolName?: string;
}

/**
 * Fetch agent metadata to get tool definitions with their real IDs
 */
async function fetchAgentTools(agentName: string): Promise<Map<string, string>> {
  const toolMap = new Map<string, string>();
  
  try {
    console.log(`🔍 Fetching tools for agent: ${agentName} from ${MASTRA_API_URL}/api/agents/${agentName}`);
    const response = await fetch(`${MASTRA_API_URL}/api/agents/${agentName}`);
    
    console.log(`📡 Agent API response status: ${response.status}`);
    
    if (response.ok) {
      const agentData = await response.json();
      console.log(`📋 Agent data received:`, JSON.stringify(agentData, null, 2));
      
      // Extract tool IDs - tools is an object with numeric keys, not an array
      if (agentData.tools && typeof agentData.tools === 'object') {
        const toolKeys = Object.keys(agentData.tools);
        console.log(`🔧 Found ${toolKeys.length} tools in agent data`);
        
        toolKeys.forEach((key) => {
          const tool = agentData.tools[key];
          const toolId = tool.id || tool.name;
          const internalName = `_${key}`;
          if (toolId) {
            toolMap.set(internalName, toolId);
            console.log(`📋 Pre-registered tool: ${internalName} -> "${toolId}"`);
          }
        });
      } else {
        console.log(`⚠️ No tools object found in agent data`);
      }
    } else {
      console.log(`❌ Failed to fetch agent: ${response.statusText}`);
    }
  } catch (error) {
    console.error("❌ Error fetching agent tools:", error);
  }
  
  console.log(`✅ Tool ID map has ${toolMap.size} entries:`, Array.from(toolMap.entries()));
  return toolMap;
}

/**
 * Format tool name for display
 */
function formatToolName(toolId: string): string {
  // Convert kebab-case and snake_case to Title Case
  return toolId
    .split(/[-_]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

/**
 * Stream a response from Mastra to Slack with live updates
 * 
 * This function will:
 * 1. Post an initial "Thinking..." message
 * 2. Update it to show tool usage (e.g., "Using reverse-text...")
 * 3. Optionally show partial response as it streams in (if streamPartialText is true)
 * 4. Finalize with the complete response
 * 
 * All updates happen on the SAME Slack message.
 * 
 * @param streamPartialText - If true, shows partial text ("PL", "PLZ", "PLZ WORK"). 
 *                            If false (default), only shows status until final response.
 */
export async function streamToSlack(options: StreamingOptions): Promise<void> {
  const {
    slackClient,
    channel,
    threadTs,
    agentName,
    message,
    resource,
    thread,
    updateInterval = 300,
    showWorkflowStatus = true,
    streamPartialText = false,
  } = options;

  let messageTs: string | undefined;
  let accumulatedText = "";
  let loadingIndex = 0;
  let workflowStep: WorkflowStep = { status: "thinking" };
  let animationInterval: NodeJS.Timeout | undefined;
  
  // Fetch agent tools to get real tool IDs (e.g., "all-caps")
  const toolIdMap = await fetchAgentTools(agentName);
  const toolDescriptions = new Map<string, string>();

  // Helper to update the Slack message with current status
  const updateSlackMessage = async () => {
    if (!messageTs) return;

    let displayText = "";
    
    if (showWorkflowStatus) {
      // Show workflow status with animation
      if (workflowStep.status === "thinking") {
        displayText = `${LOADING_EMOJIS[loadingIndex]} Thinking...`;
      } else if (workflowStep.status === "tool_call") {
        // Show the tool description or name
        displayText = `${WORKFLOW_EMOJIS[loadingIndex % WORKFLOW_EMOJIS.length]} Calling tool: ${workflowStep.toolName}...`;
      } else if (workflowStep.status === "responding") {
        // If streaming partial text, show it. Otherwise, just show "Responding..."
        if (streamPartialText && accumulatedText) {
          displayText = `${LOADING_EMOJIS[loadingIndex]} ${accumulatedText}...`;
        } else {
          displayText = `${LOADING_EMOJIS[loadingIndex]} Responding...`;
        }
      }
    } else {
      // Just show accumulated text with spinner (or generic message)
      if (streamPartialText && accumulatedText) {
        displayText = `${LOADING_EMOJIS[loadingIndex]} ${accumulatedText}...`;
      } else {
        displayText = `${LOADING_EMOJIS[loadingIndex]} Thinking...`;
      }
    }

    if (displayText) {
      try {
        await slackClient.chat.update({
          channel,
          ts: messageTs,
          text: displayText,
        });
      } catch (error) {
        console.error("Error updating Slack message:", error);
      }
    }
  };

  try {
    // 1. Post initial "thinking" message
    const initialMessage = await slackClient.chat.postMessage({
      channel,
      text: `${LOADING_EMOJIS[0]} Thinking...`,
      thread_ts: threadTs,
    });
    messageTs = initialMessage.ts as string;

    console.log("📝 Posted initial thinking message:", messageTs);

    // Start continuous animation loop
    animationInterval = setInterval(() => {
      loadingIndex = (loadingIndex + 1) % LOADING_EMOJIS.length;
      updateSlackMessage();
    }, updateInterval);

    console.log(`🎬 Started animation loop (updating every ${updateInterval}ms)`);

    // 2. Start streaming from Mastra
    const response = await fetch(
      `${MASTRA_API_URL}/api/agents/${agentName}/stream`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: message }],
          memory: { resource, thread },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to stream: ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No reader available");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    console.log("🌊 Starting to process stream...");

    // 3. Process stream
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        console.log("✅ Stream complete");
        break;
      }

      const chunk = decoder.decode(value, { stream: true });
      console.log("📦 Raw chunk received:", chunk.substring(0, 200)); // Log first 200 chars
      
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      console.log(`📝 Processing ${lines.length} lines from buffer`);

      for (const line of lines) {
        console.log("🔍 Processing line:", line.substring(0, 100)); // Log first 100 chars
        
        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          console.log("📊 Data extracted:", data);
          
          if (data === "[DONE]") {
            console.log("🏁 [DONE] marker received");
            continue;
          }

            try {
            const parsed = JSON.parse(data);

            // Extract tool descriptions from step-start events
            if (parsed.type === "step-start" && parsed.payload?.request?.body?.tools) {
              const tools = parsed.payload.request.body.tools;
              for (const tool of tools) {
                if (tool.name && tool.description) {
                  toolDescriptions.set(tool.name, tool.description);
                  console.log(`📝 Registered tool: ${tool.name} = "${tool.description}"`);
                }
              }
            }

            // Track workflow steps for status display
            if (parsed.type === "tool-call" || parsed.type === "tool_call_start" || parsed.type === "tool-call-start") {
              const rawToolName = parsed.payload?.toolName || parsed.tool_name || parsed.toolName || "tool";
              
              // Priority: tool ID from agent metadata > description from stream > raw name
              let displayName = rawToolName;
              if (toolIdMap.has(rawToolName)) {
                // Use the real tool ID (e.g., "all-caps")
                displayName = formatToolName(toolIdMap.get(rawToolName)!);
              } else if (toolDescriptions.has(rawToolName)) {
                // Fallback to description
                displayName = toolDescriptions.get(rawToolName)!;
              }
              
              workflowStep = {
                status: "tool_call",
                toolName: displayName,
              };
              console.log(`🔧 Tool call started: ${rawToolName} (displayed as: "${displayName}")`);
            } else if (parsed.type === "tool-call-end" || parsed.type === "tool-result") {
              workflowStep = { status: "responding" };
              console.log(`✅ Tool call completed`);
            } else if (parsed.type === "text-delta" || parsed.type === "text" || parsed.type === "content") {
              // Mastra sends text in payload.text for text-delta events
              const textChunk = parsed.payload?.text || parsed.text || parsed.content || "";
              if (textChunk) {
                accumulatedText += textChunk;
                workflowStep = { status: "responding" };
                console.log(`📝 Text chunk added (${textChunk.length} chars): "${textChunk.substring(0, 50)}"`);
                console.log(`📊 Total accumulated: ${accumulatedText.length} chars`);
              }
            } else if (parsed.type === "text-start" || parsed.type === "text-end" || 
                       parsed.type === "step-start" || parsed.type === "step-finish" ||
                       parsed.type === "finish" || parsed.type === "tool-call-delta" ||
                       parsed.type === "tool-call-input-streaming-end") {
              // These are metadata events we can ignore
              console.log(`ℹ️ Metadata event: ${parsed.type}`);
            } else {
              console.log("⚠️ Unknown parsed format:", parsed);
            }
          } catch (e) {
            console.warn("❌ Invalid JSON in stream:", data, "Error:", e);
          }
        } else if (line.trim()) {
          console.log("⚠️ Line doesn't start with 'data: ':", line.substring(0, 100));
        }
      }
    }

    // Stop animation loop
    if (animationInterval) {
      clearInterval(animationInterval);
      console.log("🛑 Stopped animation loop");
    }

    // 5. Final update with complete response (no spinner)
    if (accumulatedText) {
      await slackClient.chat.update({
        channel,
        ts: messageTs,
        text: accumulatedText,
      });
      console.log("✅ Final message updated with complete response");
    } else {
      await slackClient.chat.update({
        channel,
        ts: messageTs,
        text: "Sorry, I couldn't generate a response.",
      });
      console.log("⚠️ No accumulated text, posted fallback message");
    }
  } catch (error) {
    console.error("❌ Error streaming to Slack:", error);
    
    // Stop animation loop
    if (animationInterval) {
      clearInterval(animationInterval);
    }
    
    if (messageTs) {
      try {
        await slackClient.chat.update({
          channel,
          ts: messageTs,
          text: "❌ Sorry, I encountered an error processing your request.",
        });
      } catch (updateError) {
        console.error("Failed to update error message:", updateError);
      }
    }
    throw error;
  }
}

