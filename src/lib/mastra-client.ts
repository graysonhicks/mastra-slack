/**
 * Client for interacting with Mastra API
 */

const MASTRA_API_URL = process.env.MASTRA_API_URL || "http://localhost:4111";

export interface AgentInfo {
  name: string;
  description: string;
  instructions: string;
  model: string;
}

export interface SendMessageParams {
  message: string;
  agentName: string;
  resource: string; // Unique identifier for user/entity
  thread: string; // Unique identifier for conversation thread
}

export interface SendMessageResponse {
  text: string;
}

/**
 * Get information about a specific agent
 */
export async function getAgentInfo(agentName: string): Promise<AgentInfo> {
  try {
    // For demo purposes, we'll fetch from the local Mastra instance
    // In production, this would call Mastra Cloud API
    const response = await fetch(`${MASTRA_API_URL}/api/agents/${agentName}`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch agent info: ${response.statusText}`);
    }
    
    const data = await response.json();
    return {
      name: data.name || agentName,
      description: data.description || "AI Assistant",
      instructions: data.instructions || "AI Assistant",
      model: data.model || "openai/gpt-4o-mini",
    };
  } catch (error) {
    console.error("Error fetching agent info:", error);
    // Fallback for demo
    return {
      name: agentName,
      description: "AI Assistant powered by Mastra",
      instructions: "AI Assistant powered by Mastra",
      model: "openai/gpt-4o-mini",
    };
  }
}

/**
 * Send a message to a Mastra agent
 */
export async function sendToAgent(
  params: SendMessageParams
): Promise<SendMessageResponse> {
  try {
    const response = await fetch(
      `${MASTRA_API_URL}/api/agents/${params.agentName}/generate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: params.message }],
          memory: {
            resource: params.resource,
            thread: params.thread,
          },
        }),
      }
    );

    if (!response.ok) {
      throw new Error(`Failed to send message: ${response.statusText}`);
    }

    const data = await response.json();
    return {
      text: data.text || data.response || "No response from agent",
    };
  } catch (error) {
    console.error("Error sending message to agent:", error);
    throw error;
  }
}

