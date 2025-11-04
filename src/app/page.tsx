"use client";

import { useState, useEffect } from "react";

interface Agent {
  name: string;
  displayName: string;
  description: string;
  installed: boolean;
  appId?: string;
}

export default function Home() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch both agents from Mastra and installed apps from storage
    Promise.all([
      fetch("/api/agents").then((res) => res.json()),
      fetch("/api/slack/apps").then((res) => res.json()),
    ])
      .then(([agentsData, appsData]) => {
        // Check if there was an error fetching agents
        if (agentsData.error) {
          setError(`Failed to connect to Mastra API: ${agentsData.message || agentsData.error}`);
          setLoading(false);
          return;
        }

        const mastraAgents = agentsData.agents || [];
        const installedApps = appsData.apps || [];

        // Transform Mastra agents to our UI format
        const availableAgents: Agent[] = mastraAgents.map((agent: any) => {
          // Find if this agent has an installed app
          const installedApp = installedApps.find(
            (app: any) => app.agentName === agent.name && app.hasInstallation
          );

          return {
            name: agent.name,
            displayName: agent.displayName || agent.name,
            description: agent.description || "No description available",
            installed: !!installedApp,
            appId: installedApp?.appId,
          };
        });

        setAgents(availableAgents);
        setLoading(false);
      })
      .catch((error) => {
        console.error("Error fetching data:", error);
        setError("Failed to load agents. Make sure your Mastra server is running on http://localhost:4111");
        setLoading(false);
      });
  }, []);

  const handleInstall = (agentName: string) => {
    // Redirect to OAuth flow
    const params = new URLSearchParams({
      agentName,
    });
    window.location.href = `/api/slack/user-auth/start?${params}`;
  };

  return (
    <div className="container">
      <h1>🤖 Slack + Mastra Demo</h1>
      <p style={{ color: "white", fontSize: "1.2rem", marginBottom: "2rem" }}>
        Create a Slack app powered by your Mastra agent
      </p>

      <div className="card">
        <h2>Available Agents</h2>
        <p style={{ marginBottom: "1.5rem" }}>
          Install Slack apps for your Mastra agents. Each agent becomes a separate bot in your workspace.
        </p>

        {loading ? (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <p>Loading agents...</p>
          </div>
        ) : error ? (
          <div style={{
            padding: "2rem",
            textAlign: "center",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            borderRadius: "6px",
            color: "#991b1b",
          }}>
            <p style={{ fontWeight: 600, marginBottom: "0.5rem" }}>⚠️ Error Loading Agents</p>
            <p style={{ fontSize: "0.875rem" }}>{error}</p>
            <button
              onClick={() => window.location.reload()}
              style={{
                marginTop: "1rem",
                padding: "0.5rem 1rem",
                backgroundColor: "#dc2626",
                color: "white",
                border: "none",
                borderRadius: "6px",
                cursor: "pointer",
                fontSize: "0.875rem",
              }}
            >
              Retry
            </button>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{
              width: "100%",
              borderCollapse: "collapse",
              border: "1px solid #e5e7eb",
            }}>
              <thead>
                <tr style={{ backgroundColor: "#f9fafb" }}>
                  <th style={{
                    padding: "0.75rem",
                    textAlign: "left",
                    borderBottom: "2px solid #e5e7eb",
                    fontWeight: 600,
                  }}>Agent</th>
                  <th style={{
                    padding: "0.75rem",
                    textAlign: "left",
                    borderBottom: "2px solid #e5e7eb",
                    fontWeight: 600,
                  }}>Description</th>
                  <th style={{
                    padding: "0.75rem",
                    textAlign: "center",
                    borderBottom: "2px solid #e5e7eb",
                    fontWeight: 600,
                  }}>Status</th>
                  <th style={{
                    padding: "0.75rem",
                    textAlign: "center",
                    borderBottom: "2px solid #e5e7eb",
                    fontWeight: 600,
                  }}>Slack App ID</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.name} style={{ borderBottom: "1px solid #e5e7eb" }}>
                    <td style={{ padding: "1rem" }}>
                      <strong>{agent.displayName}</strong>
                      <br />
                      <code style={{
                        fontSize: "0.875rem",
                        color: "#6b7280",
                        backgroundColor: "#f3f4f6",
                        padding: "0.125rem 0.375rem",
                        borderRadius: "3px",
                      }}>{agent.name}</code>
                    </td>
                    <td style={{ padding: "1rem", color: "#4b5563" }}>
                      {agent.description}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "center" }}>
                      {agent.installed ? (
                        <span style={{
                          display: "inline-block",
                          padding: "0.25rem 0.75rem",
                          backgroundColor: "#d1fae5",
                          color: "#065f46",
                          borderRadius: "9999px",
                          fontSize: "0.875rem",
                          fontWeight: 500,
                        }}>
                          ✓ Installed
                        </span>
                      ) : (
                        <span style={{
                          display: "inline-block",
                          padding: "0.25rem 0.75rem",
                          backgroundColor: "#f3f4f6",
                          color: "#6b7280",
                          borderRadius: "9999px",
                          fontSize: "0.875rem",
                        }}>
                          Not installed
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "1rem", textAlign: "center" }}>
                      {agent.installed ? (
                        <code style={{
                          fontSize: "0.875rem",
                          color: "#4b5563",
                          backgroundColor: "#f3f4f6",
                          padding: "0.25rem 0.5rem",
                          borderRadius: "4px",
                        }}>
                          {agent.appId}
                        </code>
                      ) : (
                        <button
                          onClick={() => handleInstall(agent.name)}
                          style={{
                            backgroundColor: "#2563eb",
                            color: "white",
                            border: "none",
                            padding: "0.5rem 1rem",
                            borderRadius: "6px",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.5rem",
                          }}
                        >
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="currentColor"
                          >
                            <path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z" />
                          </svg>
                          Install to Slack
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        <div style={{ 
          marginTop: "1rem", 
          padding: "0.75rem", 
          backgroundColor: "#f0f9ff", 
          borderRadius: "6px",
          fontSize: "0.875rem",
          color: "#0369a1"
        }}>
          💡 <strong>Note:</strong> Make sure your Mastra agent server is running on <code>http://localhost:4111</code> before installing apps.
        </div>
      </div>

      <div className="card">
        <h2>🏗️ How It Works</h2>
        
        <h3 style={{ fontSize: "1.2rem", marginTop: "1rem", marginBottom: "0.5rem" }}>Architecture</h3>
        <ol style={{ marginBottom: "1.5rem" }}>
          <li><strong>One app per agent:</strong> Each Mastra agent gets its own Slack app with unique credentials</li>
          <li><strong>Dynamic creation:</strong> Slack App Manifest API creates apps programmatically using user OAuth token</li>
          <li><strong>Event routing:</strong> Incoming Slack events lookup the agent by team ID, then forward to Mastra</li>
          <li><strong>Memory per thread:</strong> Each Slack thread maintains separate conversation context via Mastra Memory</li>
        </ol>

        <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>OAuth & Installation Flow</h3>
        <div style={{ 
          backgroundColor: "#f9fafb", 
          padding: "1rem", 
          borderRadius: "6px",
          fontSize: "0.875rem",
          fontFamily: "monospace",
          marginBottom: "1rem",
          lineHeight: "1.8"
        }}>
          <div><strong>Step 1: User Authorization (Parent App)</strong></div>
          <div>→ Redirect to Slack OAuth with <code>app_configurations:write</code></div>
          <div>→ User authorizes base Mastra app</div>
          <div>→ Receive user access token</div>
          <div></div>
          <div><strong>Step 2: App Creation</strong></div>
          <div>→ Call <code>apps.manifest.create</code> with user token</div>
          <div>→ Pass agent info to generate manifest dynamically</div>
          <div>→ Slack returns new app credentials (client_id, secret, signing_secret)</div>
          <div>→ Store app credentials with agent mapping in DB</div>
          <div></div>
          <div><strong>Step 3: App Installation (Child App)</strong></div>
          <div>→ Redirect to install the newly created app</div>
          <div>→ User installs agent app to workspace</div>
          <div>→ Receive bot token for posting messages</div>
          <div>→ Store installation with team_id → app_id mapping</div>
        </div>

        <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Storage Schema</h3>
        <div style={{ 
          backgroundColor: "#f9fafb", 
          padding: "1rem", 
          borderRadius: "6px",
          fontSize: "0.875rem",
          fontFamily: "monospace",
          marginBottom: "1rem",
          lineHeight: "1.8"
        }}>
          <div><strong>Apps Table:</strong> Stores created Slack apps</div>
          <div>• id, userId, agentName, appId, clientId, clientSecret, signingSecret</div>
          <div></div>
          <div><strong>Installations Table:</strong> Tracks workspace installs</div>
          <div>• id, slackAppId (FK), teamId, teamName, botToken, botUserId</div>
          <div></div>
          <div><strong>Lookup:</strong> teamId → installation → app → agentName</div>
          <div style={{ marginTop: "0.5rem", color: "#6b7280" }}>
            (Demo uses JSON file, production would use PostgreSQL/MySQL/etc)
          </div>
        </div>

        <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Message Flow</h3>
        <div style={{ 
          backgroundColor: "#f9fafb", 
          padding: "1rem", 
          borderRadius: "6px",
          fontSize: "0.875rem",
          fontFamily: "monospace",
          marginBottom: "1rem",
          lineHeight: "1.8"
        }}>
          <div>1. User messages bot in Slack</div>
          <div>2. Slack webhook → <code>/api/slack/events</code></div>
          <div>3. Verify signature with <code>signing_secret</code></div>
          <div>4. Lookup: <code>team_id</code> → installation → app → agent</div>
          <div>5. Call <code>agent.generate()</code> with message + memory context</div>
          <div>6. Post response to Slack via <code>chat.postMessage</code> with <code>bot_token</code></div>
        </div>

        <h3 style={{ fontSize: "1.2rem", marginBottom: "0.5rem" }}>Key Files</h3>
        <ul>
          <li><code>/api/slack/user-auth/*</code> - OAuth flow to get user token for app creation</li>
          <li><code>/api/slack/oauth/callback</code> - Handle child app installation and store bot token</li>
          <li><code>/api/slack/events</code> - Webhook handler for incoming messages with routing logic</li>
          <li><code>src/lib/storage.ts</code> - Storage abstraction (swap file for DB in production)</li>
          <li><code>src/lib/slack/verify.ts</code> - Signature verification for webhook security</li>
          <li><code>src/mastra/agents/*</code> - Agent definitions with tools and memory config</li>
        </ul>
      </div>
    </div>
  );
}

