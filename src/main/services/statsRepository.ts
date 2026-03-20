import * as fs from "fs";
import * as path from "path";
import { app } from "electron";
import * as crypto from "crypto";

export const GlobalStats = {
  globalSavingsMB: 0,
  isPro: false,
  hasSeen5GBLimit: false,
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
      Object.assign(GlobalStats, JSON.parse(data));
    }

    // Generate an anonymous client ID for analytics if it doesn't exist
    if (!GlobalStats.clientId) {
      GlobalStats.clientId = crypto.randomUUID();
      fs.writeFileSync(statsPath, JSON.stringify(GlobalStats));
    }
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
  try {
    fs.writeFileSync(statsPath, JSON.stringify(GlobalStats));
  } catch (err) {
    console.error("Failed to save stats", err);
  }
}
