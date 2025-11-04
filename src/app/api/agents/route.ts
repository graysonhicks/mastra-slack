import { NextResponse } from "next/server";

const MASTRA_API_URL = process.env.MASTRA_API_URL || "http://localhost:4111";

// Manual description mapping since Mastra API doesn't expose description field yet
const descriptionMap: Record<string, string> = {
  reverseAgent: "Reverses text character by character",
  capsAgent: "Converts text to ALL CAPS",
  numbersAgent: "Converts letters to numbers (a=1, b=2, etc.)",
};

export async function GET() {
  try {
    // Fetch all agents from Mastra API
    const response = await fetch(`${MASTRA_API_URL}/api/agents`);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch agents: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // The Mastra API returns agents directly, not nested under "agents" key
    const agentsData = data.agents || data;
    
    // Transform the response to match our UI needs
    const agents = Object.entries(agentsData).map(([key, agent]: [string, any]) => ({
      name: key,
      displayName: agent.name || key,
      description: descriptionMap[key] || agent.instructions || "No description available",
      instructions: agent.instructions || "",
      model: agent.model || "unknown",
    }));

    return NextResponse.json({
      agents,
    });
  } catch (error) {
    console.error("Error fetching agents from Mastra:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch agents from Mastra API",
        message: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
}
