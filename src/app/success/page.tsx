"use client";

import { useSearchParams } from "next/navigation";

export default function Success() {
  const searchParams = useSearchParams();
  const agentName = searchParams.get("agent");

  return (
    <div className="container">
      <h1>✅ Success!</h1>

      <div className="card">
        <h2>Your Slack App is Connected</h2>
        <div className="alert alert-success">
          <p>
            <strong>Agent:</strong> {agentName || "Unknown"}
          </p>
          <p>
            Your Slack app has been successfully connected to your Mastra agent.
          </p>
        </div>

        <h3>🎉 What&apos;s Next?</h3>
        <ol>
          <li>Go to your Slack workspace</li>
          <li>Find your bot in the Apps section</li>
          <li>Send it a message</li>
          <li>Watch it respond using your Mastra agent!</li>
        </ol>

        <button
          className="button"
          onClick={() => (window.location.href = "/")}
          style={{ marginTop: "1rem" }}
        >
          ← Back to Home
        </button>
      </div>
    </div>
  );
}

