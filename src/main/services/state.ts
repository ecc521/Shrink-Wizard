import { BrowserWindow } from "electron";

export const AppState = {
  isQueuePaused: false,
  currentScanToken: 0,
  currentProcessToken: 0,
  globalScannedInodes: new Set<string>(),
  mainWindow: null as BrowserWindow | null,
};
