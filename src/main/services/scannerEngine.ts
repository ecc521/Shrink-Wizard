import { promisify } from "util";
import * as path from "node:path";
import * as fs from "node:fs";
import * as os from "node:os";
import * as zlib from "node:zlib";
import { AppState } from "./state";
import { GlobalStats } from "./statsRepository";
import { trackEvent } from "./analytics";
import { getOptimalConcurrency } from "./osAdapter";
import { IpcMainInvokeEvent } from "electron";
import { ProcessOptions, ScanResult } from "../../shared/ipc-types";

export async function scanSystemHandler(
  event: IpcMainInvokeEvent,
  paths: string[],
  options: ProcessOptions,
) {
  if (options?.clearCache) {
    AppState.globalScannedInodes.clear();
    return { results: [], skippedCount: 0 };
  }

  let skippedCount = 0;
  const deflateAsync = promisify(zlib.deflate);

  async function isProgressiveJpeg(targetPath: string): Promise<boolean> {
    let fd;
    try {
      fd = await fs.promises.open(targetPath, "r");
      const buf = Buffer.alloc(32768);
      const { bytesRead } = await fd.read(buf, 0, 32768, 0);
      let i = 0;
      while (i < bytesRead - 1) {
        if (buf[i] === 0xff) {
          const marker = buf[i + 1];
          if (marker === 0xc2) return true;
          if (marker === 0xc0 || marker === 0xda) return false;
        }
        i++;
      }
    } catch {
      /* ignore */
    } finally {
      if (fd) await fd.close().catch(() => {});
    }
    return false;
  }

  class Semaphore {
    private queue: (() => void)[] = [];
    constructor(private max: number) {}
    async acquire() {
      if (this.max > 0) {
        this.max--;
        return;
      }
      await new Promise<void>((resolve) => this.queue.push(resolve));
    }
    release() {
      if (this.queue.length > 0) {
        const resolve = this.queue.shift()!;
        resolve();
      } else {
        this.max++;
      }
    }
  }
  const optimalConcurrency = getOptimalConcurrency();
  const ioLimit = new Semaphore(optimalConcurrency * 4); // Capped IO concurrency
  const statLimit = new Semaphore(64); // Reduced strict stat batching to prevent V8 LibUV threadpool queue starvation

  AppState.currentScanToken++;
  const myToken = AppState.currentScanToken;
  const results: ScanResult[] = [];

  for (let rootPath of paths) {
    if (rootPath.startsWith("~/")) {
      rootPath = path.join(os.homedir(), rootPath.slice(2));
    }

    let runOrigSize = 0;
    let runCurrentSavings = 0;
    let runMaxSavings = 0;
    let runImageMaxSavings = 0;
    let runFileMaxSavings = 0;
    let fileCount = 0;
    let lastEmit = Date.now();

    const walkQueue: { dir: string; depth: number }[] = [
      { dir: rootPath, depth: 0 },
    ];
    const maxWorkers = optimalConcurrency > 0 ? optimalConcurrency : 8; // One recursive native traversal thread per optimal CPU core
    let activeWorkers = 0;

    await new Promise<void>((resolve) => {
      function spawnWorker() {
        if (activeWorkers >= maxWorkers || walkQueue.length === 0) return;
        activeWorkers++;

        (async () => {
          while (walkQueue.length > 0) {
            if (myToken !== AppState.currentScanToken) {
              walkQueue.length = 0;
              break;
            }
            const task = walkQueue.pop(); // LIFO array traversal acts like Depth-First to constrain queue size bounds
            if (!task) break;
            if (task.depth > 12) continue;

            let entries: fs.Dirent[] = [];
            try {
              await statLimit.acquire();
              entries = await fs.promises.readdir(task.dir, {
                withFileTypes: true,
              });
            } catch {
              skippedCount++;
            } finally {
              statLimit.release();
            }

            for (const entry of entries) {
              if (myToken !== AppState.currentScanToken) break;
              while (
                AppState.isQueuePaused &&
                myToken === AppState.currentScanToken
              ) {
                await new Promise((r) => setTimeout(r, 500));
              }
              if (myToken !== AppState.currentScanToken) break;

              const fullPath = path.join(task.dir, entry.name);
              if (entry.isDirectory()) {
                walkQueue.push({ dir: fullPath, depth: task.depth + 1 });
                spawnWorker(); // Wake up idle workers for new directories
              } else if (entry.isFile()) {
                let stat;
                try {
                  await statLimit.acquire();
                  stat = await fs.promises.stat(fullPath);
                } catch {
                  skippedCount++;
                  continue;
                } finally {
                  statLimit.release();
                }

                if (stat.size > 0 && stat.nlink === 1) {
                  const inodeKey = `${stat.dev}-${stat.ino}`;
                  if (AppState.globalScannedInodes.has(inodeKey)) continue;
                  AppState.globalScannedInodes.add(inodeKey);

                  const physicalSize =
                    stat.blocks !== undefined
                      ? Math.min(stat.size, stat.blocks * 512)
                      : stat.size;
                  if (physicalSize === 0) continue;

                  fileCount++;
                  runOrigSize += physicalSize;
                  const ext = path.extname(fullPath).toLowerCase();
                  if (
                    options.imageCompressionEnabled &&
                    (ext === ".jpg" || ext === ".jpeg" || ext === ".png")
                  ) {
                    await ioLimit.acquire();
                    const isProg = await isProgressiveJpeg(fullPath);
                    ioLimit.release();

                    const mozSavings = isProg ? 0 : physicalSize * 0.2;
                    const jxlSavings = isProg
                      ? physicalSize * 0.1
                      : physicalSize * 0.3;
                    runCurrentSavings +=
                      options.outputFormat === "jxl" ? jxlSavings : mozSavings;
                    runMaxSavings += jxlSavings;
                    runImageMaxSavings += jxlSavings;
                  } else {
                    let ratio = 0.35;
                    if (physicalSize > 10 * 1024 * 1024) {
                      await ioLimit.acquire();
                      let fd;
                      try {
                        fd = await fs.promises.open(fullPath, "r");
                        const sampleBuf = Buffer.alloc(1024 * 100);
                        const { bytesRead } = await fd.read(
                          sampleBuf,
                          0,
                          1024 * 100,
                          0,
                        );
                        if (bytesRead > 0) {
                          const def = await deflateAsync(
                            sampleBuf.subarray(0, bytesRead),
                            { level: 1 },
                          );
                          const r = (bytesRead - def.length) / bytesRead;
                          ratio = Math.max(0, Math.min(r, 0.6));
                        }
                      } catch {
                        /* ignore */
                      } finally {
                        if (fd) await fd.close().catch(() => {});
                        ioLimit.release();
                      }
                    }
                    const nativeSavings = physicalSize * ratio;
                    runCurrentSavings +=
                      options.nativeAlgo !== "none" ? nativeSavings : 0;
                    runMaxSavings += nativeSavings;
                    runFileMaxSavings += nativeSavings;
                  }

                  // Live Throttled UI Updates
                  const now = Date.now();
                  if (now - lastEmit > 16) {
                    lastEmit = now;
                    event.sender.send("scan-progress", {
                      path: fullPath,
                      originalMB: runOrigSize / 1048576,
                      currentSettingsSavingsMB: runCurrentSavings / 1048576,
                      maxSettingsSavingsMB: runMaxSavings / 1048576,
                      imageMaxSavingsMB: runImageMaxSavings / 1048576,
                      fileMaxSavingsMB: runFileMaxSavings / 1048576,
                      fileCount,
                    });
                  }
                }
              }
            }
          }
          activeWorkers--;
          if (activeWorkers === 0 && walkQueue.length === 0) {
            resolve();
          }
        })();
        spawnWorker();
      }
      spawnWorker();
    });

    if (runOrigSize > 0) {
      results.push({
        path: rootPath,
        originalMB: runOrigSize / 1048576,
        currentSettingsSavingsMB: runCurrentSavings / 1048576,
        maxSettingsSavingsMB: runMaxSavings / 1048576,
        imageMaxSavingsMB: runImageMaxSavings / 1048576,
        fileMaxSavingsMB: runFileMaxSavings / 1048576,
        fileCount,
      });
      event.sender.send("scan-update", { results, skippedCount });
    }
  }

  trackEvent(GlobalStats.clientId, "scan_complete", {
    file_count: results.length,
    found_savings_mb: results.reduce(
      (acc, r) => acc + r.maxSettingsSavingsMB,
      0,
    ),
    is_pro: GlobalStats.isPro,
  });

  return { results, skippedCount };
}
