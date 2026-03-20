import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as zlib from "zlib";

import { compressJpegNative } from "../compression/jpeg";
import {
  transparentlyCompress as macosCompress,
  undoTransparentCompression as macosUndo,
} from "../compression/macos";
import {
  transparentlyCompress as winCompress,
  undoTransparentCompression as winUndo,
} from "../compression/windows";
import {
  compressJpegToJxlNative,
  restoreJxlToJpegNative,
} from "../compression/jxl";
import { CompressionStats } from "../../shared/ipc-types";
import { trackEvent } from "./analytics";
import { AppState } from "./state";
import { GlobalStats, saveStats } from "./statsRepository";

export async function processPathsHandler(
  event: any,
  filePaths: string[],
  mode: "compress" | "restore",
  options: any,
): Promise<CompressionStats> {
  AppState.currentProcessToken++;
  const myToken = AppState.currentProcessToken;
  // Disable ASAR traversal to prevent Electron from treating .asar files as directories, which breaks OS-level stat calls
  process.noAsar = true;

  event.sender.send("progress-update", {
    phase: "scanning",
    totalMB: 0,
    processedMB: 0,
    savingsMB: 0,
    percentage: 0,
    compressedCount: 0,
    skippedCount: 0,
    skippedMB: 0,
    failedCount: 0,
    alreadyCompressedCount: 0,
    totalFiles: 0,
    skippedSystemFiles: false,
  });
  let rootSocket: any = null;
  const rootServer: any = null;
  let sudoFailed = false;
  let outOfSpace = false;
  let lastSpaceCheck = 0;
  const workerPromises = new Map<
    string,
    { resolve: (val: any) => void; reject: (err: any) => void }
  >();

  if (
    process.platform === "darwin" &&
    filePaths.some(
      (p: string) =>
        p === "/" ||
        p.startsWith("/Applications") ||
        p.startsWith("/Library") ||
        p.startsWith("/System"),
    )
  ) {
    const net = require("net");
    const globalSocketPath = "/var/run/com.shrinkwizard.sock";

    let useGlobalSocket = false;
    try {
      await fs.promises.access(globalSocketPath, fs.constants.W_OK);
      useGlobalSocket = true;
    } catch (e) {}

    // Shared parser for the socket
    const handleSocketData = (socket: any) => {
      let buffer = "";
      socket.on("data", (data: Buffer) => {
        buffer += data.toString();
        let newlineIdx;
        while ((newlineIdx = buffer.indexOf("\n")) !== -1) {
          const msgStr = buffer.slice(0, newlineIdx);
          buffer = buffer.slice(newlineIdx + 1);
          if (!msgStr.trim()) continue;
          try {
            const msg = JSON.parse(msgStr);
            if (msg.type === "result" || msg.type === "error") {
              const p = workerPromises.get(msg.id);
              if (p) {
                if (msg.type === "result") p.resolve(msg.result);
                else p.reject(new Error(msg.error));
                workerPromises.delete(msg.id);
              }
            }
          } catch (e) {}
        }
      });
    };

    try {
      if (useGlobalSocket) {
        await new Promise<void>((resolve, reject) => {
          rootSocket = net.createConnection(globalSocketPath, () => {
            handleSocketData(rootSocket);
            resolve();
          });
          rootSocket.on("error", (err: any) => {
            console.error("Failed to connect to global daemon:", err);
            sudoFailed = true;
            event.sender.send("progress-update", { sudoFailed: true });
            reject(err);
          });
        });
      } else {
        sudoFailed = true;
        event.sender.send("progress-update", { sudoFailed: true });
      }
    } catch (e) {
      console.error("Failed to connect to root daemon:", e);
    }
  }

  const allFiles: { path: string; size: number; ext: string }[] = [];
  async function walk(targetPath: string) {
    if (myToken !== AppState.currentProcessToken) return;
    try {
      const stat = await fs.promises.stat(targetPath);
      if (stat.isDirectory()) {
        const entries = await fs.promises.readdir(targetPath, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          await walk(path.join(targetPath, entry.name));
        }
      } else if (stat.isFile()) {
        if (stat.size > 0) {
          allFiles.push({
            path: targetPath,
            size: stat.size,
            ext: path.extname(targetPath).toLowerCase(),
          });
        }
      }
    } catch (e) {
      console.error("Access denied:", targetPath);
    }
  }

  let skippedSystemFiles = false;

  for (const p of filePaths) {
    if (myToken !== AppState.currentProcessToken) break;
    if (
      process.platform === "win32" &&
      p.replace(/\\/g, "/").toLowerCase() === "c:/windows"
    ) {
      console.warn(
        "Skipping C:\\Windows natively - use the System Storage CompactOS tab instead.",
      );
      skippedSystemFiles = true;
      continue;
    }
    await walk(p);
  }

  const totalFiles = allFiles.length;
  const totalBytes = allFiles.reduce((acc, f) => acc + f.size, 0);
  const totalMB = totalBytes / (1024 * 1024);

  let processedMB = 0;
  let savingsMB = 0;
  let compressedCount = 0;
  let skippedCount = 0;
  let skippedMB = 0;
  let failedCount = 0;
  let alreadyCompressedCount = 0;

  let originalSizeTracker = 0;
  let compressedSizeTracker = 0;

  const updateProgress = () => {
    event.sender.send("progress-update", {
      phase: "processing",
      totalMB,
      processedMB,
      savingsMB,
      percentage:
        totalBytes === 0
          ? 100
          : Math.min(100, Math.floor((processedMB / totalMB) * 100)),
      compressedCount,
      skippedCount,
      skippedMB,
      failedCount,
      alreadyCompressedCount,
      totalFiles,
      globalSavingsMB: GlobalStats.globalSavingsMB,
      sudoFailed,
      outOfSpace,
      skippedSystemFiles,
    });
  };

  updateProgress();

  // 2. Processing Phase (Concurrency Pool)
  async function processConcurrency(
    files: typeof allFiles,
    initialConcurrency: number,
    worker: (file: (typeof allFiles)[0]) => Promise<void>,
  ) {
    let index = 0;
    let activeWorkers = 0;

    async function next() {
      activeWorkers++;
      while (index < files.length) {
        if (myToken !== AppState.currentProcessToken) break;
        // Dynamically kill extra worker threads mid-job if the user crosses the 5GB limit
        if (!options.isPro && GlobalStats.globalSavingsMB >= 5000) {
          if (!GlobalStats.hasSeen5GBLimit) {
            GlobalStats.hasSeen5GBLimit = true;
            saveStats(0);
            AppState.isQueuePaused = true;
            event.sender.send("limit-reached");
          }
          if (activeWorkers > 1) {
            activeWorkers--;
            return;
          }
        }

        while (
          AppState.isQueuePaused &&
          myToken === AppState.currentProcessToken
        ) {
          await new Promise((r) => setTimeout(r, 500));
        }
        if (myToken !== AppState.currentProcessToken || outOfSpace) break;
        const file = files[index++];

        // Disk Space Safeguard for Decompression (checks globally every 2s)
        if (mode === "restore") {
          const now = Date.now();
          if (now - lastSpaceCheck > 2000) {
            lastSpaceCheck = now;
            try {
              const statFs = await fs.promises.statfs(path.dirname(file.path));
              const freeSpace = statFs.bavail * statFs.bsize;
              if (freeSpace < 2 * 1024 * 1024 * 1024) {
                // 2 GB hard limit
                outOfSpace = true;
                updateProgress();
                break;
              }
            } catch (err) {
              // Ignore statfs errors (e.g. read-only mounts that don't support it)
            }
          }
        }

        let processSuccess = true;
        await worker(file).catch((err) => {
          failedCount++;
          skippedMB += file.size / (1024 * 1024);
          processSuccess = false;
          console.error("File process err:", err);
        });
        if (processSuccess) {
          processedMB += file.size / (1024 * 1024);
        }
        updateProgress();
      }
      activeWorkers--;
    }

    const promises = [];
    for (let i = 0; i < initialConcurrency; i++) promises.push(next());
    await Promise.all(promises);
  }

  // Start with max concurrency (or 1 if they are already throttled before the batch even starts)
  let hardwareConcurrency = os.cpus().length > 0 ? os.cpus().length : 4;
  if (!options.isPro && GlobalStats.globalSavingsMB >= 5000) {
    hardwareConcurrency = 1;
  }

  await processConcurrency(allFiles, hardwareConcurrency, async (f) => {
    // Logic for Images
    if (
      mode === "compress" &&
      options.imageCompressionEnabled &&
      (f.ext === ".jpg" || f.ext === ".jpeg")
    ) {
      let res;
      if (options.outputFormat === "jxl") {
        const jxlDest = f.path.replace(/\.jpe?g$/i, ".jxl");
        res = await compressJpegToJxlNative(f.path, jxlDest, {
          effort: options.effort,
        });
      } else {
        res = await compressJpegNative(f.path, {
          quality: 100,
          progressive: true,
        });
      }
      if (res && res.mark) {
        originalSizeTracker += res.originalSize;
        compressedSizeTracker += res.compressedSize;
        const savedFileMB =
          (res.originalSize - res.compressedSize) / (1024 * 1024);
        savingsMB += savedFileMB;
        saveStats(savedFileMB);
        compressedCount++;
      } else {
        skippedCount++;
        skippedMB += f.size / (1024 * 1024);
      }
      return;
    }

    if (mode === "restore" && f.ext === ".jxl") {
      const jpgDest = f.path.replace(/\.jxl$/i, ".jpg");
      const stats = await restoreJxlToJpegNative(f.path, jpgDest);
      savingsMB +=
        (stats.originalSize - stats.uncompressedSize) / (1024 * 1024);
      originalSizeTracker += stats.uncompressedSize;
      compressedSizeTracker += stats.originalSize;
      compressedCount++; // Representing decompressed successfully
      updateProgress();
      return;
    }

    // Logic for OS Transparent Compression
    if (mode === "compress" && options.nativeAlgo !== "off") {
      let osStats;
      let algo = options.nativeAlgo;
      if (algo === "automatic") {
        algo = process.platform === "darwin" ? "default" : undefined; // winCompress defaults to LZX if undefined
      }
      const osOptions = { algorithm: algo };

      if (process.platform === "darwin") {
        if (rootSocket) {
          const id = Math.random().toString(36).substring(2);
          const p = new Promise<any>((resolve, reject) =>
            workerPromises.set(id, { resolve, reject }),
          );
          rootSocket.write(
            JSON.stringify({
              type: "process",
              id,
              file: { path: f.path },
              mode: "compress",
              options: osOptions,
            }) + "\n",
          );
          const res = await p;
          if (res.action === "skipped")
            osStats = {
              mark: true,
              compressed: false,
              originalSize: 1,
              compressedSize: 2,
            };
          else if (res.action === "alreadyCompressed")
            osStats = {
              mark: false,
              compressed: false,
              originalSize: 0,
              compressedSize: 0,
            };
          else
            osStats = {
              mark: true,
              compressed: true,
              originalSize: res.originalSize,
              compressedSize: res.compressedSize,
            };
        } else {
          osStats = await macosCompress(f.path, osOptions);
        }
      } else if (process.platform === "win32") {
        osStats = await winCompress(f.path, osOptions);
      }

      if (osStats) {
        if (osStats.mark) {
          // Compression was actively applied
          if (osStats.compressedSize < osStats.originalSize) {
            originalSizeTracker += osStats.originalSize;
            compressedSizeTracker += osStats.compressedSize;
            const savedFileMB =
              (osStats.originalSize - osStats.compressedSize) / (1024 * 1024);
            savingsMB += savedFileMB;
            saveStats(savedFileMB);
            compressedCount++;
          } else {
            skippedCount++; // It just didn't shrink
            skippedMB += f.size / (1024 * 1024);
          }
        } else {
          // Internally marked false, meaning it's already compressed
          alreadyCompressedCount++;
        }
      }
    } else {
      // Restore OS Compression
      let stats;
      if (process.platform === "darwin") {
        if (rootSocket) {
          const id = Math.random().toString(36).substring(2);
          const p = new Promise<any>((resolve, reject) =>
            workerPromises.set(id, { resolve, reject }),
          );
          rootSocket.write(
            JSON.stringify({
              type: "process",
              id,
              file: { path: f.path },
              mode: "restore",
            }) + "\n",
          );
          stats = await p;
        } else {
          stats = await macosUndo(f.path);
        }
      } else if (process.platform === "win32") {
        stats = await winUndo(f.path);
      }
      if (stats) {
        savingsMB +=
          (stats.originalSize - stats.uncompressedSize) / (1024 * 1024);
        originalSizeTracker += stats.uncompressedSize;
        compressedSizeTracker += stats.originalSize;
      }
      compressedCount++; // Decompressed
      updateProgress();
    }
  });

  if (rootSocket) {
    rootSocket.write(JSON.stringify({ type: "exit" }) + "\n");
    rootServer?.close();
  }

  event.sender.send("progress-update", {
    phase: "done",
    totalMB,
    processedMB,
    savingsMB,
    percentage: 100,
    compressedCount,
    skippedCount,
    skippedMB,
    failedCount,
    alreadyCompressedCount,
    totalFiles,
    sudoFailed,
    outOfSpace,
    skippedSystemFiles,
  });

  trackEvent(GlobalStats.clientId, "process_complete", {
    mode: mode,
    session_savings_mb: savingsMB,
    global_savings_mb: GlobalStats.globalSavingsMB,
    is_pro: GlobalStats.isPro,
  });

  return {
    originalSize: originalSizeTracker,
    compressedSize: compressedSizeTracker,
    savedSpace: originalSizeTracker - compressedSizeTracker,
    isCompressed: originalSizeTracker - compressedSizeTracker > 0,
  };
}
