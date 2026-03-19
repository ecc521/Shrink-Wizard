// src/shared/ipc-types.ts

export interface CompressionStats {
  originalSize: number;
  compressedSize: number;
  savedSpace: number;
  isCompressed: boolean;
}

export interface JpegCompressResult {
  originalSize: number;
  compressedSize: number;
  mark: boolean; // true if compression actually reduced size
}

export interface ProgressData {
  phase: 'scanning' | 'processing' | 'done';
  totalMB: number;
  processedMB: number;
  savingsMB: number;
  percentage: number;
  compressedCount: number;
  skippedCount: number;
  failedCount: number;
  alreadyCompressedCount: number;
  totalFiles: number;
  originalMB?: number;
  currentSettingsSavingsMB?: number;
  maxSettingsSavingsMB?: number;
  fileCount?: number;
}

/**
 * The API exposed to the React frontend via window.electron
 */
export interface ElectronAPI {
  platform: 'win32' | 'darwin' | 'linux';
  
  // File operations
  openDirectory: () => Promise<string[] | null>;
  openFiles: () => Promise<string[] | null>;
  
  // macOS / Windows generic compression
  transparentlyCompress: (filePath: string) => Promise<CompressionStats>;
  undoTransparentCompression: (filePath: string) => Promise<void>;
  isTransparentlyCompressed: (filePath: string) => Promise<boolean>;
  
  // Image specific
  compressJpeg: (filePath: string) => Promise<JpegCompressResult>;
  compressJpegToJxl: (filePath: string, destPath?: string) => Promise<{originalSize: number, compressedSize: number, mark: boolean}>;
  restoreJxlToJpeg: (filePath: string, destPath?: string) => Promise<void>;
  
  // Unified recursive processing
  processPaths: (filePaths: string[], mode: 'compress' | 'restore', options: any) => Promise<CompressionStats>;
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
  getGlobalSavingsMB: () => Promise<number>;
  
  // Scanner API
  scanSystem: (paths: string[], options: any) => Promise<{results: any[], skippedCount: number}>;
  onScanUpdate: (callback: (data: {results: any[], skippedCount: number}) => void) => void;
  removeScanUpdateListeners: () => void;
  onScanProgress: (callback: (data: any) => void) => void;
  removeScanProgressListeners: () => void;
  abortScan: () => Promise<void>;
  abortProcess: () => Promise<void>;
  
  // Progress Events
  onProgress: (callback: (data: ProgressData) => void) => void;
  removeProgressListeners: () => void;
  
  onLimitReached: (callback: () => void) => void;
  removeLimitReachedListeners: () => void;
  togglePause: (paused: boolean) => Promise<void>;
}
