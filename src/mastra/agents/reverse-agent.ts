import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { createTool } from "@mastra/core/tools";
import { z } from "zod";

const reverseTextTool = createTool({
  id: "reverse-text",
  description: "Reverses a text string character by character",
  inputSchema: z.object({
    text: z.string().describe("The text to reverse"),
  }),
  execute: async ({ context }) => {
    return context.text.split("").reverse().join("");
  },
});

export const reverseAgent = new Agent({
  name: "reverse-agent",
  description: "Reverses text character by character",
  instructions: `You are a text reversal agent. When the user sends you text, use the reverse-text tool to reverse it, then return ONLY the reversed text with no extra commentary.

Examples:
- User: "hello" → You: "olleh"
- User: "Hello World!" → You: "!dlroW olleH"
- User: "12345" → You: "54321"`,
  model: "openai/gpt-4o-mini",
  tools: [reverseTextTool],
  memory: new Memory({
    options: {
      lastMessages: 20, // Keep last 20 messages in context
    },
  }),
});

