import fs from "fs";

let comp = fs.readFileSync("src/main/services/compressionEngine.ts", "utf8");
comp = comp.replace(
  /import \{[\s\S]*?\} from ["']\.\.\/compression\/macos["'];/,
  "",
);
comp = comp.replace(
  /import \{[\s\S]*?\} from ["']\.\.\/compression\/windows["'];/,
  "",
);
// Inject OSAdapter
comp = comp.replace(
  'import { GlobalStats, saveStats } from "./statsRepository";',
  'import { GlobalStats, saveStats } from "./statsRepository";\nimport { OSAdapter } from "./osAdapter";',
);

// Replace Compression Conditional
const compressRegex =
  /let osStats;\s*if\s*\(process\.platform\s*===\s*["']darwin["']\)\s*\{\s*osStats\s*=\s*await\s*macosCompress\(f\.path,\s*osOptions\);\s*\}\s*else\s*if\s*\(process\.platform\s*===\s*["']win32["']\)\s*\{\s*osStats\s*=\s*await\s*winCompress\(f\.path,\s*osOptions\);\s*\}\s*else\s*\{\s*throw new Error\("Unsupported platform"\);\s*\}/;
comp = comp.replace(
  compressRegex,
  "const osStats = await OSAdapter.compress(f.path, osOptions);",
);

// Replace Undo Conditional
const undoRegex =
  /let stats;\s*if\s*\(process\.platform\s*===\s*["']darwin["']\)\s*\{\s*stats\s*=\s*await\s*macosUndo\(f\.path\);\s*\}\s*else\s*if\s*\(process\.platform\s*===\s*["']win32["']\)\s*\{\s*stats\s*=\s*await\s*winUndo\(f\.path\);\s*\}/;
comp = comp.replace(undoRegex, "const stats = await OSAdapter.undo(f.path);");

fs.writeFileSync("src/main/services/compressionEngine.ts", comp);

let scan = fs.readFileSync("src/main/services/scannerEngine.ts", "utf8");
scan = scan.replace(
  /import \{[\s\S]*?\} from ["']\.\.\/compression\/macos["'];/,
  "",
);
scan = scan.replace(
  /import \{[\s\S]*?\} from ["']\.\.\/compression\/windows["'];/,
  "",
);

// Inject OSAdapter
scan = scan.replace(
  'import { AppState } from "./state";',
  'import { AppState } from "./state";\nimport { OSAdapter } from "./osAdapter";',
);

// Replace Scan Conditional
const scanRegex =
  /let isCompressed\s*=\s*false;\s*if\s*\(process\.platform\s*===\s*["']darwin["']\)\s*\{\s*isCompressed\s*=\s*await\s*macosIsCompressed\(fullPath\);\s*\}\s*else\s*if\s*\(process\.platform\s*===\s*["']win32["']\)\s*\{\s*isCompressed\s*=\s*await\s*winIsCompressed\(fullPath\);\s*\}/;
scan = scan.replace(
  scanRegex,
  "const isCompressed = await OSAdapter.isCompressed(fullPath);",
);

fs.writeFileSync("src/main/services/scannerEngine.ts", scan);
