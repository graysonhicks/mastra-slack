import { Mastra } from "@mastra/core/mastra";
import { LibSQLStore } from "@mastra/libsql";
import { reverseAgent } from "./agents/reverse-agent";
import { capsAgent } from "./agents/caps-agent";
import { numbersAgent } from "./agents/numbers-agent";

export const mastra = new Mastra({
  agents: { reverseAgent, capsAgent, numbersAgent },
  storage: new LibSQLStore({
    url: "file:./mastra.db", // Persists to disk
  }),
});

