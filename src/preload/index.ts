import { contextBridge, ipcRenderer, webUtils } from "electron";
import type { ElectronAPI } from "../shared/ipc-types";

const api: ElectronAPI = {
  platform: process.platform as "win32" | "darwin" | "linux",

  openDirectory: () => ipcRenderer.invoke("open-directory"),
  openFiles: () => ipcRenderer.invoke("open-files"),

  transparentlyCompress: (filePath) =>
    ipcRenderer.invoke("transparently-compress", filePath),
  undoTransparentCompression: (filePath) =>
    ipcRenderer.invoke("undo-transparent-compression", filePath),
  isTransparentlyCompressed: (filePath) =>
    ipcRenderer.invoke("is-transparently-compressed", filePath),

  compressJpeg: (filePath) => ipcRenderer.invoke("compress-jpeg", filePath),
  compressJpegToJxl: (filePath, destPath) =>
    ipcRenderer.invoke("compress-jpeg-to-jxl", filePath, destPath),
  restoreJxlToJpeg: (filePath, destPath) =>
    ipcRenderer.invoke("restore-jxl-to-jpeg", filePath, destPath),
  processPaths: (
    filePaths: string[],
    mode: "compress" | "restore",
    options: any,
  ) => ipcRenderer.invoke("process-paths", filePaths, mode, options),

  getPathForFile: (file: File) => webUtils.getPathForFile(file),

  queryCompactOS: () => ipcRenderer.invoke("query-compact-os"),
  toggleCompactOS: (enable) => ipcRenderer.invoke("toggle-compact-os", enable),

  getAppVersion: () => ipcRenderer.invoke("get-app-version"),
  openLicenses: () => ipcRenderer.invoke("open-licenses"),
  openUrl: (url: string) => ipcRenderer.invoke("open-url", url),

  getProStatus: () => ipcRenderer.invoke("get-pro-status"),
  verifyLicense: (key: string) => ipcRenderer.invoke("verify-license", key),
  isAdmin: () => ipcRenderer.invoke("is-admin"),
  getGlobalSavingsMB: () => ipcRenderer.invoke("get-global-savings"),
  scanSystem: (paths: string[], options: any) =>
    ipcRenderer.invoke("scan-system", paths, options),

  onScanUpdate: (callback: (data: any) => void) => {
    ipcRenderer.on("scan-update", (_, data) => callback(data));
  },
  removeScanUpdateListeners: () => {
    ipcRenderer.removeAllListeners("scan-update");
  },
  onScanProgress: (callback: (data: any) => void) => {
    ipcRenderer.on("scan-progress", (_, data) => callback(data));
  },
  removeScanProgressListeners: () => {
    ipcRenderer.removeAllListeners("scan-progress");
  },
  abortScan: () => ipcRenderer.invoke("abort-scan"),
  abortProcess: () => ipcRenderer.invoke("abort-process"),

  onProgress: (callback: (data: any) => void) => {
    ipcRenderer.on("progress-update", (_, data) => callback(data));
  },
  removeProgressListeners: () => {
    ipcRenderer.removeAllListeners("progress-update");
  },

  onLimitReached: (callback: () => void) => {
    ipcRenderer.on("limit-reached", () => callback());
  },
  removeLimitReachedListeners: () => {
    ipcRenderer.removeAllListeners("limit-reached");
  },
  togglePause: (paused: boolean) => ipcRenderer.invoke("toggle-pause", paused),
};

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld("electron", api);
  } catch (error) {
    console.error(error);
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = api;
}
