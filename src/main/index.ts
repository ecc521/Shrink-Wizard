import { app, BrowserWindow, ipcMain, dialog, shell, screen } from 'electron';
import * as path from 'path';

let isQueuePaused = false;
let currentScanToken = 0;
let currentProcessToken = 0;
const globalScannedInodes = new Set<string>();
import * as os from 'os';
import { transparentlyCompress as macosCompress, undoTransparentCompression as macosUndo, isTransparentlyCompressed as macosIsCompressed } from './compression/macos';
import { transparentlyCompress as winCompress, undoTransparentCompression as winUndo, isTransparentlyCompressed as winIsCompressed, queryCompactOS, toggleCompactOS } from './compression/windows';
import { compressJpegNative } from './compression/jpeg';
import { compressJpegToJxlNative, restoreJxlToJpegNative } from './compression/jxl';
import { CompressionStats } from '../shared/ipc-types';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { execSync } from 'child_process';
import { autoUpdater } from 'electron-updater';

// Persistent Global Stats for Free Tier Metering & Pro Status
let globalStats = { globalSavingsMB: 0, isPro: false, hasSeen5GBLimit: false };
const statsPath = path.join(app.getPath('userData'), 'shrinkwizard_stats.json');

function loadStats() {
  try {
    if (fs.existsSync(statsPath)) {
      const data = fs.readFileSync(statsPath, 'utf8');
      globalStats = { ...globalStats, ...JSON.parse(data) };
    }
  } catch (err) {
    console.error("Failed to load stats", err);
  }
}

function saveStats(addMB: number) {
  globalStats.globalSavingsMB += addMB;
  try {
    fs.writeFileSync(statsPath, JSON.stringify(globalStats));
  } catch (err) {
    console.error("Failed to save stats", err);
  }
}

// Basic auto-updater config
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

let mainWindow: BrowserWindow | null = null;

function createWindow() {
  const { width: screenWidth, height: screenHeight } = screen.getPrimaryDisplay().workAreaSize;
  const boundedWidth = Math.min(1080, screenWidth - 40);
  const boundedHeight = Math.min(770, screenHeight - 40);

  mainWindow = new BrowserWindow({
    width: boundedWidth,
    height: boundedHeight,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.cjs'),
      nodeIntegration: false,
      contextIsolation: true, // Secured standard for modern Electron
    },
  });

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../../dist/index.html'));
  }

  // IMPENETRABLE LOCK: Prevent Chromium from natively loading dropped files and causing a White Screen
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url !== 'http://localhost:5173/') {
      e.preventDefault();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  loadStats();
  createWindow();
  
  // Check for updates quietly in the background
  try {
    autoUpdater.checkForUpdatesAndNotify();
  } catch (err) {
    console.error("Auto-updater error:", err);
  }

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  
  // IPC Handlers
  ipcMain.handle('open-directory', async () => {
    const properties: any[] = process.platform === 'darwin' 
      ? ['openFile', 'openDirectory', 'multiSelections']
      : ['openDirectory', 'multiSelections'];
      
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, { properties });
    return canceled ? null : filePaths;
  });

  ipcMain.handle('open-files', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow!, {
      properties: ['openFile', 'multiSelections']
    });
    return canceled ? null : filePaths;
  });

  // OS Transparent Compression Adapters
  ipcMain.handle('transparently-compress', async (_, filePath: string): Promise<CompressionStats> => {
    let result;
    if (process.platform === 'darwin') {
      result = await macosCompress(filePath);
    } else if (process.platform === 'win32') {
      result = await winCompress(filePath);
    } else {
      throw new Error('Unsupported platform');
    }
    
    return {
      originalSize: result.originalSize,
      compressedSize: result.compressedSize,
      savedSpace: Math.max(0, result.originalSize - result.compressedSize),
      isCompressed: !!result.mark
    };
  });

  ipcMain.handle('undo-transparent-compression', async (_, filePath: string): Promise<{originalSize: number, uncompressedSize: number}> => {
    if (process.platform === 'darwin') return macosUndo(filePath);
    if (process.platform === 'win32') return winUndo(filePath);
    throw new Error('Unsupported platform');
  });

  ipcMain.handle('is-transparently-compressed', async (_, filePath: string): Promise<boolean> => {
    if (process.platform === 'darwin') return macosIsCompressed(filePath);
    if (process.platform === 'win32') return winIsCompressed(filePath);
    return false;
  });

  // JPEG Optimization Adapter
  ipcMain.handle('compress-jpeg', async (_, filePath: string) => {
    return compressJpegNative(filePath, { progressive: true, quality: 100 });
  });
  
  // JXL Adapters
  ipcMain.handle('compress-jpeg-to-jxl', async (_, filePath: string, destPath: string) => {
    const { compressJpegToJxlNative } = require('./compression/jxl');
    return compressJpegToJxlNative(filePath, destPath);
  });

  ipcMain.handle('restore-jxl-to-jpeg', async (_, filePath: string, destPath: string) => {
    const { restoreJxlToJpegNative } = require('./compression/jxl');
    return restoreJxlToJpegNative(filePath, destPath);
  });

  // Unified process interface handling recursion, images, and OS-level operations
  ipcMain.handle('process-paths', async (event, filePaths: string[], mode: 'compress' | 'restore', options: any): Promise<CompressionStats> => {
    currentProcessToken++;
    const myToken = currentProcessToken;
    // Disable ASAR traversal to prevent Electron from treating .asar files as directories, which breaks OS-level stat calls
    process.noAsar = true;

    event.sender.send('progress-update', { phase: 'scanning', totalMB: 0, processedMB: 0, savingsMB: 0, percentage: 0, compressedCount: 0, skippedCount: 0, failedCount: 0, alreadyCompressedCount: 0, totalFiles: 0 });
    
    const allFiles: { path: string, size: number, ext: string }[] = [];
    async function walk(targetPath: string) {
      if (myToken !== currentProcessToken) return;
      try {
        const stat = await fs.promises.stat(targetPath);
        if (stat.isDirectory()) {
          const entries = await fs.promises.readdir(targetPath, { withFileTypes: true });
          for (const entry of entries) {
            await walk(path.join(targetPath, entry.name));
          }
        } else if (stat.isFile()) {
           if (stat.size > 0) {
             allFiles.push({ path: targetPath, size: stat.size, ext: path.extname(targetPath).toLowerCase() });
           }
        }
      } catch(e) { console.error('Access denied:', targetPath); }
    }

    for (const p of filePaths) {
      if (myToken !== currentProcessToken) break;
      await walk(p);
    }

    const totalFiles = allFiles.length;
    const totalBytes = allFiles.reduce((acc, f) => acc + f.size, 0);
    const totalMB = totalBytes / (1024 * 1024);

    let processedMB = 0;
    let savingsMB = 0;
    let compressedCount = 0;
    let skippedCount = 0;
    let failedCount = 0;
    let alreadyCompressedCount = 0;
    
    let originalSizeTracker = 0;
    let compressedSizeTracker = 0;
    
    let sudoFailed = false;

    const updateProgress = () => {
      event.sender.send('progress-update', {
        phase: 'processing',
        totalMB,
        processedMB,
        savingsMB,
        percentage: totalBytes === 0 ? 100 : Math.min(100, Math.floor((processedMB / totalMB) * 100)),
        compressedCount,
        skippedCount,
        failedCount,
        alreadyCompressedCount,
        totalFiles,
        globalSavingsMB: globalStats.globalSavingsMB,
        sudoFailed
      });
    };

    updateProgress();

    let rootSocket: any = null;
    let rootServer: any = null;
    const workerPromises = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();
    
    if (process.platform === 'darwin' && filePaths.some((p: string) => p === '/' || p.startsWith('/Applications') || p.startsWith('/Library') || p.startsWith('/System'))) {
      const net = require('net');
      const { exec } = require('child_process');
      const globalSocketPath = '/var/run/com.shrinkwizard.sock';
      const fallbackSocketPath = path.join(os.tmpdir(), `sw-ipc-${Date.now()}-${Math.random().toString(36).substring(2)}.sock`);
      
      let useGlobalSocket = false;
      try {
        await fs.promises.access(globalSocketPath, fs.constants.W_OK);
        useGlobalSocket = true;
      } catch (e) {}

      // Shared parser for both socket modes
      const handleSocketData = (socket: any) => {
        let buffer = '';
        socket.on('data', (data: Buffer) => {
          buffer += data.toString();
          let newlineIdx;
          while ((newlineIdx = buffer.indexOf('\n')) !== -1) {
            const msgStr = buffer.slice(0, newlineIdx);
            buffer = buffer.slice(newlineIdx + 1);
            if (!msgStr.trim()) continue;
            try {
              const msg = JSON.parse(msgStr);
              if (msg.type === 'result' || msg.type === 'error') {
                const p = workerPromises.get(msg.id);
                if (p) {
                  if (msg.type === 'result') p.resolve(msg.result);
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
            rootSocket.on('error', (err: any) => {
              console.error("Failed to connect to global daemon:", err);
              reject(err);
            });
          });
        } else {
          await new Promise<void>((resolve, reject) => {
            rootServer = net.createServer((socket: any) => {
              rootSocket = socket;
              let innerBuffer = '';
              socket.on('data', (data: Buffer) => {
                // Wait for the {type: 'ready'} from the legacy worker before attaching the main parser
                if (!rootSocket.isReady) {
                    innerBuffer += data.toString();
                    let newlineIdx = innerBuffer.indexOf('\n');
                    if (newlineIdx !== -1) {
                        const msgStr = innerBuffer.slice(0, newlineIdx);
                        try {
                            if (JSON.parse(msgStr).type === 'ready') {
                                rootSocket.isReady = true;
                                handleSocketData(rootSocket);
                                // Re-emit any remaining buffer to the new handler
                                const remaining = innerBuffer.slice(newlineIdx + 1);
                                if (remaining) rootSocket.emit('data', Buffer.from(remaining));
                                resolve();
                            }
                        } catch(e) {}
                    }
                }
              });
            });

            rootServer.listen(fallbackSocketPath, () => {
              const isPackaged = app.isPackaged;
              const workerPath = isPackaged 
                ? path.join(process.resourcesPath, 'app.asar/dist-electron/main/compression/sudo-worker.cjs')
                : path.join(__dirname, 'compression', 'sudo-worker.cjs');
                
              const cmd = `osascript -e 'do shell script "ELECTRON_RUN_AS_NODE=1 \\"${process.execPath}\\" \\"${workerPath}\\" \\"${fallbackSocketPath}\\"" with administrator privileges'`;
              exec(cmd, (err: any) => {
                if (err) {
                  rootServer?.close();
                  sudoFailed = true;
                  updateProgress();
                  resolve(); // Don't crash, just proceed without elevation if they cancel
                }
              });
            });
          });
        }
      } catch (e) {
        console.error("Failed to launch or connect root worker:", e);
      }
    }

    // 2. Processing Phase (Concurrency Pool)
    async function processConcurrency(files: typeof allFiles, initialConcurrency: number, worker: (file: typeof allFiles[0]) => Promise<void>) {
      let index = 0;
      let activeWorkers = 0;

      async function next() {
        activeWorkers++;
        while (index < files.length) {
          if (myToken !== currentProcessToken) break;
          // Dynamically kill extra worker threads mid-job if the user crosses the 5GB limit
          if (!options.isPro && globalStats.globalSavingsMB >= 5000) {
            if (!globalStats.hasSeen5GBLimit) {
              globalStats.hasSeen5GBLimit = true;
              try { fs.writeFileSync(statsPath, JSON.stringify(globalStats)); } catch (e) {}
              isQueuePaused = true;
              event.sender.send('limit-reached');
            }
            if (activeWorkers > 1) {
              activeWorkers--;
              return; 
            }
          }

          while (isQueuePaused && myToken === currentProcessToken) {
            await new Promise(r => setTimeout(r, 500));
          }
          if (myToken !== currentProcessToken) break;
          const file = files[index++];
          await worker(file).catch(err => {
            failedCount++;
            console.error('File process err:', err);
          });
          processedMB += file.size / (1024 * 1024);
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
    if (!options.isPro && globalStats.globalSavingsMB >= 5000) {
      hardwareConcurrency = 1; 
    }

    await processConcurrency(allFiles, hardwareConcurrency, async (f) => {
      // Logic for Images
      if (mode === 'compress' && options.imageCompressionEnabled && (f.ext === '.jpg' || f.ext === '.jpeg')) {
        let res;
        if (options.outputFormat === 'jxl') {
          const jxlDest = f.path.replace(/\.jpe?g$/i, '.jxl');
          res = await compressJpegToJxlNative(f.path, jxlDest, { effort: options.effort });
        } else {
          res = await compressJpegNative(f.path, { quality: 100, progressive: true });
        }
        if (res && res.mark) {
          originalSizeTracker += res.originalSize;
          compressedSizeTracker += res.compressedSize;
          const savedFileMB = (res.originalSize - res.compressedSize) / (1024 * 1024);
          savingsMB += savedFileMB;
          saveStats(savedFileMB);
          compressedCount++;
        } else {
          skippedCount++;
        }
        return;
      }
      
      if (mode === 'restore' && f.ext === '.jxl') {
        const jpgDest = f.path.replace(/\.jxl$/i, '.jpg');
        const stats = await restoreJxlToJpegNative(f.path, jpgDest);
        processedMB += stats.originalSize / (1024 * 1024); // Size before decompression
        savingsMB += (stats.originalSize - stats.uncompressedSize) / (1024 * 1024);
        originalSizeTracker += stats.uncompressedSize;
        compressedSizeTracker += stats.originalSize;
        compressedCount++; // Representing decompressed successfully
        updateProgress();
        return;
      }

      // Logic for OS Transparent Compression
      if (mode === 'compress' && options.nativeAlgo !== 'off') {
        let osStats;
        let algo = options.nativeAlgo;
        if (algo === 'automatic') {
          algo = process.platform === 'darwin' ? 'default' : undefined; // winCompress defaults to LZX if undefined
        }
        const osOptions = { algorithm: algo };
        
        if (process.platform === 'darwin') {
          if (rootSocket) {
            const id = Math.random().toString(36).substring(2);
            const p = new Promise<any>((resolve, reject) => workerPromises.set(id, {resolve, reject}));
            rootSocket.write(JSON.stringify({ type: 'process', id, file: {path: f.path}, mode: 'compress', options: osOptions }) + '\n');
            const res = await p;
            if (res.action === 'skipped') osStats = { mark: true, compressed: false, originalSize: 1, compressedSize: 2 };
            else if (res.action === 'alreadyCompressed') osStats = { mark: false, compressed: false, originalSize: 0, compressedSize: 0 };
            else osStats = { mark: true, compressed: true, originalSize: res.originalSize, compressedSize: res.compressedSize };
          } else {
            osStats = await macosCompress(f.path, osOptions);
          }
        } else if (process.platform === 'win32') {
          osStats = await winCompress(f.path, osOptions);
        }
        
        if (osStats) {
          if (osStats.mark) {
            // Compression was actively applied
            if (osStats.compressedSize < osStats.originalSize) {
                originalSizeTracker += osStats.originalSize;
                compressedSizeTracker += osStats.compressedSize;
                const savedFileMB = (osStats.originalSize - osStats.compressedSize) / (1024 * 1024);
                savingsMB += savedFileMB;
                saveStats(savedFileMB);
                compressedCount++;
            } else {
                skippedCount++; // It just didn't shrink
            }
          } else {
            // Internally marked false, meaning it's already compressed
            alreadyCompressedCount++;
          }
        }
      } else {
        // Restore OS Compression
        let stats;
        if (process.platform === 'darwin') {
          if (rootSocket) {
            const id = Math.random().toString(36).substring(2);
            const p = new Promise<any>((resolve, reject) => workerPromises.set(id, {resolve, reject}));
            rootSocket.write(JSON.stringify({ type: 'process', id, file: {path: f.path}, mode: 'restore' }) + '\n');
            stats = await p;
          } else {
            stats = await macosUndo(f.path);
          }
        } else if (process.platform === 'win32') {
          stats = await winUndo(f.path);
        }
        if (stats) {
            processedMB += stats.originalSize / (1024 * 1024); // Extent before decomp
            savingsMB += (stats.originalSize - stats.uncompressedSize) / (1024 * 1024);
            originalSizeTracker += stats.uncompressedSize;
            compressedSizeTracker += stats.originalSize;
        }
        compressedCount++; // Decompressed
        updateProgress();
      }
    });

    if (rootSocket) {
      rootSocket.write(JSON.stringify({ type: 'exit' }) + '\n');
      rootServer?.close();
    }

    event.sender.send('progress-update', { 
        phase: 'done',
        totalMB, processedMB, savingsMB, percentage: 100,
        compressedCount, skippedCount, failedCount, alreadyCompressedCount, totalFiles, sudoFailed
    });

    return {
      originalSize: originalSizeTracker,
      compressedSize: compressedSizeTracker,
      savedSpace: (originalSizeTracker - compressedSizeTracker),
      isCompressed: (originalSizeTracker - compressedSizeTracker) > 0
    };
  });

  // Windows CompactOS Adapters
  
  // App Info
  ipcMain.handle('get-app-version', () => app.getVersion());
  ipcMain.handle('open-licenses', async () => {
    // Open the github licenses page as a placeholder, or could open a local file.
    await shell.openExternal('https://shrinkwizard.com'); 
  });
  ipcMain.handle('open-url', async (_, url: string) => {
    await shell.openExternal(url);
  });
  ipcMain.handle('toggle-pause', (_, paused: boolean) => {
    isQueuePaused = paused;
  });

  ipcMain.handle('abort-scan', () => {
    currentScanToken++;
  });

  ipcMain.handle('abort-process', () => {
    currentProcessToken++;
  });

  // Licensing Handlers
  ipcMain.handle('get-pro-status', () => {
    return globalStats.isPro;
  });
  
  ipcMain.handle('get-global-savings', () => {
    return globalStats.globalSavingsMB;
  });
  
  ipcMain.handle('verify-license', async (_, licenseKey: string) => {
    // TODO: Make HTTPS request to Firebase Cloud Function:
    // const res = await fetch(`https://YOUR_PROJECT.cloudfunctions.net/verifyLicense?key=${licenseKey}`);
    // const { signature, valid } = await res.json();
    // Verify `signature` locally using the embedded Ed25519 public key in src/shared/license-pubkey.json
    // crypto.verify(null, Buffer.from(licenseKey), publicKey, Buffer.from(signature, 'hex'))

    // Validating mock logic for now
    if (licenseKey.startsWith("SW-") || licenseKey === "PRO_TEST") {
       globalStats.isPro = true;
       fs.writeFileSync(statsPath, JSON.stringify(globalStats));
       return true;
    }
    return false;
  });

  // Smart Scanner APIs
  ipcMain.handle('is-admin', () => {
    try {
      if (process.platform === 'win32') {
        execSync('net session', { stdio: 'ignore' });
        return true;
      } else {
        return process.getuid ? process.getuid() === 0 : false;
      }
    } catch (e) {
      return false;
    }
  });

  ipcMain.handle('scan-system', async (event, paths: string[], options: any) => {
    if (options?.clearCache) {
      globalScannedInodes.clear();
      return { results: [], skippedCount: 0 };
    }
    
    let skippedCount = 0;
    const deflateAsync = require('util').promisify(zlib.deflate);
    
    async function isProgressiveJpeg(targetPath: string): Promise<boolean> {
      let fd;
      try {
        fd = await fs.promises.open(targetPath, 'r');
        const buf = Buffer.alloc(32768);
        const { bytesRead } = await fd.read(buf, 0, 32768, 0);
        let i = 0;
        while (i < bytesRead - 1) {
          if (buf[i] === 0xFF) {
            const marker = buf[i+1];
            if (marker === 0xC2) return true;
            if (marker === 0xC0 || marker === 0xDA) return false;
          }
          i++;
        }
      } catch (e) {} finally {
        if (fd) await fd.close().catch(()=>{});
      }
      return false;
    }

    class Semaphore {
      private queue: (() => void)[] = [];
      constructor(private max: number) {}
      async acquire() {
        if (this.max > 0) { this.max--; return; }
        await new Promise<void>(resolve => this.queue.push(resolve));
      }
      release() {
        if (this.queue.length > 0) { const resolve = this.queue.shift()!; resolve(); }
        else { this.max++; }
      }
    }
    const ioLimit = new Semaphore(os.cpus().length * 4); // Capped IO concurrency
    const statLimit = new Semaphore(64); // Reduced strict stat batching to prevent V8 LibUV threadpool queue starvation

    currentScanToken++;
    const myToken = currentScanToken;
    const results: any[] = [];
    
    for (let rootPath of paths) {
      if (rootPath.startsWith('~/')) {
        rootPath = path.join(os.homedir(), rootPath.slice(2));
      }
      
      let runOrigSize = 0; let runCurrentSavings = 0; let runMaxSavings = 0; let fileCount = 0;
      let lastEmit = Date.now();

      const walkQueue: { dir: string; depth: number }[] = [{ dir: rootPath, depth: 0 }];
      const maxWorkers = os.cpus().length > 0 ? os.cpus().length : 8; // One recursive native traversal thread per CPU core
      let activeWorkers = 0;

      await new Promise<void>((resolve) => {
        function spawnWorker() {
          if (activeWorkers >= maxWorkers || walkQueue.length === 0) return;
          activeWorkers++;

          (async () => {
            while (walkQueue.length > 0) {
              if (myToken !== currentScanToken) {
                walkQueue.length = 0;
                break;
              }
              const task = walkQueue.pop(); // LIFO array traversal acts like Depth-First to constrain queue size bounds
              if (!task) break;
              if (task.depth > 12) continue;

              let entries: any[] = [];
              try {
                await statLimit.acquire();
                entries = await fs.promises.readdir(task.dir, { withFileTypes: true });
              } catch (e) {
                skippedCount++;
              } finally {
                statLimit.release();
              }

              for (const entry of entries) {
                if (myToken !== currentScanToken) break;
                while (isQueuePaused && myToken === currentScanToken) {
                  await new Promise(r => setTimeout(r, 500));
                }
                if (myToken !== currentScanToken) break;
                
                const fullPath = path.join(task.dir, entry.name);
                if (entry.isDirectory()) {
                  walkQueue.push({ dir: fullPath, depth: task.depth + 1 });
                  spawnWorker(); // Wake up idle workers for new directories
                } else if (entry.isFile()) {
                  let stat;
                  try {
                    await statLimit.acquire();
                    stat = await fs.promises.stat(fullPath);
                  } catch (e) {
                    skippedCount++;
                    continue;
                  } finally {
                    statLimit.release();
                  }

                  if (stat.size > 0 && stat.nlink === 1) {
                    const inodeKey = `${stat.dev}-${stat.ino}`;
                    if (globalScannedInodes.has(inodeKey)) continue;
                    globalScannedInodes.add(inodeKey);

                    const physicalSize = stat.blocks !== undefined ? Math.min(stat.size, stat.blocks * 512) : stat.size;
                    if (physicalSize === 0) continue;

                    fileCount++; runOrigSize += physicalSize;
                    const ext = path.extname(fullPath).toLowerCase();
                    if (options.imageCompressionEnabled && (ext === '.jpg' || ext === '.jpeg')) {
                      await ioLimit.acquire();
                      const isProg = await isProgressiveJpeg(fullPath);
                      ioLimit.release();

                      const mozSavings = isProg ? 0 : physicalSize * 0.20;
                      const jxlSavings = isProg ? physicalSize * 0.10 : physicalSize * 0.30;
                      runCurrentSavings += options.outputFormat === 'jxl' ? jxlSavings : mozSavings;
                      runMaxSavings += jxlSavings;
                    } else {
                      let ratio = 0.35;
                      if (physicalSize > 10 * 1024 * 1024) { 
                        await ioLimit.acquire();
                        let fd;
                        try {
                          fd = await fs.promises.open(fullPath, 'r');
                          const sampleBuf = Buffer.alloc(1024 * 100);
                          const { bytesRead } = await fd.read(sampleBuf, 0, 1024 * 100, 0);
                          if (bytesRead > 0) {
                            const def = await deflateAsync(sampleBuf.subarray(0, bytesRead), { level: 1 });
                            let r = (bytesRead - def.length) / bytesRead;
                            ratio = Math.max(0, Math.min(r, 0.60));
                          }
                        } catch (e) {} finally {
                          if (fd) await fd.close().catch(()=>{});
                          ioLimit.release();
                        }
                      }
                      const nativeSavings = physicalSize * ratio;
                      runCurrentSavings += options.nativeAlgo !== 'none' ? nativeSavings : 0;
                      runMaxSavings += nativeSavings;
                    }

                    // Live Throttled UI Updates
                    const now = Date.now();
                    if (now - lastEmit > 16) {
                      lastEmit = now;
                      event.sender.send('scan-progress', {
                        path: fullPath,
                        originalMB: runOrigSize / 1048576,
                        currentSettingsSavingsMB: runCurrentSavings / 1048576,
                        maxSettingsSavingsMB: runMaxSavings / 1048576,
                        fileCount
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
        results.push({ path: rootPath, originalMB: runOrigSize / 1048576, currentSettingsSavingsMB: runCurrentSavings / 1048576, maxSettingsSavingsMB: runMaxSavings / 1048576, fileCount });
        event.sender.send('scan-update', { results, skippedCount });
      }
    }
    return { results, skippedCount };
  });
});

app.on('window-all-closed', () => {
  app.quit();
});
