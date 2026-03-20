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
import { CompressionStats } from "../../shared/ipc-types";
import { execSync } from "child_process";

export interface SystemCompressorAdapter {
  compress(filePath: string, options?: any): Promise<CompressionStats>;
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
            } catch (e) {
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
