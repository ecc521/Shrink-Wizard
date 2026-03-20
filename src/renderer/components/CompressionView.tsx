import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  HardDrive,
  Settings,
  Search,
  CheckCircle,
  AlertTriangle,
  ChevronRight,
  X,
  File,
  Zap,
  Info,
  ArrowUpDown,
  ChevronDown,
  Sparkles,
} from "lucide-react";
import {
  formatPath,
  formatBytes,
  formatCompactNumber,
} from "../utils/formatters";
import type { QueueJob } from "../../shared/ipc-types";
import { JobQueue } from "./compression/JobQueue";
import { DropZone } from "./compression/DropZone";
import { LimitModal } from "./compression/LimitModal";

export function CompressionView({
  activeTab,
  outputFormat,
  nativeAlgo,
  imageCompressionEnabled,
  jpegMetadata,
  jxlEffort,
  isPro,
  pendingScannerPaths,
  setPendingScannerPaths,
  autoStartCompression,
  setAutoStartCompression,
  isAdminUser,
  onProcessingChange,
  onSavingsUpdate,
}: {
  activeTab: "compress" | "decompress";
  outputFormat: string;
  nativeAlgo: string;
  imageCompressionEnabled: boolean;
  jpegMetadata: boolean;
  jxlEffort: number;
  isPro?: boolean;
  pendingScannerPaths?: string[];
  setPendingScannerPaths?: (paths: string[]) => void;
  autoStartCompression?: boolean;
  setAutoStartCompression?: (val: boolean) => void;
  isAdminUser?: boolean;
  onProcessingChange: (processing: boolean) => void;
  onSavingsUpdate?: (mb: number) => void;
}) {
  const [activeQueue, setActiveQueue] = useState<QueueJob[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [doneQueueHeight, setDoneQueueHeight] = useState(30);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [globalSavingsMB, setGlobalSavingsMB] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [sudoFailed, setSudoFailed] = useState(false);
  const [skippedSystemFiles, setSkippedSystemFiles] = useState(false);
  const [outOfSpace, setOutOfSpace] = useState(false);
  const [isDraggingOverTarget, setIsDraggingOverTarget] = useState(false);
  const isProcessingRef = useRef(false);

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

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate split percentage based on mouse position relative to window height.
      // Siderail fits the screen vertically minus top padding, but percent of unscaled
      // viewport height works great for intuitive resizing.
      const windowHeight = window.innerHeight;
      const mouseVertical = e.clientY;
      const heightPercent =
        ((windowHeight - mouseVertical) / windowHeight) * 100;

      if (heightPercent >= 5 && heightPercent <= 90) {
        setDoneQueueHeight(heightPercent);
      }
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
      window.electron.getGlobalSavingsMB().then((val: number) => {
        setGlobalSavingsMB(val);
        onSavingsUpdate?.(val);
      });

      window.electron.onProgress((data: any) => {
        if (data.globalSavingsMB !== undefined) {
          setGlobalSavingsMB(data.globalSavingsMB);
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

      window.electron.onLimitReached(() => {
        setIsPaused(true);
        setShowLimitModal(true);
      });

      return () => {
        window.electron.removeProgressListeners();
        window.electron.removeLimitReachedListeners();
      };
    }
  }, []);

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

  const percentSaved =
    totalProcessedMB > 0
      ? Math.round((totalSavingsMB / totalProcessedMB) * 100)
      : 0;
  // If negative savings (uncompressing), it's using more space, so we still show %, but perhaps negative
  // 97 KB (-15%)
  const displayPercent =
    percentSaved > 0
      ? `(${percentSaved}%)`
      : percentSaved < 0
        ? `(${percentSaved}%)`
        : "";

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
      window.electron.onProgress((data: any) => {
        if (data.globalSavingsMB !== undefined) {
          setGlobalSavingsMB(data.globalSavingsMB);
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
          nativeAlgo,
          imageCompressionEnabled,
          jpegMetadata,
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
          overflow: "hidden",
          scrollbarGutter: "stable",
          position: "relative",
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
                </>
              ) : (
                <>
                  <Zap className="text-secondary" /> Restore Your Data
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
                    {window.electron?.platform === "win32" ? "Please completely restart Shrink Wizard and select 'Run as Administrator'." : "You will be asked for an Admin Login."}
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
              <Info size={18} color="var(--accent-primary)" style={{ flexShrink: 0 }} />
              <span style={{ fontSize: "14px", lineHeight: "1.5" }}>
                <strong>System Files Skipped.</strong> Your drop included Windows OS files which were skipped. Use the dedicated <strong>System Storage</strong> tool in the sidebar instead!
              </span>
            </div>
          </div>
        ) : null}

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
            gap: "24px",
          }}
        >
          {/* Always show the slim Drop Zone when Pre-Compression */}
          {!isProcessing && doneJobs.length === 0 && (
            <>
              <div
                className="drop-zone"
                style={{
                  background: "var(--bg-secondary)",
                  border: "2px dashed var(--border)",
                  borderRadius: "var(--radius-xl)",
                  padding: "32px",
                  textAlign: "center",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "column",
                  gap: "12px",
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  // Bubbles up to view-container smoothly
                  e.preventDefault();
                }}
                onClick={() => handleSelectFiles(false)}
              >
                <HardDrive
                  size={32}
                  color={
                    isCompress
                      ? "var(--accent-primary)"
                      : "var(--text-secondary)"
                  }
                />
                <h3
                  style={{
                    margin: 0,
                    fontSize: "18px",
                    fontWeight: "500",
                    color: "var(--text-primary)",
                  }}
                >
                  {isCompress
                    ? "Select Items to Compress"
                    : "Select Items to Decompress"}
                </h3>
                <p
                  style={{
                    margin: 0,
                    color: "var(--text-secondary)",
                    fontSize: "14px",
                  }}
                >
                  or drag and drop anywhere in this window
                </p>

                {window.electron?.platform === "win32" && (
                  <div
                    style={{ display: "flex", gap: "12px", marginTop: "8px" }}
                  >
                    <button
                      className="btn btn-outline"
                      style={{
                        fontSize: "13px",
                        padding: "8px 16px",
                        borderRadius: "16px",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectFiles(false);
                      }}
                    >
                      Select Folders
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{
                        fontSize: "13px",
                        padding: "8px 16px",
                        borderRadius: "16px",
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSelectFiles(true);
                      }}
                    >
                      Select Files
                    </button>
                  </div>
                )}
              </div>

              {/* Ghosted button shown explicitly when queue is empty so users know dropping a file won't auto-start immediately */}
              {activeQueue.length === 0 && (
                <div
                  style={{
                    background: "var(--bg-secondary)",
                    borderRadius: "var(--radius-xl)",
                    border: "1px solid var(--border)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div
                    style={{
                      padding: "20px 24px",
                      display: "flex",
                      gap: "16px",
                      background: "var(--bg-root)",
                    }}
                  >
                    <button
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        padding: "14px",
                        fontSize: "16px",
                        fontWeight: "600",
                        opacity: 0.5,
                        cursor: "not-allowed",
                      }}
                    >
                      Start Processing
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

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
          />
        </div>

        <LimitModal
          showLimitModal={showLimitModal}
          setShowLimitModal={setShowLimitModal}
          setIsPaused={setIsPaused}
        />
      </motion.div>
    </div>
  );
}
