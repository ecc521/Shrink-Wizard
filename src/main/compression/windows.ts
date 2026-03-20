import * as os from "os";
import { spawn } from "child_process";

export interface WindowsCompressOptions {
  /**
   * Compression algorithm to use.
   * LZX yields the smallest size but might be marginally slower.
   * XPRESS4K/8K/16K are faster but less compressed.
   * Default: LZX
   */
  algorithm?: "LZX" | "XPRESS4K" | "XPRESS8K" | "XPRESS16K";
}

export interface WindowsCompressResult {
  isCompressed: boolean;
  originalSize: number;
  compressedSize: number;
  mark?: boolean; // True if we just compressed it, false if already compressed
}

/**
 * Parses the output of compact.exe to determine existing compression state and sizes.
 */
export async function getCompressionData(
  src: string,
): Promise<WindowsCompressResult> {
  return new Promise((resolve, reject) => {
    const detector = spawn("compact", [src]);
    let output = "";

    detector.stdout.on("data", (data) => {
      output += data.toString();
    });

    detector.stderr.on("data", (data) => reject(new Error(data.toString())));

    detector.on("close", (code) => {
      // Note: compact.exe can exit with non-zero if some files aren't compressed, but still provide valid output.
      try {
        // Look for: "    12345 :      6789 = x.x to 1"
        const match = output.match(/(\d+)\s+:\s+(\d+)\s+=/);

        let originalSize = 0;
        let compressedSize = 0;

        if (match) {
          originalSize = Number(match[1]);
          compressedSize = Number(match[2]);
        }

        const isCompressed = output.includes("1 are compressed");

        resolve({
          isCompressed,
          originalSize,
          compressedSize,
        });
      } catch (e) {
        reject(new Error(`Failed to parse compact output: ${e}`));
      }
    });
  });
}

/**
 * Transparently compresses a file on Windows using compact.exe
 */
export async function transparentlyCompress(
  src: string,
  options?: WindowsCompressOptions,
): Promise<WindowsCompressResult> {
  const data = await getCompressionData(src);
  if (data.isCompressed) {
    return {
      ...data,
      mark: false,
    };
  }

  const algo = options && options.algorithm ? options.algorithm : "LZX";

  return new Promise((resolve, reject) => {
    const compressor = spawn("compact", ["/C", `/EXE:${algo}`, src]);
    if (compressor.pid) {
      try {
        os.setPriority(compressor.pid, os.constants.priority.PRIORITY_LOW);
      } catch (e) {}
    }
    let errorOutput = "";

    compressor.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    compressor.on("close", async (code) => {
      if (code !== 0 && !errorOutput.includes("OK")) {
        // Compact sometimes returns non-zero even on success, so we rely on fetching the data again
        // to verify if it worked.
      }

      try {
        const newData = await getCompressionData(src);
        resolve({
          ...newData,
          mark: true,
        });
      } catch (e) {
        reject(e);
      }
    });
  });
}

/**
 * Removes transparent compression from a file on Windows using compact.exe
 */
export async function undoTransparentCompression(
  src: string,
): Promise<{ originalSize: number; uncompressedSize: number }> {
  const initialDiskUsage = await getCompressionData(src)
    .catch(() => ({ compressedSize: 0 }))
    .then((d) => d.compressedSize);

  await new Promise<void>((resolve, reject) => {
    const decompressor = spawn("compact", ["/U", "/EXE:LZX", src]); // The algorithm flag doesn't matter much for decompression
    if (decompressor.pid) {
      try {
        os.setPriority(decompressor.pid, os.constants.priority.PRIORITY_LOW);
      } catch (e) {}
    }
    let errorOutput = "";

    decompressor.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    decompressor.on("close", (code) => {
      if (code !== 0 && errorOutput) {
        reject(new Error(`compact /U failed: ${errorOutput}`));
      } else {
        resolve();
      }
    });
  });

  const finalDiskUsage = await getCompressionData(src)
    .catch(() => ({ compressedSize: 0 }))
    .then((d) => d.compressedSize);
  return {
    originalSize: initialDiskUsage,
    uncompressedSize: finalDiskUsage,
  };
}

/**
 * Checks the status of Windows CompactOS
 * Note: Does not require admin privileges just to query
 */
export async function queryCompactOS(): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const query = spawn("compact", ["/CompactOS:query"]);
    let output = "";

    query.stdout.on("data", (data) => {
      output += data.toString();
    });

    query.on("close", (code) => {
      // Typically: "The system is in the Compact state. It will remain in this state unless an administrator changes it."
      if (
        output.includes("in the Compact state") &&
        !output.includes("not in")
      ) {
        resolve(true);
      } else {
        resolve(false);
      }
    });
  });
}

/**
 * Toggles Windows CompactOS
 * Note: Requires the Electron process to have Administrative Privileges.
 * Otherwise, it will fail.
 */
export async function toggleCompactOS(enable: boolean): Promise<void> {
  return new Promise((resolve, reject) => {
    const toggle = spawn("compact", [
      `/CompactOS:${enable ? "always" : "never"}`,
    ]);
    let output = "";
    let errorOutput = "";

    toggle.stdout.on("data", (data) => {
      output += data.toString();
    });

    toggle.stderr.on("data", (data) => {
      errorOutput += data.toString();
    });

    toggle.on("close", (code) => {
      if (code !== 0 && !output.includes("Completed")) {
        reject(
          new Error(
            `CompactOS toggle failed. Ensure you have Admin rights. Code: ${code}. ${errorOutput || output}`,
          ),
        );
      } else {
        resolve();
      }
    });
  });
}

/**
 * Checks if a specific file is transparently compressed on Windows.
 */
export async function isTransparentlyCompressed(src: string): Promise<boolean> {
  try {
    const data = await getCompressionData(src);
    return data.isCompressed;
  } catch {
    return false;
  }
}
