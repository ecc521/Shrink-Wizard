import fs from "fs";

let content = fs.readFileSync(
  "src/renderer/components/CompressionView.tsx",
  "utf8",
);

// The DropZone slice
const dropZoneStart = '<div\n                className="droppable-area"';
const dropZoneEnd =
  "Start Processing\n                    </button>\n                  </div>\n                </div>\n              )}";

const dZIdx = content.indexOf(dropZoneStart);
const dZEndIdx = content.indexOf(dropZoneEnd) + dropZoneEnd.length;

if (dZIdx !== -1 && dZEndIdx !== -1) {
  const dropZoneReplace = `<DropZone isDragActive={isDragActive} activeQueue={activeQueue} handleSelectFiles={handleSelectFiles} />`;
  content =
    content.substring(0, dZIdx) + dropZoneReplace + content.substring(dZEndIdx);
}

// The JobQueue slice
const jobQueueStart = "{/* New Central Queue Data */}";
const jobQueueEnd = "</div>\n            </div>\n          )}";

const jQIdx = content.indexOf(jobQueueStart);
const jQEndIdx = content.indexOf(jobQueueEnd) + jobQueueEnd.length;

if (jQIdx !== -1 && jQEndIdx !== -1) {
  const jobQueueReplace = `<JobQueue activeQueue={activeQueue} setActiveQueue={setActiveQueue} doneJobs={doneJobs} inProgressJobs={inProgressJobs} isCompress={isCompress} isProcessing={isProcessing} isPaused={isPaused} setIsPaused={setIsPaused} setIsProcessing={setIsProcessing} totalSavingsMB={totalSavingsMB} totalProcessedMB={totalProcessedMB} totalCompressed={totalCompressed} totalSkipped={totalSkipped} totalFailed={totalFailed} totalIncompressible={totalIncompressible} outOfSpace={outOfSpace} startQueue={startQueue} isProcessingRef={isProcessingRef} />`;
  content =
    content.substring(0, jQIdx) + jobQueueReplace + content.substring(jQEndIdx);
}

// The LimitModal slice
const limitModalStart = "<AnimatePresence>\n          {showLimitModal";
const limitModalEnd = "</AnimatePresence>";

const lMIdx = content.indexOf(limitModalStart);
const lMEndIdx = content.indexOf(limitModalEnd, lMIdx) + limitModalEnd.length;

if (lMIdx !== -1 && lMEndIdx !== -1) {
  const limitModalReplace = `<LimitModal showLimitModal={showLimitModal} setShowLimitModal={setShowLimitModal} setIsPaused={setIsPaused} />`;
  content =
    content.substring(0, lMIdx) +
    limitModalReplace +
    content.substring(lMEndIdx);
}

// Add Imports
const imports = `import { DropZone } from './compression/DropZone';\nimport { JobQueue } from './compression/JobQueue';\nimport { LimitModal } from './compression/LimitModal';\n`;
content = content.replace(
  "import { formatBytes, formatPath, formatCompactNumber } from '../utils/formatters';",
  imports +
    "import { formatBytes, formatPath, formatCompactNumber } from '../utils/formatters';",
);

fs.writeFileSync("src/renderer/components/CompressionView.tsx", content);
