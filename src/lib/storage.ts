/**
 * Simple file-based storage for local development
 * In production, use a real database
 */

import fs from "fs";
import path from "path";

const STORAGE_FILE = path.join(process.cwd(), ".slack-storage.json");

export interface UserSession {
  id: string;
  userId?: string;
  accessToken?: string;
  createdAt: string;
}

export interface SlackApp {
  id: string;
  userId: string;
  agentName: string;
  appId: string;
  clientId: string;
  clientSecret: string;
  signingSecret: string;
  createdAt: string;
}

export interface SlackInstallation {
  id: string;
  slackAppId: string;
  teamId: string;
  teamName: string;
  botToken: string;
  botUserId: string;
  installedAt: string;
}

interface StorageData {
  sessions: Record<string, UserSession>;
  apps: Record<string, SlackApp>;
  installations: Record<string, SlackInstallation>;
}

class Storage {
  private sessions: Map<string, UserSession> = new Map();
  private apps: Map<string, SlackApp> = new Map();
  private installations: Map<string, SlackInstallation> = new Map();
  private appsByAppId: Map<string, SlackApp> = new Map();
  private installationsByTeamId: Map<string, SlackInstallation> = new Map();

  constructor() {
    this.loadFromFile();
  }

  private loadFromFile(): void {
    try {
      if (fs.existsSync(STORAGE_FILE)) {
        const data: StorageData = JSON.parse(
          fs.readFileSync(STORAGE_FILE, "utf-8")
        );
        
        // Load sessions
        Object.values(data.sessions || {}).forEach((session) => {
          this.sessions.set(session.id, session);
        });

        // Load apps
        Object.values(data.apps || {}).forEach((app) => {
          this.apps.set(app.id, app);
          this.appsByAppId.set(app.appId, app);
        });

        // Load installations
        Object.values(data.installations || {}).forEach((installation) => {
          this.installations.set(installation.id, installation);
          this.installationsByTeamId.set(installation.teamId, installation);
        });

        console.log("✅ Loaded storage from file:", {
          sessions: this.sessions.size,
          apps: this.apps.size,
          installations: this.installations.size,
        });
      }
    } catch (error) {
      console.error("Error loading storage file:", error);
    }
  }

  private saveToFile(): void {
    try {
      const data: StorageData = {
        sessions: Object.fromEntries(this.sessions),
        apps: Object.fromEntries(this.apps),
        installations: Object.fromEntries(this.installations),
      };
      fs.writeFileSync(STORAGE_FILE, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error("Error saving storage file:", error);
    }
  }

  // User Sessions
  saveSession(session: UserSession): void {
    this.sessions.set(session.id, session);
    this.saveToFile();
  }

  getSession(id: string): UserSession | undefined {
    return this.sessions.get(id);
  }

  // Slack Apps
  saveApp(app: SlackApp): void {
    this.apps.set(app.id, app);
    this.appsByAppId.set(app.appId, app);
    this.saveToFile();
  }

  getApp(id: string): SlackApp | undefined {
    return this.apps.get(id);
  }

  getAppByAppId(appId: string): SlackApp | undefined {
    return this.appsByAppId.get(appId);
  }

  // Slack Installations
  saveInstallation(installation: SlackInstallation): void {
    this.installations.set(installation.id, installation);
    this.installationsByTeamId.set(installation.teamId, installation);
    this.saveToFile();
  }

  getInstallation(id: string): SlackInstallation | undefined {
    return this.installations.get(id);
  }

  getInstallationByTeamId(teamId: string): SlackInstallation | undefined {
    return this.installationsByTeamId.get(teamId);
  }

  getAppByTeamId(teamId: string): SlackApp | undefined {
    const installation = this.getInstallationByTeamId(teamId);
    if (!installation) return undefined;
    return this.getApp(installation.slackAppId);
  }

  getAllApps(): SlackApp[] {
    return Array.from(this.apps.values());
  }

  getAllInstallations(): SlackInstallation[] {
    return Array.from(this.installations.values());
  }
}

export const storage = new Storage();

