import * as os from 'os';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';

function getBasePath(): string {
  return app.isPackaged ? process.resourcesPath : app.getAppPath();
}

export interface JpegCompressOptions {
  /**
   * Compression quality (0-100).
   * Note: The user requested LOSSLESS as default, but JPEG is naturally lossy.
   * MozJPEG does not have a mathematically pure "lossless" mode like jpegtran -revert,
   * but we can optimize Huffman tables and make it progressive without changing visual quality (lossless optimization).
   */
  quality?: number;
  
  /**
   * Force progressive JPEG generation
   * Default: true
   */
  progressive?: boolean;
}

export interface JpegCompressResult {
  originalSize: number;
  compressedSize: number;
  mark: boolean; // True if compression was applied saved space
}

/**
 * Encapsulates the logic of calling a jpegtran-like binary
 * (either native or our node-emscripten build).
 */
async function runJpegtran(binaryExec: string, binaryArgs: string[], src: string, options?: JpegCompressOptions): Promise<JpegCompressResult> {
  const args = [...binaryArgs];

  // jpegtran is purely lossless when optimizing huffman tables
  // We use '-copy', 'all' to strictly preserve all file metadata (ICC profiles, EXIF, XMP, etc.)
  args.push('-optimize', '-copy', 'all');
  if (!options || options.progressive !== false) {
    args.push('-progressive');
  }
  
  args.push(src); // In-place replacement requires redirecting stdout back into the file
  
  const originalSize = (await fs.promises.stat(src)).size;
  const buffers: Buffer[] = [];
  
  await new Promise<void>((resolve, reject) => {
    const proc = spawn(binaryExec, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    if (proc.pid) {
      try { os.setPriority(proc.pid, os.constants.priority.PRIORITY_LOW); } catch (e) {}
    }
    proc.stdout.on('data', (data: Buffer) => buffers.push(data));
    
    let errOut = '';
    proc.stderr.on('data', (data: Buffer) => {
      errOut += data.toString();
    });
    
    proc.on('close', (code: number | null) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`jpegtran exited with code ${code}. ${errOut}`));
      }
    });
    proc.on('error', reject);
  });
  
  const compressedBuffer = Buffer.concat(buffers);
  const compressedSize = compressedBuffer.length;
  
  if (compressedSize < originalSize && compressedSize > 0) {
    await fs.promises.writeFile(src, compressedBuffer);
    return {
      originalSize,
      compressedSize,
      mark: true
    };
  } else {
     return {
      originalSize,
      compressedSize: originalSize,
      mark: false
    };
  }
}

/**
 * Compresses a JPEG using a native jpegtran binary.
 * Throws an error if no native binary is found for the platform.
 */
export async function compressJpegNative(src: string, options?: JpegCompressOptions): Promise<JpegCompressResult> {
  const isMac = process.platform === 'darwin';
  const isWin = process.platform === 'win32';
  const isArm = process.arch === 'arm64';
  const isX64 = process.arch === 'x64';
  
  let binaryPath = '';
  
  // Resolve native binary paths
  if (isMac && isArm) {
    binaryPath = path.join(getBasePath(), 'bin/jpegtran-mac-arm64');
  } else if (isWin && isX64) {
    binaryPath = path.join(getBasePath(), 'bin/jpegtran-win-amd64.exe');
  } else if (isMac && isX64) {
    // Add support for macOS Intel if needed, assuming we have a binary
    binaryPath = path.join(getBasePath(), 'bin/jpegtran-mac-x64'); 
  }
  
  if (binaryPath && fs.existsSync(binaryPath)) {
    return await runJpegtran(binaryPath, [], src, options);
  } else {
    throw new Error(`Native jpegtran binary not found for platform ${process.platform} ${process.arch}`);
  }
}
