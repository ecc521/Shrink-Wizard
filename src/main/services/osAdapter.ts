import {
  transparentlyCompress as macosCompress,
  undoTransparentCompression as macosUndo,
  isTransparentlyCompressed as macosIsCompressed,
} from "../compression/macos";
import {
  transparentlyCompress as winCompress,
  undoTransparentCompression as winUndo,
  isTransparentlyCompressed as winIsCompressed,
  queryCompactOS,
  toggleCompactOS,
} from "../compression/windows";
import { CompressionStats, ProcessOptions } from "../../shared/ipc-types";
import { execSync } from "node:child_process";
import * as os from "node:os";

export function getOptimalConcurrency(): number {
  const hardwareConcurrency = os.cpus().length > 0 ? os.cpus().length : 4;

  try {
    if (process.platform === "darwin") {
      const nLevelsStr = execSync("sysctl -n hw.nperflevels", {
        encoding: "utf8",
        stdio: "pipe",
      }).trim();
      const nLevels = parseInt(nLevelsStr, 10);

      if (!isNaN(nLevels) && nLevels > 1) {
        // macOS handles performance levels 0 (P-cores) to N (E-cores). We want the lowest tier (N-1).
        const lowestTierStr = execSync(
          `sysctl -n hw.perflevel${nLevels - 1}.logicalcpu`,
          { encoding: "utf8", stdio: "pipe" },
        ).trim();
        const lowestTier = parseInt(lowestTierStr, 10);

        if (!isNaN(lowestTier) && lowestTier > 0) {
          // Respect the lowest tier if it makes up at least 50% of the total logical hardware concurrency
          if (lowestTier >= hardwareConcurrency / 2) {
            return lowestTier;
          }
        }
      }
    } else if (process.platform === "win32") {
      // On Windows it is much harder to synchronously fetch P/E core layouts without a 500ms+ PowerShell WMI penalty.
      // As a fallback heuristic matching the user request, if there are a massive number of cores (>= 12), we can
      // assume big.LITTLE or just bound the concurrency to half to prevent hyper-thread/e-core saturation stall.
      if (hardwareConcurrency >= 12) {
        return Math.floor(hardwareConcurrency / 2);
      }
    }
  } catch {
    // Ignore and fallback
  }

  return hardwareConcurrency;
}

export interface SystemCompressorAdapter {
  compress(
    filePath: string,
    options?: ProcessOptions,
  ): Promise<CompressionStats>;
  undo(
    filePath: string,
  ): Promise<{ originalSize: number; uncompressedSize: number }>;
  isCompressed(filePath: string): Promise<boolean>;
  queryCompactOS?(): Promise<boolean | null>;
  toggleCompactOS?(enable: boolean): Promise<void>;
  isAdmin(): boolean;
}

export const OSAdapter: SystemCompressorAdapter =
  process.platform === "darwin"
    ? {
        compress: async (filePath, options) => {
          const res = await macosCompress(filePath, options);
          return {
            originalSize: res.originalSize,
            compressedSize: res.compressedSize,
            savedSpace: Math.max(0, res.originalSize - res.compressedSize),
            isCompressed: !!res.mark,
          };
        },
        undo: macosUndo,
        isCompressed: macosIsCompressed,
        isAdmin: () => (process.getuid ? process.getuid() === 0 : false),
      }
    : process.platform === "win32"
      ? {
          compress: async (filePath, options) => {
            const res = await winCompress(filePath, options);
            return {
              originalSize: res.originalSize,
              compressedSize: res.compressedSize,
              savedSpace: Math.max(0, res.originalSize - res.compressedSize),
              isCompressed: !!res.mark,
            };
          },
          undo: winUndo,
          isCompressed: winIsCompressed,
          queryCompactOS,
          toggleCompactOS,
          isAdmin: () => {
            try {
              execSync("net session", { stdio: "ignore" });
              return true;
            } catch {
              return false;
            }
          },
        }
      : {
          // Fallback or Linux
          compress: async () => ({
            originalSize: 0,
            compressedSize: 0,
            savedSpace: 0,
            isCompressed: false,
          }),
          undo: async () => ({ originalSize: 0, uncompressedSize: 0 }),
          isCompressed: async () => false,
          isAdmin: () => false,
        };
