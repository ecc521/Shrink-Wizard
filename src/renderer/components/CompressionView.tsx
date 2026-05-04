import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HardDrive,
  AlertTriangle,
  File,
  Zap,
  Info,
  Settings,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatBytes } from "../utils/formatters";
import { CompressionMultipliers } from "../../shared/compressionMultipliers";
import type { QueueJob, ProgressData } from "../../shared/ipc-types";
import { JobQueue } from "./compression/JobQueue";
import { LimitModal } from "./compression/LimitModal";

export function CompressionView({
  activeTab,
  outputFormat,
  nativeAlgo,
  imageCompressionEnabled,
  jxlEffort,
  isPro,
  globalSavingsMB,
  dailySavingsMB,
  hasSeenTrialEnd,
  pendingScannerPaths,
  setPendingScannerPaths,
  autoStartCompression,
  setAutoStartCompression,
  scannerEstimates,
  setScannerEstimates,
  isAdminUser,
  onProcessingChange,
  onSavingsUpdate,
  platform,
  setOutputFormat,
  setNativeAlgo,
  fileCompressionEnabled,
  setFileCompressionEnabled,
  setImageCompressionEnabled,
  setJxlEffort,
}: {
  activeTab: "compress" | "decompress";
  outputFormat: "jxl" | "jpeg" | "original";
  nativeAlgo:
    | "automatic"
    | "lzvn"
    | "lzfse"
    | "zlib"
    | "off"
    | "none"
    | "LZX"
    | "XPRESS16K"
    | "XPRESS8K"
    | "XPRESS4K";
  imageCompressionEnabled: boolean;
  jxlEffort: number;
  isPro?: boolean;
  globalSavingsMB?: number;
  dailySavingsMB?: number;
  hasSeenTrialEnd?: boolean;
  pendingScannerPaths?: string[];
  setPendingScannerPaths?: (paths: string[]) => void;
  autoStartCompression?: boolean;
  setAutoStartCompression?: (val: boolean) => void;
  scannerEstimates?: { imageMB: number; fileMB: number } | null;
  setScannerEstimates?: (v: { imageMB: number; fileMB: number } | null) => void;
  isAdminUser?: boolean;
  onProcessingChange: (processing: boolean) => void;
  onSavingsUpdate?: (mb: number) => void;
  platform: string;
  setOutputFormat: (v: "jxl" | "jpeg" | "original") => void;
  setNativeAlgo: (
    v:
      | "automatic"
      | "lzvn"
      | "lzfse"
      | "zlib"
      | "off"
      | "none"
      | "LZX"
      | "XPRESS16K"
      | "XPRESS8K"
      | "XPRESS4K",
  ) => void;
  fileCompressionEnabled: boolean;
  setFileCompressionEnabled: (v: boolean) => void;
  setImageCompressionEnabled: (v: boolean) => void;
  setJxlEffort: (v: number) => void;
}) {
  const [activeQueue, setActiveQueue] = useState<QueueJob[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [limitType, setLimitType] = useState<"trial" | "daily">("trial");
  const [sudoFailed, setSudoFailed] = useState(false);
  const [skippedSystemFiles, setSkippedSystemFiles] = useState(false);
  const [outOfSpace, setOutOfSpace] = useState(false);
  const [isDraggingOverTarget, setIsDraggingOverTarget] = useState(false);
  const [showAdvancedSettings, setShowAdvancedSettings] = useState(false);
  const isProcessingRef = useRef(false);
  const skipNextEstimateClearRef = useRef(false);

  let estimateAmount = 0;
  if (scannerEstimates && activeQueue.some((j) => j.status === "pending")) {
    if (imageCompressionEnabled) {
      estimateAmount +=
        scannerEstimates.imageMB *
        (CompressionMultipliers.images[
          outputFormat === "jxl" ? "jxl" : "jpeg"
        ] || 1);
    }
    if (fileCompressionEnabled) {
      const algoKey =
        nativeAlgo === "automatic" && platform === "darwin"
          ? "lzfse"
          : nativeAlgo === "automatic" && platform === "win32"
            ? "lzx"
            : nativeAlgo.toLowerCase();
      estimateAmount +=
        scannerEstimates.fileMB *
        ((CompressionMultipliers.files as any)[algoKey] ?? 1.0);
    }
  }

  const getAlgoDescription = () => {
    switch (nativeAlgo) {
      case "automatic":
        return "We let your OS pick the optimal algorithm.";
      case "LZX":
        return "Highest compression, significantly reduced speed. Best for archival.";
      case "XPRESS16K":
        return "High compression, reduced speed.";
      case "XPRESS8K":
        return "Balanced compression and speed.";
      case "XPRESS4K":
        return "Light compression, maximum speed.";
      case "lzfse":
        return "Balanced compression and speed (Apple default).";
      case "zlib":
        return "Highest compression, reduced speed. Used for maximum space savings.";
      case "lzvn":
        return "Light compression, maximum speed.";
      case "off":
        return "Disables transparent compression entirely.";
      default:
        return "Higher compression saves more space but is slower to process.";
    }
  };

  // maxSlots has been intentionally removed in favor of CSS infinite scroll boundaries
  useEffect(() => {
    //
  }, []);

  useEffect(() => {
    onProcessingChange(isProcessing);
  }, [isProcessing, onProcessingChange]);
  const isCompress = activeTab === "compress";

  useEffect(() => {
    if (
      pendingScannerPaths &&
      pendingScannerPaths.length > 0 &&
      setPendingScannerPaths
    ) {
      const newJobs: QueueJob[] = pendingScannerPaths.map((f: string) => ({
        id: Math.random().toString(36).substring(7),
        path: f,
        mode: isCompress ? "compress" : "restore",
        status: "pending",
        progressData: null,
      }));
      setActiveQueue((prev) => [...prev, ...newJobs]);
      setPendingScannerPaths([]);
      skipNextEstimateClearRef.current = true;
    }
  }, [pendingScannerPaths, setPendingScannerPaths, isCompress]);

  useEffect(() => {
    if (
      autoStartCompression &&
      activeQueue.some((j) => j.status === "pending") &&
      !isProcessing &&
      setAutoStartCompression
    ) {
      setAutoStartCompression(false);
      startQueue();
    }
  }, [
    autoStartCompression,
    activeQueue,
    isProcessing,
    setAutoStartCompression,
  ]);

  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (/*e: MouseEvent*/) => {
      // Logic for divider dragging was disabled
    };

    const handleMouseUp = () => setIsDraggingDivider(false);

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [isDraggingDivider]);

  useEffect(() => {
    if (window.electron) {
      window.electron.onProgress((data: ProgressData) => {
        if (data.globalSavingsMB !== undefined) {
          onSavingsUpdate?.(data.globalSavingsMB);
        }
        if (data.sudoFailed !== undefined && data.sudoFailed) {
          setSudoFailed(true);
        }
        if (data.outOfSpace !== undefined && data.outOfSpace) {
          setOutOfSpace(true);
        }
        if (data.skippedSystemFiles !== undefined && data.skippedSystemFiles) {
          setSkippedSystemFiles(true);
        }
        setActiveQueue((prev) =>
          prev.map((job) => {
            if (job.status === "processing" || job.status === "pending") {
              return { ...job, status: "processing", progressData: data };
            }
            return job;
          }),
        );
      });

      window.electron.onLimitReached((type: "trial" | "daily") => {
        setIsPaused(true);
        setLimitType(type);
        setShowLimitModal(true);
      });

      return () => {
        window.electron.removeProgressListeners();
        window.electron.removeLimitReachedListeners();
        window.electron.removeScanProgressListeners();
      };
    }
  }, []);

  useEffect(() => {
    if (window.electron) {
      window.electron.onScanProgress((data: any) => {
        // Only update if we have a valid result and are in the middle of a manual estimate scan
        // This provides the "ticking up" effect the user requested.
        if (data && (data.imageMaxSavingsMB > 0 || data.fileMaxSavingsMB > 0)) {
          setScannerEstimates?.({
            imageMB: data.imageMaxSavingsMB,
            fileMB: data.fileMaxSavingsMB,
          });
          // Ensure we don't clear this estimate immediately on the next render
          skipNextEstimateClearRef.current = true;
        }
      });
    }
  }, [setScannerEstimates]);

  // Clear estimates if the pending queue changes (e.g. items added or removed)
  useEffect(() => {
    if (skipNextEstimateClearRef.current) {
      skipNextEstimateClearRef.current = false;
      return;
    }
    setScannerEstimates?.(null);
  }, [activeQueue.filter((j) => j.status === "pending").length]);

  const isWin = window.electron?.platform === "win32";
  const needsElevation = activeQueue.some((j) => {
    if (isWin) {
      // Normalize slashes for safety
      const forwardAuth = j.path.replace(/\\/g, "/").toLowerCase();
      return (
        j.path === "C:\\" ||
        j.path === "C:/" ||
        forwardAuth.startsWith("c:/windows") ||
        forwardAuth.startsWith("c:/program files")
      );
    }
    return (
      j.path === "/" ||
      j.path.startsWith("/Applications") ||
      j.path.startsWith("/System") ||
      j.path.startsWith("/Library")
    );
  });

  const totalProcessedMB = activeQueue.reduce(
    (acc, job) => acc + (job.progressData?.processedMB || 0),
    0,
  );
  const totalSavingsMB = activeQueue.reduce(
    (acc, job) => acc + (job.progressData?.savingsMB || 0),
    0,
  );
  const totalCompressed = activeQueue.reduce(
    (acc, job) => acc + (job.progressData?.compressedCount || 0),
    0,
  );
  const totalSkipped = activeQueue.reduce(
    (acc, job) => acc + (job.progressData?.skippedCount || 0),
    0,
  );
  const totalSkippedMB = activeQueue.reduce(
    (acc, job) => acc + (job.progressData?.skippedMB || 0),
    0,
  );
  const totalFailed = activeQueue.reduce(
    (acc, job) => acc + (job.progressData?.failedCount || 0),
    0,
  );
  const totalIncompressible = activeQueue.reduce(
    (acc, job) => acc + (job.progressData?.alreadyCompressedCount || 0),
    0,
  );

  // If negative savings (uncompressing), it's using more space, so we still show %, but perhaps negative
  // 97 KB (-15%)

  const inProgressJobs = activeQueue.filter((j) => j.status !== "done");
  const doneJobs = activeQueue.filter((j) => j.status === "done");

  const handleSelectFiles = async (filesOnly: boolean = false) => {
    if (window.electron) {
      const files = filesOnly
        ? await window.electron.openFiles()
        : await window.electron.openDirectory();
      if (files && files.length > 0) {
        const newJobs: QueueJob[] = files.map((f: string) => ({
          id: Math.random().toString(36).substring(7),
          path: f,
          mode: isCompress ? "compress" : "restore",
          status: "pending",
          progressData: null,
        }));
        setActiveQueue((prev) => [...prev, ...newJobs]);
      }
    }
  };

  const handleFixNow = () => {
    if (window.electron) window.electron.abortProcess();
    isProcessingRef.current = false;
    setIsProcessing(false);
    setActiveQueue((prev) =>
      prev.map((job) => ({
        ...job,
        status: "pending",
        progressData: null,
      })),
    );
    setSudoFailed(false);
    setSkippedSystemFiles(false);
    setOutOfSpace(false);
    setTimeout(() => {
      startQueue();
    }, 250);
  };

  const startQueue = async () => {
    setSudoFailed(false);
    setSkippedSystemFiles(false);
    setOutOfSpace(false);
    if (isProcessingRef.current) return;
    if (!window.electron) return;

    isProcessingRef.current = true;
    setIsProcessing(true);

    const getNextJob = () =>
      new Promise<QueueJob | undefined>((resolve) => {
        let jobTarget: QueueJob | undefined;
        setActiveQueue((prev) => {
          const nextJob = prev.find((j) => j.status === "pending");
          if (!jobTarget) {
            jobTarget = nextJob;
            setTimeout(() => resolve(nextJob), 0);
          }
          if (nextJob) {
            return prev.map((j) =>
              j.id === nextJob.id
                ? {
                    ...j,
                    status: "processing",
                    progressData: {
                      phase: "scanning",
                      totalMB: 0,
                      processedMB: 0,
                      savingsMB: 0,
                      percentage: 0,
                      compressedCount: 0,
                      skippedCount: 0,
                      skippedMB: 0,
                      failedCount: 0,
                      alreadyCompressedCount: 0,
                      totalFiles: 0,
                    },
                  }
                : j,
            );
          }
          return prev;
        });
      });

    while (isProcessingRef.current) {
      const nextJob = await getNextJob();

      if (!nextJob) {
        isProcessingRef.current = false;
        setIsProcessing(false);
        break;
      }

      if (window.electron) window.electron.removeProgressListeners();
      window.electron.onProgress((data: ProgressData) => {
        if (data.globalSavingsMB !== undefined) {
          onSavingsUpdate?.(data.globalSavingsMB);
        }
        if (data.sudoFailed) setSudoFailed(true);
        if (data.outOfSpace) setOutOfSpace(true);
        if (data.skippedSystemFiles) setSkippedSystemFiles(true);
        setActiveQueue((prev) =>
          prev.map((j) =>
            j.id === nextJob!.id ? { ...j, progressData: data } : j,
          ),
        );
      });

      try {
        await window.electron.processPaths([nextJob.path], nextJob.mode, {
          outputFormat,
          nativeAlgo: fileCompressionEnabled ? nativeAlgo : "off",
          imageCompressionEnabled,
          effort: jxlEffort,
          isPro,
        });

        setActiveQueue((prev) =>
          prev.map((j) =>
            j.id === nextJob!.id
              ? {
                  ...j,
                  status: "done",
                  progressData: j.progressData
                    ? { ...j.progressData, phase: "done", percentage: 100 }
                    : null,
                }
              : j,
          ),
        );
      } catch (err) {
        console.error("Process error:", err);
        setActiveQueue((prev) =>
          prev.map((j) =>
            j.id === nextJob!.id ? { ...j, status: "failed" } : j,
          ),
        );
      } finally {
        if (window.electron) window.electron.removeProgressListeners();
      }
    }

    // Once loop terminates normally
    if (window.electron) {
      window.electron.removeProgressListeners();
    }
  };

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <motion.div
        className="view-container"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          scrollbarGutter: "stable",
          position: "relative",
          padding:
            "0 var(--main-padding, 40px) var(--main-padding, 30px) var(--main-padding, 40px)",
        }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDraggingOverTarget) setIsDraggingOverTarget(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDraggingOverTarget(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          // Ensure we don't flicker on child elements by checking relatedTarget
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDraggingOverTarget(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOverTarget(false);

          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // Electron v30+ with context isolation strips the .path property from the native HTML5 File struct during synthetic React drag events.
            // We must pipe the raw File object over the Preload boundary via webUtils to legally extract its absolute path.
            const paths = Array.from(e.dataTransfer.files).map((f) =>
              window.electron.getPathForFile(f as File),
            );

            const newJobs: QueueJob[] = paths.map((p) => ({
              id: Math.random().toString(36).substring(7),
              path: p,
              mode: isCompress ? "compress" : "restore",
              status: "pending",
              progressData: null,
            }));
            setActiveQueue((prev) => [...prev, ...newJobs]);
          }
        }}
      >
        <AnimatePresence>
          {isDraggingOverTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: isCompress
                  ? "rgba(99, 102, 241, 0.1)"
                  : "rgba(245, 158, 11, 0.1)",
                backdropFilter: "blur(4px)",
                zIndex: 50,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "column",
                gap: "16px",
                border: `4px dashed ${isCompress ? "var(--accent-primary)" : "var(--warning)"}`,
                borderRadius: "8px",
                margin: "16px",
                pointerEvents: "none", // lets the drop event hit the container underneath
              }}
            >
              <div
                style={{
                  background: "var(--bg-root)",
                  padding: "24px",
                  borderRadius: "50%",
                  boxShadow: "0 10px 25px rgba(0,0,0,0.5)",
                }}
              >
                <HardDrive
                  size={64}
                  color={
                    isCompress ? "var(--accent-primary)" : "var(--warning)"
                  }
                />
              </div>
              <h2
                style={{
                  color: "var(--text-primary)",
                  fontSize: "28px",
                  fontWeight: "bold",
                  textShadow: "0 2px 4px rgba(0,0,0,0.5)",
                }}
              >
                Drop to {isCompress ? "Compress" : "Decompress"}
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        <div
          className="view-header"
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <div>
            <h1
              className="view-title"
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              {isCompress ? (
                <>
                  <HardDrive className="text-primary" /> Shrink Your Data
                  {!isPro && (
                    <div
                      title={
                        !hasSeenTrialEnd
                          ? `Free Trial: ${formatBytes(globalSavingsMB, false)} / 3.00 GB`
                          : `Daily Quota: ${formatBytes(dailySavingsMB, false)} / 1.00 GB`
                      }
                      style={{
                        marginLeft: "12px",
                        background: "var(--bg-secondary)",
                        border: "1px solid var(--border)",
                        borderRadius: "12px",
                        padding: "4px 10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        fontSize: "12px",
                        cursor: "help",
                        opacity: 0.8,
                        transition: "opacity 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "0.8")
                      }
                    >
                      <div
                        style={{
                          width: "40px",
                          height: "4px",
                          background: "var(--bg-tertiary)",
                          borderRadius: "2px",
                          overflow: "hidden",
                        }}
                      >
                        <div
                          style={{
                            width: !hasSeenTrialEnd
                              ? `${Math.min(100, (globalSavingsMB / 3000) * 100)}%`
                              : `${Math.min(100, (dailySavingsMB / 1000) * 100)}%`,
                            height: "100%",
                            background: "var(--accent-primary)",
                          }}
                        />
                      </div>
                      <span
                        style={{
                          color: "var(--text-secondary)",
                          fontWeight: 600,
                        }}
                      >
                        {!hasSeenTrialEnd
                          ? `${formatBytes(globalSavingsMB || 0, false)} / 3 GB (Trial)`
                          : `${formatBytes(dailySavingsMB || 0, false)} / 1 GB (Daily)`}
                      </span>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <Zap className="text-secondary" /> Decompress Your Data
                  <div
                    title="Decompression is always free and unlimited."
                    style={{
                      marginLeft: "12px",
                      background: "rgba(16, 185, 129, 0.1)",
                      border: "1px solid rgba(16, 185, 129, 0.2)",
                      borderRadius: "12px",
                      padding: "2px 8px",
                      color: "var(--success)",
                      fontSize: "11px",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      cursor: "help",
                    }}
                  >
                    Free
                  </div>
                </>
              )}
            </h1>
            <p className="view-subtitle" style={{ maxWidth: "600px" }}>
              {isCompress
                ? "Drop files, folders, photos, and/or applications here to shrink them gracefully."
                : "Drop previously compressed files here to reverse the compression."}
            </p>
          </div>
        </div>

        {/* Warnings */}
        {(needsElevation && !isAdminUser) || sudoFailed ? (
          <div
            style={{
              marginBottom: "24px",
              padding: "12px 16px",
              background: "rgba(245, 158, 11, 0.1)",
              border: "1px solid var(--warning)",
              borderRadius: "8px",
              color: "var(--warning)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <AlertTriangle size={18} />
              <span style={{ fontSize: "14px", lineHeight: "1.5" }}>
                {sudoFailed ? (
                  <>
                    {formatBytes(totalSkippedMB, true)} of files skipped due to{" "}
                    <strong>missing Admin permissions.</strong>
                  </>
                ) : (
                  <>
                    <strong>
                      Some of these files require Admin permissions.
                    </strong>{" "}
                    {window.electron?.platform === "win32"
                      ? "Please completely restart Shrink Wizard and select 'Run as Administrator'."
                      : "You will be asked for an Admin Login."}
                  </>
                )}
              </span>
            </div>
            {sudoFailed && (
              <button
                className="btn"
                style={{
                  background: "transparent",
                  border: "1px solid var(--warning)",
                  color: "var(--warning)",
                  padding: "6px 16px",
                  fontSize: "13px",
                  fontWeight: "bold",
                }}
                onClick={handleFixNow}
              >
                Fix Now
              </button>
            )}
          </div>
        ) : null}

        {skippedSystemFiles ? (
          <div
            style={{
              marginBottom: "24px",
              padding: "12px 16px",
              background: "rgba(99, 102, 241, 0.1)",
              border: "1px solid var(--accent-primary)",
              borderRadius: "8px",
              color: "var(--text-primary)",
              display: "flex",
              alignItems: "center",
              gap: "16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Info
                size={18}
                color="var(--accent-primary)"
                style={{ flexShrink: 0 }}
              />
              <span style={{ fontSize: "14px", lineHeight: "1.5" }}>
                <strong>System Files Skipped.</strong> Your drop included
                Windows OS files which were skipped. Use the dedicated{" "}
                <strong>System Storage</strong> tool in the sidebar instead!
              </span>
            </div>
          </div>
        ) : null}

        {/* 2-Column Main Layout */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            flex: 1,
            minHeight: 0,
            gap: "24px",
          }}
        >
          {/* Left Column: Queue */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              flex: "1 1 400px",
            }}
          >
            <JobQueue
              activeQueue={activeQueue}
              setActiveQueue={setActiveQueue}
              doneJobs={doneJobs}
              inProgressJobs={inProgressJobs}
              isCompress={isCompress}
              isProcessing={isProcessing}
              isPaused={isPaused}
              setIsPaused={setIsPaused}
              setIsProcessing={setIsProcessing}
              totalSavingsMB={totalSavingsMB}
              totalProcessedMB={totalProcessedMB}
              totalCompressed={totalCompressed}
              totalSkipped={totalSkipped}
              totalFailed={totalFailed}
              totalIncompressible={totalIncompressible}
              outOfSpace={outOfSpace}
              startQueue={startQueue}
              isProcessingRef={isProcessingRef}
              handleSelectFiles={handleSelectFiles}
            />
          </div>

          {/* Right Column: Settings and Action Buttons */}
          <div
            className="compression-right-column"
            style={{
              overflowY: "auto",
              paddingRight: "8px",
            }}
          >
            {/* Settings Box */}
            <div
              style={{
                background: "var(--bg-tertiary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-xl)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                boxShadow: "var(--shadow-sm)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }}
              >
                <div
                  className="toggle-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {isCompress ? "Image Compression" : "Decompress Images"}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {isCompress
                        ? "Losslessly shrink images"
                        : "Restore JXL images to JPEG"}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      background: "var(--bg-secondary)",
                      borderRadius: "20px",
                      padding: "4px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <button
                      className={`toggle-btn ${imageCompressionEnabled ? "btn-on" : ""}`}
                      onClick={() => setImageCompressionEnabled(true)}
                      style={{
                        background: imageCompressionEnabled
                          ? "var(--accent-primary)"
                          : "transparent",
                        color: imageCompressionEnabled
                          ? "white"
                          : "var(--text-secondary)",
                        border: "none",
                        boxShadow: imageCompressionEnabled
                          ? "0 0 12px var(--accent-glow)"
                          : "none",
                        padding: "6px 12px",
                      }}
                    >
                      Yes
                    </button>
                    <button
                      className={`toggle-btn ${!imageCompressionEnabled ? "btn-off" : ""}`}
                      onClick={() => setImageCompressionEnabled(false)}
                      style={{
                        background: !imageCompressionEnabled
                          ? "var(--bg-tertiary)"
                          : "transparent",
                        color: !imageCompressionEnabled
                          ? "var(--text-primary)"
                          : "var(--text-secondary)",
                        border: "none",
                        padding: "6px 12px",
                      }}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div style={{ height: "1px", background: "var(--border)" }} />

                <div
                  className="toggle-row"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    justifyContent: "space-between",
                  }}
                >
                  <div>
                    <div
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        color: "var(--text-primary)",
                      }}
                    >
                      {isCompress ? "File Compression" : "Decompress Files"}
                    </div>
                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                      }}
                    >
                      {isCompress
                        ? "Transparently compress OS files"
                        : "Undo OS transparent compression"}
                    </div>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      background: "var(--bg-secondary)",
                      borderRadius: "20px",
                      padding: "4px",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <button
                      className={`toggle-btn ${fileCompressionEnabled ? "btn-on" : ""}`}
                      onClick={() => setFileCompressionEnabled(true)}
                      style={{
                        background: fileCompressionEnabled
                          ? "var(--accent-primary)"
                          : "transparent",
                        color: fileCompressionEnabled
                          ? "white"
                          : "var(--text-secondary)",
                        border: "none",
                        boxShadow: fileCompressionEnabled
                          ? "0 0 12px var(--accent-glow)"
                          : "none",
                        padding: "6px 12px",
                      }}
                    >
                      Yes
                    </button>
                    <button
                      className={`toggle-btn ${!fileCompressionEnabled ? "btn-off" : ""}`}
                      onClick={() => setFileCompressionEnabled(false)}
                      style={{
                        background: !fileCompressionEnabled
                          ? "var(--bg-tertiary)"
                          : "transparent",
                        color: !fileCompressionEnabled
                          ? "var(--text-primary)"
                          : "var(--text-secondary)",
                        border: "none",
                        padding: "6px 12px",
                      }}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              {isCompress && (
                <>
                  <button
                    className="btn btn-outline"
                    onClick={() =>
                      setShowAdvancedSettings(!showAdvancedSettings)
                    }
                    style={{
                      fontSize: "13px",
                      padding: "8px 12px",
                      color: "var(--text-secondary)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "6px",
                      background: showAdvancedSettings
                        ? "var(--bg-secondary)"
                        : "transparent",
                      border: "1px solid var(--border)",
                      borderRadius: "12px",
                      width: "100%",
                      marginTop: "8px",
                    }}
                  >
                    <Settings size={14} />
                    Advanced Controls
                    {showAdvancedSettings ? (
                      <ChevronUp size={14} />
                    ) : (
                      <ChevronDown size={14} />
                    )}
                  </button>

                  <AnimatePresence>
                    {showAdvancedSettings && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{ overflow: "hidden" }}
                      >
                        <div
                          style={{
                            paddingTop: "16px",
                            borderTop: "1px solid var(--border)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "16px",
                            marginTop: "16px",
                          }}
                        >
                          {fileCompressionEnabled && (
                            <div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "var(--text-primary)",
                                  marginBottom: "8px",
                                }}
                              >
                                OS Transparent Algorithm
                              </div>
                              <select
                                value={nativeAlgo}
                                onChange={(e) =>
                                  setNativeAlgo(e.target.value as any)
                                }
                                style={{
                                  width: "100%",
                                  padding: "8px 12px",
                                  background: "var(--bg-secondary)",
                                  color: "var(--text-primary)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "var(--radius-md)",
                                  outline: "none",
                                  marginBottom: "4px",
                                }}
                              >
                                <option value="automatic">
                                  Automatic (OS Default)
                                </option>
                                {platform === "win32" && (
                                  <>
                                    <option value="LZX">LZX (Strongest)</option>
                                    <option value="XPRESS16K">
                                      XPRESS 16K (Stronger)
                                    </option>
                                    <option value="XPRESS8K">
                                      XPRESS 8K (Balanced)
                                    </option>
                                    <option value="XPRESS4K">
                                      XPRESS 4K (Fastest)
                                    </option>
                                  </>
                                )}
                              </select>
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontSize: "11px",
                                  lineHeight: "1.4",
                                }}
                              >
                                {getAlgoDescription()}
                              </div>
                            </div>
                          )}

                          {imageCompressionEnabled && (
                            <div>
                              <div
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "var(--text-primary)",
                                  marginBottom: "8px",
                                }}
                              >
                                Image Format
                              </div>
                              <select
                                value={outputFormat}
                                onChange={(e) =>
                                  setOutputFormat(e.target.value as any)
                                }
                                style={{
                                  width: "100%",
                                  padding: "8px 12px",
                                  background: "var(--bg-secondary)",
                                  color: "var(--text-primary)",
                                  border: "1px solid var(--border)",
                                  borderRadius: "var(--radius-md)",
                                  outline: "none",
                                  marginBottom: "4px",
                                }}
                              >
                                <option value="jpeg">Standard JPEG</option>
                                <option value="jxl">Archival JPEG XL</option>
                              </select>
                              <div
                                style={{
                                  color: "var(--text-secondary)",
                                  fontSize: "11px",
                                  lineHeight: "1.4",
                                }}
                              >
                                {outputFormat === "jxl"
                                  ? "25-30% smaller. Perfect for long-term storage."
                                  : "Optimizes size while retaining legacy compatibility."}
                              </div>
                            </div>
                          )}

                          {imageCompressionEnabled &&
                            outputFormat === "jxl" && (
                              <div>
                                <div
                                  style={{
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    color: "var(--text-primary)",
                                    marginBottom: "8px",
                                  }}
                                >
                                  JXL Effort Level
                                </div>
                                <select
                                  value={jxlEffort}
                                  onChange={(e) =>
                                    setJxlEffort(parseInt(e.target.value))
                                  }
                                  style={{
                                    width: "100%",
                                    padding: "8px 12px",
                                    background: "var(--bg-secondary)",
                                    color: "var(--text-primary)",
                                    border: "1px solid var(--border)",
                                    borderRadius: "var(--radius-md)",
                                    outline: "none",
                                    marginBottom: "4px",
                                  }}
                                >
                                  <option value={1}>1 (Fastest)</option>
                                  <option value={3}>3 (Fast)</option>
                                  <option value={5}>5 (Balanced)</option>
                                  <option value={7}>
                                    7 (Strong - Default)
                                  </option>
                                  <option value={9}>9 (Strongest)</option>
                                </select>
                                <div
                                  style={{
                                    color: "var(--text-secondary)",
                                    fontSize: "11px",
                                    lineHeight: "1.4",
                                  }}
                                >
                                  Higher effort takes significantly longer.
                                </div>
                              </div>
                            )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              )}

              {/* Move Estimates here so they stay with Settings */}
              {isCompress &&
                scannerEstimates &&
                activeQueue.some((j) => j.status === "pending") && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      background: "rgba(16, 185, 129, 0.08)",
                      padding: "16px",
                      borderRadius: "var(--radius-xl)",
                      border: "1px solid var(--success)",
                      boxShadow: "0 4px 12px rgba(16, 185, 129, 0.1)",
                      marginTop: "16px",
                    }}
                  >
                    <Zap size={18} color="var(--success)" />
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <span
                        style={{
                          fontSize: "12px",
                          color: "var(--text-secondary)",
                          fontWeight: "600",
                          textTransform: "uppercase",
                          letterSpacing: "0.02em",
                        }}
                      >
                        Estimated Potential Savings
                      </span>
                      <strong
                        style={{ fontSize: "20px", color: "var(--success)" }}
                      >
                        {formatBytes(estimateAmount, true)}
                      </strong>
                    </div>
                  </div>
                )}
            </div>

            {/* Settings & Actions Container - Now primarily for Actions */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                background: "var(--bg-tertiary)",
                borderRadius: "var(--radius-xl)",
                border: "1px solid var(--border)",
                boxShadow: "var(--shadow-sm)",
                padding: "20px",
              }}
            >
              {/* Estimates moved out of here for better column balance */}

              {!isProcessing && (
                <>
                  {activeQueue.some(
                    (j: QueueJob) => j.status === "pending",
                  ) && (
                    <button
                      className="btn btn-outline"
                      style={{
                        padding: "12px",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: "var(--text-primary)",
                        background: "var(--bg-secondary)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        marginBottom: "8px",
                      }}
                      onClick={async () => {
                        const pendingPaths = activeQueue
                          .filter((j) => j.status === "pending")
                          .map((j) => j.path);
                        if (pendingPaths.length === 0) return;

                        // Quick visual feedback
                        const btn = document.activeElement as HTMLButtonElement;
                        const originalText = btn
                          ? btn.innerText
                          : "Estimate Savings";
                        if (btn) btn.innerText = "Estimating...";
                        setScannerEstimates?.({ imageMB: 0, fileMB: 0 });
                        skipNextEstimateClearRef.current = true;

                        try {
                          const res = await window.electron.scanSystem(
                            pendingPaths,
                            {
                              outputFormat,
                              nativeAlgo,
                              imageCompressionEnabled,
                            },
                          );

                          if (res && res.results) {
                            const totalImageMB = res.results.reduce(
                              (acc, r) => acc + (r.imageMaxSavingsMB || 0),
                              0,
                            );
                            const totalFileMB = res.results.reduce(
                              (acc, r) => acc + (r.fileMaxSavingsMB || 0),
                              0,
                            );
                            setScannerEstimates?.({
                              imageMB: totalImageMB,
                              fileMB: totalFileMB,
                            });
                          }
                        } finally {
                          if (btn) btn.innerText = originalText;
                        }
                      }}
                    >
                      <Search size={16} />
                      Estimate Savings
                    </button>
                  )}

                  <button
                    className="btn btn-primary"
                    style={{
                      padding: "14px",
                      fontSize: "16px",
                      fontWeight: "600",
                      opacity: activeQueue.some(
                        (j: QueueJob) => j.status === "pending",
                      )
                        ? 1
                        : 0.5,
                      cursor: activeQueue.some(
                        (j: QueueJob) => j.status === "pending",
                      )
                        ? "pointer"
                        : "not-allowed",
                    }}
                    disabled={
                      !activeQueue.some((j: QueueJob) => j.status === "pending")
                    }
                    onClick={startQueue}
                  >
                    {doneJobs.length > 0
                      ? isCompress
                        ? "Shrink More!"
                        : "Decompress More!"
                      : isCompress
                        ? "Shrink!"
                        : "Decompress!"}
                  </button>

                  {doneJobs.length > 0 && (
                    <button
                      className="btn btn-outline"
                      style={{
                        padding: "14px",
                        fontSize: "16px",
                        fontWeight: "600",
                        color: "var(--text-primary)",
                      }}
                      onClick={() =>
                        setActiveQueue((prev: QueueJob[]) =>
                          prev.filter(
                            (j: QueueJob) =>
                              j.status !== "done" && j.status !== "failed",
                          ),
                        )
                      }
                    >
                      Clear Completed
                    </button>
                  )}
                </>
              )}

              {isProcessing && !isPaused && (
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    className="btn"
                    style={{
                      flex: 1,
                      padding: "14px",
                      fontSize: "16px",
                      fontWeight: "600",
                      backgroundColor: "var(--warning)",
                      color: "white",
                      border: "none",
                    }}
                    onClick={async () => {
                      setIsPaused(true);
                      await window.electron.togglePause(true);
                    }}
                  >
                    Pause
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{
                      flex: 1,
                      padding: "14px",
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "var(--text-primary)",
                    }}
                    onClick={() => {
                      isProcessingRef.current = false;
                      setIsProcessing(false);
                      setIsPaused(false);
                      window.electron.togglePause(false);
                      window.electron.abortProcess();
                      setActiveQueue((prev: QueueJob[]) =>
                        prev.filter(
                          (j: QueueJob) =>
                            j.status === "done" || j.status === "failed",
                        ),
                      );
                    }}
                  >
                    Stop
                  </button>
                </div>
              )}

              {isProcessing && isPaused && (
                <div style={{ display: "flex", gap: "12px" }}>
                  <button
                    className="btn btn-primary"
                    style={{
                      flex: 1,
                      padding: "14px",
                      fontSize: "16px",
                      fontWeight: "600",
                    }}
                    onClick={async () => {
                      setIsPaused(false);
                      await window.electron.togglePause(false);
                    }}
                  >
                    Resume
                  </button>
                  <button
                    className="btn btn-outline"
                    style={{
                      flex: 1,
                      padding: "14px",
                      fontSize: "16px",
                      fontWeight: "600",
                      color: "var(--text-primary)",
                    }}
                    onClick={() => {
                      isProcessingRef.current = false;
                      setIsProcessing(false);
                      setIsPaused(false);
                      window.electron.togglePause(false);
                      window.electron.abortProcess();
                      setActiveQueue((prev: QueueJob[]) =>
                        prev.filter(
                          (j: QueueJob) =>
                            j.status === "done" || j.status === "failed",
                        ),
                      );
                    }}
                  >
                    Stop
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        <LimitModal
          showLimitModal={showLimitModal}
          setShowLimitModal={setShowLimitModal}
          setIsPaused={setIsPaused}
          limitType={limitType}
        />
      </motion.div>
    </div>
  );
}
