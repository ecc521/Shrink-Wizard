import { app, BrowserWindow, screen } from "electron";
import * as path from "path";
import { autoUpdater } from "electron-updater";
import { AppState } from "./services/state";
import { GlobalStats, loadStats } from "./services/statsRepository";
import { registerIpcHandlers } from "./services/ipcRouter";
import { trackEvent } from "./services/analytics";

// Basic auto-updater config
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  const { width: screenWidth, height: screenHeight } =
    screen.getPrimaryDisplay().workAreaSize;
  const boundedWidth = Math.min(1080, screenWidth - 40);
  const boundedHeight = Math.min(770, screenHeight - 40);

  AppState.mainWindow = new BrowserWindow({
    width: boundedWidth,
    height: boundedHeight,
    titleBarStyle: "hiddenInset",
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.cjs"),
      nodeIntegration: false,
      contextIsolation: true, // Secured standard for modern Electron
    },
  });

  if (process.env.NODE_ENV === "development") {
    AppState.mainWindow.loadURL("http://localhost:5174");
    AppState.mainWindow.webContents.openDevTools();
  } else {
    AppState.mainWindow.loadFile(path.join(__dirname, "../../dist/index.html"));
  }

  // IMPENETRABLE LOCK: Prevent Chromium from natively loading dropped files and causing a White Screen
  AppState.mainWindow.webContents.on("will-navigate", (e, url) => {
    if (url !== "http://localhost:5174/") {
      e.preventDefault();
    }
  });

  AppState.mainWindow.on("closed", () => {
    AppState.mainWindow = null;
  });
}

// Global App Boot
app.whenReady().then(() => {
  loadStats();
  createWindow();

  trackEvent(GlobalStats.clientId, "app_open", {
    platform: process.platform,
    version: app.getVersion(),
    savings_mb: GlobalStats.globalSavingsMB,
    is_pro: GlobalStats.isPro,
  });

  // Check for updates quietly in the background
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    console.error("Auto-updater error:", err);
  }

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  // Delegate all deeply coupled logic to the extracted Router
  registerIpcHandlers();
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
