import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'path';
import * as os from 'os';
import { transparentlyCompress as macosCompress, undoTransparentCompression as macosUndo, isTransparentlyCompressed as macosIsCompressed } from './compression/macos';
import { transparentlyCompress as winCompress, undoTransparentCompression as winUndo, isTransparentlyCompressed as winIsCompressed, queryCompactOS, toggleCompactOS } from './compression/windows';
import { compressJpegNative } from './compression/jpeg';
import { compressJpegToJxlNative, restoreJxlToJpegNative } from './compression/jxl';
import { CompressionStats } from '../shared/ipc-types';
import * as fs from 'fs';
import { autoUpdater } from 'electron-updater';

let mainWindow: BrowserWindow | null = null;
let isQueuePaused = false;

// Basic auto-updater config
autoUpdater.autoDownload = true;
autoUpdater.autoInstallOnAppQuit = true;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
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

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
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
    // Disable ASAR traversal to prevent Electron from treating .asar files as directories, which breaks OS-level stat calls
    process.noAsar = true;

    event.sender.send('progress-update', { phase: 'scanning', totalMB: 0, processedMB: 0, savingsMB: 0, percentage: 0, compressedCount: 0, skippedCount: 0, failedCount: 0, alreadyCompressedCount: 0, totalFiles: 0 });
    
    const allFiles: { path: string, size: number, ext: string }[] = [];
    async function walk(targetPath: string) {
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
        totalFiles
      });
    };

    updateProgress();

    // 2. Processing Phase (Concurrency Pool)
    async function processConcurrency(files: typeof allFiles, concurrency: number, worker: (file: typeof allFiles[0]) => Promise<void>) {
      let index = 0;
      async function next() {
        while (index < files.length) {
          while (isQueuePaused) {
            await new Promise(r => setTimeout(r, 500));
          }
          const file = files[index++];
          await worker(file).catch(err => {
            failedCount++;
            console.error('File process err:', err);
          });
          processedMB += file.size / (1024 * 1024);
          updateProgress();
        }
      }
      const promises = [];
      for (let i = 0; i < concurrency; i++) promises.push(next());
      await Promise.all(promises);
    }
    
    // Bind concurrency physically to 1 thread per logical core to prevent IO/CPU saturation
    const hardwareConcurrency = os.cpus().length > 0 ? os.cpus().length : 4;

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
          savingsMB += (res.originalSize - res.compressedSize) / (1024 * 1024);
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
          osStats = await macosCompress(f.path, osOptions);
        } else if (process.platform === 'win32') {
          osStats = await winCompress(f.path, osOptions);
        }
        
        if (osStats) {
          if (osStats.mark) {
            // Compression was actively applied
            if (osStats.compressedSize < osStats.originalSize) {
                originalSizeTracker += osStats.originalSize;
                compressedSizeTracker += osStats.compressedSize;
                savingsMB += (osStats.originalSize - osStats.compressedSize) / (1024 * 1024);
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
          stats = await macosUndo(f.path);
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

    event.sender.send('progress-update', { 
        phase: 'done',
        totalMB, processedMB, savingsMB, percentage: 100,
        compressedCount, skippedCount, failedCount, alreadyCompressedCount, totalFiles
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
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
