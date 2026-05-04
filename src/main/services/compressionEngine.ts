import * as path from "node:path";
import * as fs from "node:fs";
import * as net from "node:net";

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
  compressImageToJxlNative,
  restoreJxlToImageNative,
} from "../compression/jxl";
import { CompressionStats } from "../../shared/ipc-types";
import { trackEvent } from "./analytics";
import { AppState } from "./state";
import { GlobalStats, saveStats } from "./statsRepository";
import { getOptimalConcurrency } from "./osAdapter";
import { IpcMainInvokeEvent } from "electron";
import { ProcessOptions } from "../../shared/ipc-types";

interface DaemonResponse {
  type: string;
  id: string;
  result?: any;
  error?: string;
  action?: string;
  originalSize?: number;
  compressedSize?: number;
  uncompressedSize?: number;
}

export async function processPathsHandler(
  event: IpcMainInvokeEvent,
  filePaths: string[],
  mode: "compress" | "restore",
  options: ProcessOptions,
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
  let rootSocket: net.Socket | null = null;
  const rootServer: net.Server | null = null;
  let sudoFailed = false;
  let outOfSpace = false;
  let lastSpaceCheck = 0;
  const workerPromises = new Map<
    string,
    { resolve: (val: DaemonResponse) => void; reject: (err: Error) => void }
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
    const globalSocketPath = "/var/run/com.shrinkwizard.sock";

    let useGlobalSocket = false;
    try {
      await fs.promises.access(globalSocketPath, fs.constants.W_OK);
      useGlobalSocket = true;
    } catch {
      /* ignore */
    }

    // Shared parser for the socket
    const handleSocketData = (socket: net.Socket) => {
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
          } catch {
            /* ignore */
          }
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
          rootSocket.on("error", (err: Error) => {
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

  // 1. Resolve totals (either via options or a dry-run fast count)
  let expectedTotalFiles = options.expectedTotalFiles || 0;
  let expectedTotalBytes = options.expectedTotalBytes || 0;
  let skippedSystemFiles = false;

  if (expectedTotalFiles === 0 || expectedTotalBytes === 0) {
    async function dryRunWalk(targetPath: string) {
      if (myToken !== AppState.currentProcessToken) return;
      try {
        const stat = await fs.promises.stat(targetPath);
        if (stat.isDirectory()) {
          const entries = await fs.promises.readdir(targetPath, {
            withFileTypes: true,
          });
          for (const entry of entries) {
            await dryRunWalk(path.join(targetPath, entry.name));
          }
        } else if (stat.isFile()) {
          if (stat.size > 0) {
            expectedTotalFiles++;
            expectedTotalBytes += stat.size;
            // Send periodic updates to UI to keep it responsive on HDDs
            if (expectedTotalFiles % 1000 === 0) {
              event.sender.send("progress-update", {
                phase: "scanning",
                totalFiles: expectedTotalFiles,
                totalMB: expectedTotalBytes / (1024 * 1024),
                processedMB: 0,
                savingsMB: 0,
                percentage: 0,
                compressedCount: 0,
                skippedCount: 0,
                skippedMB: 0,
                failedCount: 0,
                alreadyCompressedCount: 0,
                skippedSystemFiles,
              });
            }
          }
        }
      } catch {
        console.error("Access denied:", targetPath);
      }
    }

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
      await dryRunWalk(p);
    }
  } else {
    // If they were provided by scanner, we still need to check for c:/windows to set the flag correctly
    for (const p of filePaths) {
      if (
        process.platform === "win32" &&
        p.replace(/\\/g, "/").toLowerCase() === "c:/windows"
      ) {
        console.warn(
          "Skipping C:\\Windows natively - use the System Storage CompactOS tab instead.",
        );
        skippedSystemFiles = true;
      }
    }
  }

  const totalFiles = expectedTotalFiles;
  const totalBytes = expectedTotalBytes;
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

  // 2. Producer-Consumer Queue
  type FileItem = { path: string; size: number; ext: string };
  const MAX_QUEUE_SIZE = 1000;
  const queue: FileItem[] = [];
  let producerDone = false;
  let waitingConsumer: ((value: unknown) => void) | null = null;
  let waitingProducer: ((value: unknown) => void) | null = null;

  async function enqueue(item: FileItem) {
    if (queue.length >= MAX_QUEUE_SIZE) {
      await new Promise((resolve) => {
        waitingProducer = resolve;
      });
    }
    queue.push(item);
    if (waitingConsumer) {
      waitingConsumer(null);
      waitingConsumer = null;
    }
  }

  async function dequeue(): Promise<FileItem | undefined> {
    while (queue.length === 0 && !producerDone) {
      if (myToken !== AppState.currentProcessToken) return undefined;
      await new Promise((resolve) => {
        waitingConsumer = resolve;
      });
    }
    if (queue.length > 0) {
      const item = queue.shift()!;
      if (waitingProducer && queue.length < MAX_QUEUE_SIZE / 2) {
        waitingProducer(null);
        waitingProducer = null;
      }
      return item;
    }
    return undefined;
  }

  async function walkProducer(targetPath: string) {
    if (myToken !== AppState.currentProcessToken) return;
    try {
      const stat = await fs.promises.stat(targetPath);
      if (stat.isDirectory()) {
        const entries = await fs.promises.readdir(targetPath, {
          withFileTypes: true,
        });
        for (const entry of entries) {
          await walkProducer(path.join(targetPath, entry.name));
        }
      } else if (stat.isFile()) {
        if (stat.size > 0) {
          await enqueue({
            path: targetPath,
            size: stat.size,
            ext: path.extname(targetPath).toLowerCase(),
          });
        }
      }
    } catch {
      // Ignore access denied on actual processing pass
    }
  }

  // Start the producer immediately
  (async () => {
    for (const p of filePaths) {
      if (myToken !== AppState.currentProcessToken) break;
      if (
        process.platform === "win32" &&
        p.replace(/\\/g, "/").toLowerCase() === "c:/windows"
      ) {
        continue; // Already handled skippedSystemFiles flag
      }
      await walkProducer(p);
    }
    producerDone = true;
    if (waitingConsumer) {
      waitingConsumer(null);
      waitingConsumer = null;
    }
  })();

  // 3. Processing Phase (Concurrency Pool)
  async function processConcurrency(
    initialConcurrency: number,
    worker: (file: FileItem) => Promise<void>,
  ) {
    let activeWorkers = 0;

    async function next() {
      activeWorkers++;
      while (true) {
        if (myToken !== AppState.currentProcessToken) break;

        // Pause queue mid-job if the user crosses the trial or daily limits
        if (mode === "compress" && !options.isPro) {
          const isTrialExhausted = GlobalStats.globalSavingsMB >= 3000;
          const isDailyExhausted = GlobalStats.dailySavingsMB >= 1000;

          if (isTrialExhausted && !GlobalStats.hasSeenTrialEnd) {
            GlobalStats.hasSeenTrialEnd = true;
            saveStats(0);
            AppState.isQueuePaused = true;
            event.sender.send("trial-limit-reached");
          } else if (
            isTrialExhausted &&
            isDailyExhausted &&
            !GlobalStats.hasSeenDailyLimit
          ) {
            GlobalStats.hasSeenDailyLimit = true;
            saveStats(0);
            AppState.isQueuePaused = true;
            event.sender.send("daily-limit-reached");
          }
        }

        while (
          AppState.isQueuePaused &&
          myToken === AppState.currentProcessToken
        ) {
          await new Promise((r) => setTimeout(r, 500));
        }
        if (myToken !== AppState.currentProcessToken || outOfSpace) break;

        const file = await dequeue();
        if (!file) break; // queue is empty and producer is done

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
            } catch {
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

  // Start with max concurrency
  const hardwareConcurrency = getOptimalConcurrency();

  await processConcurrency(hardwareConcurrency, async (f) => {
    // Logic for Images
    if (
      mode === "compress" &&
      options.imageCompressionEnabled &&
      (f.ext === ".jpg" ||
        f.ext === ".jpeg" ||
        (options.outputFormat === "jxl" && f.ext === ".png"))
    ) {
      let res;
      if (options.outputFormat === "jxl") {
        const jxlDest = f.path.replace(/\.(jpe?g|png)$/i, ".jxl");
        res = await compressImageToJxlNative(f.path, jxlDest, {
          effort: options.effort,
        });
        if (res && res.mark) {
          try {
            const extName = f.ext.replace(".", "").padEnd(4, "\0").slice(0, 4); // max 4 chars
            const footer = Buffer.from(`\0\0\0\0\0SW_EXT:${extName}`); // 16 bytes exactly
            await fs.promises.appendFile(jxlDest, footer);
          } catch (e) {
            console.error("Failed to write JXL footer metadata", e);
          }
        }
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

    if (
      mode === "restore" &&
      options.imageCompressionEnabled &&
      f.ext === ".jxl"
    ) {
      let ext = ".jpg";
      try {
        const fd = await fs.promises.open(f.path, "r");
        const stat = await fd.stat();
        if (stat.size >= 16) {
          const buf = Buffer.alloc(16);
          await fd.read(buf, 0, 16, stat.size - 16);
          const footerStr = buf.toString("utf8");
          const match = footerStr.match(/SW_EXT:([a-zA-Z0-9\0]+)/);
          if (match) {
            ext = "." + match[1].replace(/\0/g, "");
          }
        }
        await fd.close();
      } catch (e) {
        console.error("Failed to read JXL footer metadata", e);
      }

      const imgDest = f.path.replace(/\.jxl$/i, ext);
      const stats = await restoreJxlToImageNative(f.path, imgDest);
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
          const p = new Promise<DaemonResponse>((resolve, reject) =>
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
    } else if (mode === "restore" && options.nativeAlgo !== "off") {
      // Restore OS Compression
      let stats;
      if (process.platform === "darwin") {
        if (rootSocket) {
          const id = Math.random().toString(36).substring(2);
          const p = new Promise<DaemonResponse>((resolve, reject) =>
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
    } else {
      skippedCount++;
      skippedMB += f.size / (1024 * 1024);
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
