import { NextResponse } from "next/server";
import { storage } from "@/lib/storage";

export async function GET() {
  try {
    const apps = storage.getAllApps();
    const installations = storage.getAllInstallations();

    // Match apps with their installations
    const appsWithStatus = apps.map((app) => {
      const installation = installations.find((i) => i.slackAppId === app.id);
      return {
        id: app.id,
        agentName: app.agentName,
        appId: app.appId,
        hasInstallation: !!installation,
        teamName: installation?.teamName,
      };
    });

    return NextResponse.json({
      apps: appsWithStatus,
    });
  } catch (error) {
    console.error("Error fetching apps:", error);
    return NextResponse.json(
      { error: "Failed to fetch apps" },
      { status: 500 }
    );
  }
}

