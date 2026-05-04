import * as fs from "node:fs";
import * as path from "node:path";
import { app } from "electron";
import * as crypto from "node:crypto";

export const GlobalStats = {
  globalSavingsMB: 0,
  dailySavingsMB: 0,
  lastResetDate: "",
  isPro: false,
  hasSeenTrialEnd: false,
  hasSeenDailyLimit: false,
  clientId: "",
};

export function loadStats() {
  const statsPath = path.join(
    app.getPath("userData"),
    "shrinkwizard_stats.json",
  );
  try {
    if (fs.existsSync(statsPath)) {
      const data = fs.readFileSync(statsPath, "utf8");
      const parsed = JSON.parse(data);
      Object.assign(GlobalStats, parsed);

      // Migrate old hasSeen5GBLimit to hasSeenTrialEnd if necessary
      if (parsed.hasSeen5GBLimit && parsed.hasSeenTrialEnd === undefined) {
        GlobalStats.hasSeenTrialEnd = true;
      }
    }

    // Daily reset logic
    const today = new Date().toISOString().split("T")[0];
    if (GlobalStats.lastResetDate !== today) {
      GlobalStats.dailySavingsMB = 0;
      GlobalStats.hasSeenDailyLimit = false;
      GlobalStats.lastResetDate = today;
    }

    // Generate an anonymous client ID for analytics if it doesn't exist
    if (!GlobalStats.clientId) {
      GlobalStats.clientId = crypto.randomUUID();
    }

    fs.writeFileSync(statsPath, JSON.stringify(GlobalStats));
  } catch (err) {
    console.error("Failed to load stats", err);
  }
}

export function saveStats(addMB: number) {
  const statsPath = path.join(
    app.getPath("userData"),
    "shrinkwizard_stats.json",
  );
  GlobalStats.globalSavingsMB += addMB;
  GlobalStats.dailySavingsMB += addMB;
  try {
    fs.writeFileSync(statsPath, JSON.stringify(GlobalStats));
  } catch (err) {
    console.error("Failed to save stats", err);
  }
}
