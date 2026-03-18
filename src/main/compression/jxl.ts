import * as os from 'os';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

function getBasePath(): string {
  return app.isPackaged ? process.resourcesPath : app.getAppPath();
}

export interface JxlCompressOptions {
  /**
   * Compression effort (1-9).
   * 7 is default (good balance), 9 is max but extremely slow.
   */
  effort?: number;
}

export interface JxlCompressResult {
  originalSize: number;
  compressedSize: number;
  mark: boolean; // True if compression was applied and saved space
}

/**
 * Resolves the path to the bundled cjxl executable.
 */
function getCjxlBinaryPath(): string {
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';
  const isX64 = process.arch === 'x64';
  const isArm64 = process.arch === 'arm64';
  
  if (isMac && isArm64) {
    return path.join(getBasePath(), 'bin/jxl-mac-arm64/cjxl');
  } else if (isMac && isX64) {
    return path.join(getBasePath(), 'bin/jxl-mac-x64/cjxl');
  } else if (isWin && isX64) {
    return path.join(getBasePath(), 'bin/cjxl-win-amd64.exe');
  }
  
  throw new Error(`No native cjxl binary found for platform ${process.platform} ${process.arch}`);
}

/**
 * Resolves the path to the bundled djxl executable.
 */
function getDjxlBinaryPath(): string {
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';
  const isX64 = process.arch === 'x64';
  const isArm64 = process.arch === 'arm64';

  if (isMac && isArm64) {
    return path.join(getBasePath(), 'bin/jxl-mac-arm64/djxl');
  } else if (isMac && isX64) {
    return path.join(getBasePath(), 'bin/jxl-mac-x64/djxl');
  } else if (isWin && isX64) {
    return path.join(getBasePath(), 'bin/djxl-win-amd64.exe');
  }
  
  throw new Error(`No native djxl binary found for platform ${process.platform} ${process.arch}`);
}

/**
 * Compresses a JPEG to a newly created JXL file.
 * Requires `destPath` to be a valid path ending in .jxl.
 * If the resulting .jxl is mathematically successfully created and smaller than the original JPEG,
 * the original JPEG is unlinked (deleted) to complete the lossless archival.
 */
export async function compressJpegToJxlNative(srcPath: string, destPath: string, options?: JxlCompressOptions): Promise<JxlCompressResult> {
  const cjxlPath = getCjxlBinaryPath();
  const effort = (options && options.effort) ? options.effort : 7;
  
  // -d 0 enforces mathematically pure lossless construction (pixel-perfect AND metadata preservation).
  // -e sets the effort level setting (1-9).
  const args = [srcPath, destPath, '-d', '0', '-e', effort.toString()];

  const originalSize = (await fs.promises.stat(srcPath)).size;

  await new Promise<void>((resolve, reject) => {
    // Pass DYLD_LIBRARY_PATH if we are on macOS using our dylibbundler bundle
    const env = { ...process.env };
    if (process.platform === 'darwin') {
      env.DYLD_LIBRARY_PATH = path.join(path.dirname(cjxlPath), 'libs');
    }

    const proc = spawn(cjxlPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    if (proc.pid) {
      try { os.setPriority(proc.pid, os.constants.priority.PRIORITY_LOW); } catch (e) {}
    }
    
    let errOut = '';
    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => {
        errOut += data.toString();
      });
    }
    
    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`cjxl exited with code ${code}. ${errOut}`));
      }
    });
    proc.on('error', reject);
  });

  const compressedSize = (await fs.promises.stat(destPath)).size;

  // Verification step
  if (compressedSize < originalSize && compressedSize > 0) {
    await fs.promises.unlink(srcPath); // Success! Delete the legacy JPEG.
    return {
      originalSize,
      compressedSize,
      mark: true
    };
  } else {
    // If it's somehow larger, or 0 bytes, we delete the jxl and keep the original jpeg to maintain transparency.
    await fs.promises.unlink(destPath).catch(() => {});
    return {
      originalSize,
      compressedSize: originalSize,
      mark: false
    };
  }
}

/**
 * Restores a JXL file back to its exact bit-for-bit mathematical JPEG form.
 * After Djxl cleanly writes the new .jpg, the .jxl is deleted.
 */
export async function restoreJxlToJpegNative(srcPath: string, destPath: string): Promise<{originalSize: number, uncompressedSize: number}> {
  const djxlPath = getDjxlBinaryPath();
  
  const originalSize = (await fs.promises.stat(srcPath)).size;
  
  const args = [srcPath, destPath];

  await new Promise<void>((resolve, reject) => {
    const env = { ...process.env };
    if (process.platform === 'darwin') {
      env.DYLD_LIBRARY_PATH = path.join(path.dirname(djxlPath), 'libs');
    }

    const proc = spawn(djxlPath, args, { env, stdio: ['ignore', 'pipe', 'pipe'] });
    if (proc.pid) {
      try { os.setPriority(proc.pid, os.constants.priority.PRIORITY_LOW); } catch (e) {}
    }
    
    let errOut = '';
    if (proc.stderr) {
      proc.stderr.on('data', (data: Buffer) => {
        errOut += data.toString();
      });
    }
    
    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`djxl exited with code ${code}. ${errOut}`));
      }
    });
    proc.on('error', reject);
  });

  // Ensure the restored file exists and is valid, then remove the JXL
  const restoredStats = await fs.promises.stat(destPath);
  if (restoredStats.size > 0) {
    await fs.promises.unlink(srcPath);
    return {
      originalSize,
      uncompressedSize: restoredStats.size
    };
  } else {
    throw new Error('djxl succeeded but restored file is 0 bytes');
  }
}
