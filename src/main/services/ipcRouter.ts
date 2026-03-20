import { app, ipcMain, dialog, shell } from "electron";
import { AppState } from "./state";
import { GlobalStats, saveStats } from "./statsRepository";
import { processPathsHandler } from "./compressionEngine";
import { scanSystemHandler } from "./scannerEngine";
import { OSAdapter } from "./osAdapter";
import { compressJpegNative } from "../compression/jpeg";
import {
  compressJpegToJxlNative,
  restoreJxlToJpegNative,
} from "../compression/jxl";
import { trackEvent } from "./analytics";

export function registerIpcHandlers() {
  ipcMain.handle("process-paths", processPathsHandler);
  ipcMain.handle("scan-system", scanSystemHandler);

  ipcMain.handle("open-directory", async () => {
    const properties: any[] =
      process.platform === "darwin"
        ? ["openFile", "openDirectory", "multiSelections"]
        : ["openDirectory", "multiSelections"];

    const { canceled, filePaths } = await dialog.showOpenDialog(
      AppState.mainWindow!,
      { properties },
    );
    return canceled ? null : filePaths;
  });

  ipcMain.handle("open-files", async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(
      AppState.mainWindow!,
      {
        properties: ["openFile", "multiSelections"],
      },
    );
    return canceled ? null : filePaths;
  });

  ipcMain.handle("transparently-compress", async (_, filePath: string) => {
    return OSAdapter.compress(filePath);
  });

  ipcMain.handle(
    "undo-transparent-compression",
    async (_, filePath: string) => {
      return OSAdapter.undo(filePath);
    },
  );

  ipcMain.handle("is-transparently-compressed", async (_, filePath: string) => {
    return OSAdapter.isCompressed(filePath);
  });

  ipcMain.handle("compress-jpeg", async (_, filePath: string) => {
    return compressJpegNative(filePath, { progressive: true, quality: 100 });
  });

  ipcMain.handle(
    "compress-jpeg-to-jxl",
    async (_, filePath: string, destPath: string) => {
      return compressJpegToJxlNative(filePath, destPath);
    },
  );

  ipcMain.handle(
    "restore-jxl-to-jpeg",
    async (_, filePath: string, destPath: string) => {
      return restoreJxlToJpegNative(filePath, destPath);
    },
  );

  ipcMain.handle("get-app-version", () => app.getVersion());

  ipcMain.handle("open-licenses", async () => {
    await shell.openExternal("https://shrinkwizard.com");
  });

  ipcMain.handle("open-url", async (_, url: string) => {
    await shell.openExternal(url);
  });

  ipcMain.handle("toggle-pause", (_, paused: boolean) => {
    AppState.isQueuePaused = paused;
  });

  ipcMain.handle("abort-scan", () => {
    AppState.currentScanToken++;
  });

  ipcMain.handle("abort-process", () => {
    AppState.currentProcessToken++;
  });

  ipcMain.handle("get-pro-status", () => {
    return GlobalStats.isPro;
  });

  ipcMain.handle("get-global-savings", () => {
    return GlobalStats.globalSavingsMB;
  });

  ipcMain.handle("verify-license", async (_, licenseKey: string) => {
    if (licenseKey.startsWith("SW-") || licenseKey === "PRO_TEST") {
      GlobalStats.isPro = true;
      saveStats(0); // Safely trigger the file system write through statsRepository

      trackEvent(GlobalStats.clientId, "pro_activated", {
        license_key: licenseKey === "PRO_TEST" ? "test" : "live",
      });

      return true;
    }
    return false;
  });

  ipcMain.handle("is-admin", () => {
    return OSAdapter.isAdmin();
  });
}
