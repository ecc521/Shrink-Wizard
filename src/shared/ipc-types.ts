// src/shared/ipc-types.ts

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  savedSpace: number;
  isCompressed?: boolean;
}

export interface QueueJob {
  id: string;
  path: string;
  mode: "compress" | "restore";
  status: "pending" | "staging" | "processing" | "done" | "failed";
  progressData?: ProgressData | null;
}

export interface JpegCompressResult {
  originalSize: number;
  compressedSize: number;
  mark: boolean; // true if compression actually reduced size
}

export interface ProgressData {
  phase: "scanning" | "processing" | "done";
  totalMB: number;
  processedMB: number;
  savingsMB: number;
  percentage: number;
  compressedCount: number;
  skippedCount: number;
  skippedMB: number;
  failedCount: number;
  alreadyCompressedCount: number;
  totalFiles: number;
  originalMB?: number;
  currentSettingsSavingsMB?: number;
  maxSettingsSavingsMB?: number;
  fileCount?: number;
  sudoFailed?: boolean;
  outOfSpace?: boolean;
  skippedSystemFiles?: boolean;
  globalSavingsMB?: number;
  path?: string;
  imageMaxSavingsMB?: number;
  fileMaxSavingsMB?: number;
}

// The shape for processPaths options
export interface ProcessOptions {
  imageCompressionEnabled?: boolean;
  outputFormat?: "jxl" | "jpeg" | "original";
  effort?: number;
  nativeAlgo?:
    | "automatic"
    | "lzvn"
    | "lzfse"
    | "zlib"
    | "off"
    | "none"
    | "LZX"
    | "XPRESS16K"
    | "XPRESS8K"
    | "XPRESS4K";
  clearCache?: boolean;
  isPro?: boolean;
  expectedTotalBytes?: number;
  expectedTotalFiles?: number;
}

// The shape for scanSystem results array
export interface ScanResult {
  path: string;
  originalMB: number;
  currentSettingsSavingsMB: number;
  maxSettingsSavingsMB: number;
  fileCount: number;
  imageMaxSavingsMB?: number;
  fileMaxSavingsMB?: number;
}

/**
 * The API exposed to the React frontend via window.electron
 */
export interface ElectronAPI {
  platform: "win32" | "darwin" | "linux";

  // File operations
  openDirectory: () => Promise<string[] | null>;
  openFiles: () => Promise<string[] | null>;

  // macOS / Windows generic compression
  transparentlyCompress: (filePath: string) => Promise<CompressionStats>;
  undoTransparentCompression: (filePath: string) => Promise<void>;
  isTransparentlyCompressed: (filePath: string) => Promise<boolean>;

  // Image specific
  compressJpeg: (filePath: string) => Promise<JpegCompressResult>;
  compressImageToJxl: (
    filePath: string,
    destPath?: string,
  ) => Promise<{ originalSize: number; compressedSize: number; mark: boolean }>;
  restoreJxlToImage: (filePath: string, destPath?: string) => Promise<void>;

  // Unified recursive processing
  processPaths: (
    filePaths: string[],
    mode: "compress" | "restore",
    options: ProcessOptions,
  ) => Promise<CompressionStats>;
  getPathForFile: (file: File) => string;

  // Windows exclusively
  queryCompactOS: () => Promise<boolean>;
  toggleCompactOS: (enable: boolean) => Promise<void>;

  // App Info & Licensing
  getAppVersion: () => Promise<string>;
  openLicenses: () => Promise<void>;
  openUrl: (url: string) => Promise<void>;

  getProStatus: () => Promise<boolean>;
  verifyLicense: (key: string) => Promise<boolean>;
  isAdmin: () => Promise<boolean>;
  getGlobalSavingsMB: () => Promise<{
    globalSavingsMB: number;
    dailySavingsMB: number;
    hasSeenTrialEnd: boolean;
  }>;

  // Scanner API
  scanSystem: (
    paths: string[],
    options: ProcessOptions,
  ) => Promise<{ results: ScanResult[]; skippedCount: number }>;
  onScanUpdate: (
    callback: (data: { results: ScanResult[]; skippedCount: number }) => void,
  ) => void;
  removeScanUpdateListeners: () => void;
  onScanProgress: (callback: (data: ProgressData) => void) => void;
  removeScanProgressListeners: () => void;
  abortScan: () => Promise<void>;
  abortProcess: () => Promise<void>;

  // Progress Events
  onProgress: (callback: (data: ProgressData) => void) => void;
  removeProgressListeners: () => void;

  onLimitReached: (callback: (limitType: "trial" | "daily") => void) => void;
  removeLimitReachedListeners: () => void;
  togglePause: (paused: boolean) => Promise<void>;
}
