export const CompressionMultipliers = {
  images: {
    jxl: 1.0, // Baseline maximum potential savings for images
    jpeg: 0.6, // Standard JPEG compresses ~40% worse than JXL mathematically
  },
  files: {
    // macOS / Apple Algorithms
    lzfse: 1.0,
    zlib: 1.0,
    lzvn: 0.8,
    // Windows Algorithms
    lzx: 1.0,
    xpress16k: 0.9,
    xpress8k: 0.75,
    xpress4k: 0.5,
    // System Defaults
    automatic: 1.0,
    off: 0,
    none: 0,
  },
};
