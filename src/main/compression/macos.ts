import fs from 'fs';
import * as os from 'os';
import { spawn } from 'child_process';
import path from 'path';
import { app } from 'electron';

function getBasePath(): string {
  return app.isPackaged ? process.resourcesPath : app.getAppPath();
}

/**
 * Gets the disk usage of a file in bytes (based on 512-byte blocks).
 */
export async function getDiskUsage(src: string): Promise<number> {
  const stat = await fs.promises.stat(src);
  return stat.blocks * 512;
}

/**
 * Gets the actual logical uncompressed size of a file in bytes.
 */
export async function getLogicalSize(src: string): Promise<number> {
  const stat = await fs.promises.stat(src);
  return stat.size;
}

/**
 * Checks if a file is transparently compressed on macOS.
 * Uses stat -f %f to check if the 32 bit (HFS+ compression flag) is set.
 */
export async function isTransparentlyCompressed(src: string): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const detector = spawn('stat', ['-f', '%f', src]);
    let output = '';

    detector.stdout.on('data', (data) => {
      output += data.toString();
    });

    detector.stderr.on('data', (data) => reject(new Error(data.toString())));

    detector.on('close', (code) => {
      if (code !== 0) {
        return reject(new Error(`stat exited with code ${code}`));
      }
      const flags = parseInt(output.trim(), 10);
      resolve(!!(flags & 32));
    });
  });
}

/**
 * Reverts transparent compression on a file (or directory).
 */
export async function undoTransparentCompression(src: string): Promise<{originalSize: number, uncompressedSize: number}> {
  const initialDiskUsage = await getDiskUsage(src);
  
  await new Promise<void>((resolve, reject) => {
    const decompressor = spawn('afscexpand', [src]);
    if (decompressor.pid) {
      try { os.setPriority(decompressor.pid, os.constants.priority.PRIORITY_LOW); } catch (e) {}
    }
    decompressor.stderr.on('data', (data) => reject(new Error(data.toString())));
    decompressor.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`afscexpand exited with code ${code}`));
      } else {
        resolve();
      }
    });
  });

  const finalDiskUsage = await getDiskUsage(src);
  return {
    originalSize: initialDiskUsage,
    uncompressedSize: finalDiskUsage
  };
}

/**
 * Options for transparent compression.
 */
export interface CompressOptions {
  /**
   * By default, it uses the system default compression algorithm.
   * If 'zlib' is specified, it will use `-T ZLIB`.
   */
  algorithm?: 'default' | 'zlib' | 'lzfse' | 'lzvn';
  
  /**
   * The zlib compression level if using ditto or if applicable.
   * Usually 1-9.
   */
  compressionLevel?: number;
}

export interface CompressResult {
  originalSize: number;
  compressedSize: number;
  mark: boolean;
  compressed: boolean;
}

/**
 * Applies AppleFSCompression to a file using the macOS native ditto CLI.
 */
export async function transparentlyCompress(
  src: string,
  options?: CompressOptions
): Promise<CompressResult> {
  const isCompressed = await isTransparentlyCompressed(src);
  if (isCompressed) {
    return {
      originalSize: await getLogicalSize(src),
      compressedSize: await getDiskUsage(src),
      mark: false,
      compressed: false,
    };
  }

  const stat = await fs.promises.stat(src);
  if (stat.nlink > 1) {
    // Cannot safely replace files with multiple hard links without breaking them
    return {
      originalSize: await getLogicalSize(src),
      compressedSize: await getDiskUsage(src),
      mark: false,
      compressed: false,
    };
  }

  const originalDiskUsage = stat.blocks * 512;
  const logicalSize = stat.size;

  // Protect compressor from boundless execution on raw Virtual Machine slices / sparse maps
  if (originalDiskUsage < logicalSize) {
    return {
      originalSize: logicalSize,
      compressedSize: originalDiskUsage,
      mark: false,
      compressed: false,
    };
  }

  return new Promise((resolve, reject) => {
    const tmpPath = `${src}.wzd_tmp_${Math.random().toString(36).substr(2, 9)}`;
    const args = ['--hfsCompression', src, tmpPath];
    
    const compressor = spawn('ditto', args);
    if (compressor.pid) {
      try { os.setPriority(compressor.pid, os.constants.priority.PRIORITY_LOW); } catch (e) {}
    }

    let errorOutput = '';

    compressor.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    compressor.on('close', async (code) => {
      if (code !== 0) {
        // Cleanup tmp file if ditto failed mid-way
        try { await fs.promises.unlink(tmpPath); } catch (e) {}
        return reject(new Error(`ditto exited with code ${code}: ${errorOutput}`));
      }

      try {
        // Atomic swap
        await fs.promises.rename(tmpPath, src);
        
        
        const endDiskUsage = await getDiskUsage(src);
        resolve({
          originalSize: originalDiskUsage, // Return absolute physical bytes as the benchmark baseline
          compressedSize: endDiskUsage,
          mark: endDiskUsage < originalDiskUsage, 
          compressed: true,
        });
      } catch (err) {
        // Cleanup if rename fails (e.g. permissions)
        try { await fs.promises.unlink(tmpPath); } catch (e) {}
        reject(err);
      }
    });
  });
}
