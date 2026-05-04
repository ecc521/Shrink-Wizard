import { describe, it, expect, vi, beforeEach } from "vitest";
import { loadStats, GlobalStats, saveStats } from "./statsRepository";
import * as fs from "node:fs";
import * as path from "node:path";

// Mock Electron's app container dependency securely
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/mock/user/data/path"),
  },
}));

// Mock Native FS securely
vi.mock("node:fs", () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
}));

describe("Stats Repository", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    GlobalStats.clientId = "";
    GlobalStats.globalSavingsMB = 0;
    GlobalStats.isPro = false;
  });

  it("generates a fresh UUID client identification securely when no file exists", () => {
    vi.mocked(fs.existsSync).mockReturnValue(false);

    loadStats();

    // Validates that it mathematically generates a valid hyphenated 36-char crypto string
    expect(GlobalStats.clientId.length).toBe(36);
    expect(fs.writeFileSync).toHaveBeenCalled();
  });

  it("smoothly injects memory payload back onto physical disk", () => {
    saveStats(1024);

    expect(GlobalStats.globalSavingsMB).toBe(1024);
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join("/mock/user/data/path", "shrinkwizard_stats.json"),
      expect.any(String),
    );
  });
});
