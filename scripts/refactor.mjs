import fs from "fs";

const lines = fs.readFileSync("src/renderer/App.tsx", "utf8").split("\n");

fs.mkdirSync("src/renderer/utils", { recursive: true });
fs.mkdirSync("src/renderer/components", { recursive: true });

function formatComponent(code, extraImports = "") {
  return `import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, Settings, Search, CheckCircle, AlertTriangle, ChevronRight, X, File, Zap, Info, ArrowUpDown, ChevronDown, Sparkles } from 'lucide-react';
import { formatPath, formatBytes, formatCompactNumber } from '../utils/formatters';
import type { QueueJob } from '../App';
${extraImports}

export ${code}
`;
}

// Extract the formatters block (utils)
const formattersLines = [
  "export const formatPath = (fullPath: string) => {",
  "  if (fullPath.length <= 40) return fullPath;",
  "  const parts = fullPath.split('/');",
  "  if (parts.length <= 2) return fullPath.slice(0, 15) + '...' + fullPath.slice(-15);",
  "  return `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;",
  "};",
  "",
  "export const formatBytes = (mb: number | undefined, fixed: boolean = false) => {",
  "  if (!mb) return '0 MB';",
  "  const isNegative = mb < 0;",
  "  const absMb = Math.abs(mb);",
  "",
  "  const formatted = (() => {",
  "    const rawBytes = absMb * 1024 * 1024;",
  "    if (!fixed) {",
  "       if (rawBytes >= 1000 * 1000 * 1000) return `${parseFloat((rawBytes / 1e9).toFixed(2))} GB`;",
  "       if (rawBytes >= 1000 * 1000) return `${parseFloat((rawBytes / 1e6).toFixed(1))} MB`;",
  "       if (rawBytes >= 1000) return `${parseFloat((rawBytes / 1e3).toFixed(0))} KB`;",
  "       return `${rawBytes.toFixed(0)} B`;",
  "    }",
  "    if (rawBytes >= 999.995 * 1000 * 1000) return `${(rawBytes / 1e9).toFixed(2)} GB`;",
  "    if (rawBytes >= 999.995 * 1000) return `${(rawBytes / 1e6).toFixed(2)} MB`;",
  "    if (rawBytes >= 999.995) return `${(rawBytes / 1e3).toFixed(2)} KB`;",
  "    return `${rawBytes.toFixed(0)} B`;",
  "  })();",
  "",
  "  return isNegative ? `-${formatted}` : formatted;",
  "};",
  "",
  "export const formatCompactNumber = (num: number | undefined) => {",
  "  if (num === undefined) return '0';",
  "  return Intl.NumberFormat('en-US', {",
  "    notation: 'compact',",
  "    minimumFractionDigits: 0,",
  "    maximumFractionDigits: 2,",
  "  }).format(num);",
  "};",
].join("\n");
fs.writeFileSync("src/renderer/utils/formatters.ts", formattersLines);

// Extract the Components
const CompressionViewLines = lines.slice(808, 1550).join("\n");
const SettingsViewLines = lines.slice(1550, 1773).join("\n");
const AboutViewLines = lines.slice(1773, 1935).join("\n");
const StoreViewLines = lines.slice(1935, 2056).join("\n");
const ScannerViewLines = lines.slice(2056, 2405).join("\n");

const extraStore =
  "import { httpsCallable } from 'firebase/functions';\nimport { functions } from '../firebase';";
const extraAbout =
  "import npmLicenses from '../assets/npm-licenses.json';\nimport { bundledLicenses } from '../assets/bundled-licenses';";

fs.writeFileSync(
  "src/renderer/components/CompressionView.tsx",
  formatComponent(CompressionViewLines),
);
fs.writeFileSync(
  "src/renderer/components/SettingsView.tsx",
  formatComponent(SettingsViewLines),
);
fs.writeFileSync(
  "src/renderer/components/AboutView.tsx",
  formatComponent(AboutViewLines, extraAbout),
);
fs.writeFileSync(
  "src/renderer/components/StoreView.tsx",
  formatComponent(StoreViewLines, extraStore),
);
fs.writeFileSync(
  "src/renderer/components/ScannerView.tsx",
  formatComponent(ScannerViewLines),
);

// Keep the top of the file up to line 808
const appBody = lines.slice(0, 808).join("\n");

// Clean up the `App.tsx` body by injecting imports, and removing old ones
let newAppBody = appBody.replace(
  "import './index.css';",
  "import './index.css';\n" +
    "import { formatBytes } from './utils/formatters';\n" +
    "import { CompressionView } from './components/CompressionView';\n" +
    "import { ScannerView } from './components/ScannerView';\n" +
    "import { SettingsView } from './components/SettingsView';\n" +
    "import { StoreView } from './components/StoreView';\n" +
    "import { AboutView } from './components/AboutView';\n",
);

newAppBody = newAppBody.replace(
  "import { httpsCallable } from 'firebase/functions';\n",
  "",
);
newAppBody = newAppBody.replace(
  "import { functions } from './firebase';\n",
  "",
);
newAppBody = newAppBody.replace(
  "import npmLicenses from './assets/npm-licenses.json';\n",
  "",
);
newAppBody = newAppBody.replace(
  "import { bundledLicenses } from './assets/bundled-licenses';\n",
  "",
);

// Strip formatters implicitly
newAppBody = newAppBody.replace(
  /\/\/ Helper to truncate middle of paths[\s\S]*?export interface QueueJob/,
  "export interface QueueJob",
);

fs.writeFileSync("src/renderer/App.tsx", newAppBody);
console.log("App.tsx successfully decomposed using precise offsets!");
