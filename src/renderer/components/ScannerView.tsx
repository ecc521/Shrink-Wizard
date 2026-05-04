import React, { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { HardDrive, Search, Zap, Info } from "lucide-react";
import {
  formatPath,
  formatBytes,
  formatCompactNumber,
} from "../utils/formatters";
import type { QueueJob } from "../App";
import type { ScanResult, ProgressData } from "../../shared/ipc-types";

export function ScannerView({
  onMigrate,
  onProcessingChange,
}: {
  isAdminUser: boolean;
  isPro: boolean;
  onMigrate: (
    paths: string[],
    estimates: { imageMB: number; fileMB: number },
  ) => void;
  onProcessingChange: (processing: boolean) => void;
}) {
  const [activeQueue, setActiveQueue] = useState<QueueJob[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [hoveredScanBox, setHoveredScanBox] = useState<"quick" | "full" | null>(
    null,
  );

  useEffect(() => {
    onProcessingChange(isProcessing);
  }, [isProcessing, onProcessingChange]);

  // const [doneQueueHeight, setDoneQueueHeight] = useState(30);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [endedEarly, setEndedEarly] = useState(false);

  const isProcessingRef = useRef(false);
  const queueTokenRef = useRef(0);

  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    if (autoStart && activeQueue.length > 0 && !isProcessing) {
      setAutoStart(false);
      startQueue();
    }
  }, [autoStart, activeQueue, isProcessing]);

  const handleRunScan = (type: "quick" | "full") => {
    if (isProcessing) return;

    const defaultQuickPaths =
      window.electron?.platform === "win32"
        ? [
            "C:\\Program Files",
            "C:\\Program Files (x86)",
            "~/Documents",
            "~/Downloads",
            "~/Pictures",
          ]
        : ["/Applications", "~/Documents", "~/Downloads", "~/Pictures"];

    const defaultFullPaths =
      window.electron?.platform === "win32" ? ["C:\\"] : ["/"];

    const paths = type === "quick" ? defaultQuickPaths : defaultFullPaths;

    const newJobs: QueueJob[] = paths.map((p) => ({
      id: Math.random().toString(36).substring(7),
      path: p,
      mode: "scan",
      status: "pending",
      progressData: null,
    }));

    setActiveQueue(newJobs);
    setAutoStart(true);
  };

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

  const doneJobsTotalsRef = useRef({
    savingsMB: 0,
    originalMB: 0,
    fileCount: 0,
    imageSavingsMB: 0,
    fileSavingsMB: 0,
  });

  useEffect(() => {
    const doneJobs = activeQueue.filter((j) => j.status === "done");
    doneJobsTotalsRef.current = {
      savingsMB: doneJobs.reduce(
        (acc, job) => acc + (job.progressData?.savingsMB || 0),
        0,
      ),
      originalMB: doneJobs.reduce(
        (acc, job) => acc + (job.progressData?.processedMB || 0),
        0,
      ),
      fileCount: doneJobs.reduce(
        (acc, job) => acc + (job.progressData?.fileCount || 0),
        0,
      ),
      imageSavingsMB: doneJobs.reduce(
        (acc, job) => acc + (job.progressData?.imageMaxSavingsMB || 0),
        0,
      ),
      fileSavingsMB: doneJobs.reduce(
        (acc, job) => acc + (job.progressData?.fileMaxSavingsMB || 0),
        0,
      ),
    };
  }, [activeQueue]);

  useEffect(() => {
    if (window.electron) {
      window.electron.onScanProgress((data: ProgressData) => {
        // Mute React! Directly bind into pure DOM components to render at 60 FPS without V8 Garbage Collection drops
        const totals = doneJobsTotalsRef.current;
        const liveSavings =
          totals.savingsMB + (data.currentSettingsSavingsMB || 0);
        const liveScanned = totals.originalMB + (data.originalMB || 0);
        const liveFiles = totals.fileCount + (data.fileCount || 0);

        const savingsEl = document.getElementById("live-savings-val");
        if (savingsEl) savingsEl.textContent = formatBytes(liveSavings, true);

        const scannedEl = document.getElementById("live-scanned-val");
        if (scannedEl) scannedEl.textContent = formatBytes(liveScanned, true);

        const filesEl = document.getElementById("live-files-val");
        if (filesEl) filesEl.textContent = formatCompactNumber(liveFiles);

        const pathEl = document.getElementById("live-path-val");
        if (pathEl) pathEl.textContent = formatPath(data.path || "");
      });
      return () => {
        window.electron.removeScanProgressListeners();
      };
    }
  }, []);

  const startQueue = async () => {
    if (isProcessing) return;

    queueTokenRef.current++;
    const myToken = queueTokenRef.current;

    setIsProcessing(true);
    isProcessingRef.current = true;
    setEndedEarly(false);

    try {
      await window.electron.scanSystem([], { clearCache: true }); // Reset backend dedup state

      for (let i = 0; i < activeQueue.length; i++) {
        if (!isProcessingRef.current || myToken !== queueTokenRef.current)
          break;

        const currentState = activeQueue[i]; // Fetch newest state to check pause
        if (
          currentState.status !== "pending" &&
          currentState.status !== "staging"
        )
          continue;

        setActiveQueue((prev) =>
          prev.map((j) =>
            j.id === currentState.id
              ? {
                  ...j,
                  status: "processing",
                  progressData: {
                    processedMB: 0,
                    savingsMB: 0,
                    percentage: 0,
                    totalMB: 0,
                    totalFiles: 0,
                    compressedCount: 0,
                    skippedCount: 0,
                    skippedMB: 0,
                    failedCount: 0,
                    alreadyCompressedCount: 0,
                    phase: "processing",
                  } as ProgressData,
                }
              : j,
          ),
        );

        while (true) {
          if (!isProcessingRef.current) break;
          // const freshQueue = activeQueue; // It's a stale closure, wait! We can just use an IPC signal.
          // Wait, `isPaused` state is handled via `window.electron.togglePause()`. Backend halts natively.
          break;
        }

        if (!isProcessingRef.current) break;

        try {
          const res = await window.electron.scanSystem([currentState.path], {
            outputFormat: "jxl",
            nativeAlgo: "lzvn",
            imageCompressionEnabled: true,
          });

          setActiveQueue((prev) =>
            prev.map((j) => {
              if (j.id === currentState.id) {
                const finalData: ScanResult =
                  res && res.results && res.results.length > 0
                    ? res.results[0]
                    : {
                        path: currentState.path,
                        currentSettingsSavingsMB: 0,
                        maxSettingsSavingsMB: 0,
                        originalMB: 0,
                        fileCount: 0,
                      };
                const finalJob = {
                  ...j,
                  status: "done" as const,
                  progressData: {
                    processedMB: finalData.originalMB,
                    savingsMB: finalData.currentSettingsSavingsMB,
                    percentage: 100, // done
                    maxSettingsSavingsMB: finalData.maxSettingsSavingsMB,
                    fileCount: finalData.fileCount,
                    totalMB: finalData.originalMB,
                    totalFiles: finalData.fileCount,
                    imageMaxSavingsMB: finalData.imageMaxSavingsMB || 0,
                    fileMaxSavingsMB: finalData.fileMaxSavingsMB || 0,
                    compressedCount: 0,
                    skippedCount: 0,
                    skippedMB: 0,
                    failedCount: 0,
                    alreadyCompressedCount: 0,
                    phase: "done" as const,
                  } as ProgressData,
                };

                // Update the persistent totals ref so migration values aren't 0
                doneJobsTotalsRef.current.savingsMB +=
                  finalJob.progressData.savingsMB;
                doneJobsTotalsRef.current.originalMB +=
                  finalJob.progressData.processedMB;
                doneJobsTotalsRef.current.fileCount +=
                  finalJob.progressData.fileCount || 0;
                doneJobsTotalsRef.current.imageSavingsMB +=
                  finalData.imageMaxSavingsMB || 0;
                doneJobsTotalsRef.current.fileSavingsMB +=
                  finalData.fileMaxSavingsMB || 0;

                return finalJob;
              }
              return j;
            }),
          );
        } catch (err) {
          const error = err as Error;
          console.error("Scan aborted or failed for", currentState.path, error);
          setActiveQueue((prev) =>
            prev.map((j) =>
              j.id === currentState.id ? { ...j, status: "failed" } : j,
            ),
          );
        }
      }
    } finally {
      if (myToken === queueTokenRef.current) {
        setIsProcessing(false);
        isProcessingRef.current = false;
      }
    }
  };

  const doneJobs = activeQueue.filter(
    (j) => j.status === "done" || j.status === "failed",
  );
  const totalSavingsMB = activeQueue.reduce(
    (acc, job) => acc + (job.progressData?.savingsMB || 0),
    0,
  );
  const totalScannedMB = activeQueue.reduce(
    (acc, job) => acc + (job.progressData?.processedMB || 0),
    0,
  );
  const totalFilesScanned = activeQueue.reduce(
    (acc, job) => acc + (job.progressData?.fileCount || 0),
    0,
  );
  // const inProgressJobs = activeQueue.filter(

  const selectedDonePaths = doneJobs.map((j) => j.path);

  return (
    <div
      style={{
        display: "flex",
        width: "100%",
        height: "100%",
        overflow: "hidden",
      }}
    >
      <motion.div
        className="view-container"
        style={{ flex: 1, overflowY: "auto", scrollbarGutter: "stable" }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        <div className="view-header">
          <h1
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "28px",
              margin: 0,
            }}
          >
            <Search className="text-primary" /> Smart Scanner
            <div
              title="Scanning your system to estimate savings is always free."
              style={{
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
                marginLeft: "4px",
              }}
            >
              Free
            </div>
          </h1>
          <p
            className="view-subtitle"
            style={{ maxWidth: "600px", marginTop: "8px" }}
          >
            Find historically compressible files and folders on your system to
            reclaim space.
          </p>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            gap: "24px",
          }}
        >
          {(isProcessing || doneJobs.length > 0) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                padding: "40px",
                background: !isProcessing
                  ? endedEarly
                    ? "rgba(245, 158, 11, 0.05)"
                    : "rgba(16, 185, 129, 0.05)"
                  : "var(--bg-secondary)",
                border: `2px solid ${!isProcessing ? (endedEarly ? "var(--warning)" : "var(--success)") : "var(--accent-primary)"}`,
                borderRadius: "var(--radius-xl)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
                boxShadow: !isProcessing
                  ? endedEarly
                    ? "0 8px 32px rgba(245, 158, 11, 0.1)"
                    : "0 8px 32px rgba(16, 185, 129, 0.1)"
                  : "0 8px 32px rgba(99, 102, 241, 0.1)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  marginBottom: "32px",
                }}
              >
                {!isProcessing ? (
                  <div
                    style={{
                      background: endedEarly
                        ? "rgba(245, 158, 11, 0.1)"
                        : "rgba(16, 185, 129, 0.1)",
                      padding: "12px",
                      borderRadius: "50%",
                      display: "flex",
                    }}
                  >
                    <Zap
                      size={32}
                      color={endedEarly ? "var(--warning)" : "var(--success)"}
                    />
                  </div>
                ) : (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{
                      repeat: Infinity,
                      duration: 2,
                      ease: "linear",
                    }}
                    style={{ display: "flex" }}
                  >
                    <Search size={32} color="var(--accent-primary)" />
                  </motion.div>
                )}

                <h2
                  style={{
                    fontSize: "28px",
                    fontWeight: "600",
                    color: "var(--text-primary)",
                    margin: 0,
                  }}
                >
                  {!isProcessing
                    ? endedEarly
                      ? "Scan Ended Early"
                      : "Scan Complete!"
                    : activeQueue.length > 2
                      ? "Quick Scan in Progress..."
                      : "Full Scan in Progress..."}
                </h2>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                  gap: "20px",
                  width: "100%",
                  maxWidth: "800px",
                  marginBottom: "40px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    textAlign: "center",
                    padding: "16px",
                    background: "var(--bg-root)",
                    borderRadius: "var(--radius-lg)",
                    border: `1px solid ${!isProcessing ? (endedEarly ? "var(--warning)" : "var(--success)") : "var(--border)"}`,
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: "600",
                      marginBottom: "8px",
                    }}
                  >
                    Estimated Savings
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      id="live-savings-val"
                      style={{
                        fontSize: "36px",
                        fontWeight: "700",
                        color: !isProcessing
                          ? endedEarly
                            ? "var(--warning)"
                            : "var(--success)"
                          : "var(--success)",
                        fontVariantNumeric: "tabular-nums",
                        lineHeight: 1.1,
                      }}
                    >
                      {formatBytes(totalSavingsMB, true)}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    textAlign: "center",
                    padding: "16px",
                    background: "var(--bg-root)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: "600",
                      marginBottom: "8px",
                    }}
                  >
                    Data Scanned
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      id="live-scanned-val"
                      style={{
                        fontSize: "36px",
                        fontWeight: "700",
                        color: "var(--text-primary)",
                        fontVariantNumeric: "tabular-nums",
                        lineHeight: 1.1,
                      }}
                    >
                      {formatBytes(totalScannedMB, true)}
                    </div>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    textAlign: "center",
                    padding: "16px",
                    background: "var(--bg-root)",
                    borderRadius: "var(--radius-lg)",
                    border: "1px solid var(--border)",
                    boxShadow: "var(--shadow-sm)",
                  }}
                >
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--text-secondary)",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      fontWeight: "600",
                      marginBottom: "8px",
                    }}
                  >
                    Files Analyzed
                  </div>
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      id="live-files-val"
                      style={{
                        fontSize: "36px",
                        fontWeight: "700",
                        color: "var(--text-primary)",
                        fontVariantNumeric: "tabular-nums",
                        lineHeight: 1.1,
                      }}
                    >
                      {formatCompactNumber(totalFilesScanned)}
                    </div>
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                  alignItems: "center",
                }}
              >
                {!isProcessing ? (
                  <>
                    <button
                      className="btn btn-primary"
                      style={{
                        fontSize: "18px",
                        padding: "16px 48px",
                        borderRadius: "30px",
                        boxShadow: "0 4px 20px var(--accent-glow)",
                      }}
                      onClick={() =>
                        onMigrate(selectedDonePaths, {
                          imageMB:
                            doneJobsTotalsRef.current.imageSavingsMB || 0,
                          fileMB: doneJobsTotalsRef.current.fileSavingsMB || 0,
                        })
                      }
                    >
                      Reclaim Space Now
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{
                        fontSize: "16px",
                        padding: "14px 28px",
                        borderRadius: "30px",
                        color: "var(--text-primary)",
                        borderColor: "var(--border)",
                      }}
                      onClick={() => {
                        window.electron.abortScan();
                        setActiveQueue([]);
                        setEndedEarly(false);
                      }}
                    >
                      Start New Scan
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-outline"
                    style={{
                      fontSize: "16px",
                      padding: "14px 32px",
                      borderRadius: "30px",
                      color: "var(--text-primary)",
                      borderColor: "var(--border)",
                    }}
                    onClick={() => {
                      setEndedEarly(true);
                      isProcessingRef.current = false;
                      setIsProcessing(false); // Instantly free the UI
                      window.electron.abortScan();
                    }}
                  >
                    End Scan Early
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {!doneJobs.length && !isProcessing && (
            <div
              style={{ display: "flex", flexDirection: "column", gap: "32px" }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                  gap: "24px",
                }}
              >
                <div
                  className="drop-zone"
                  onClick={() => handleRunScan("quick")}
                  onMouseEnter={() => setHoveredScanBox("quick")}
                  onMouseLeave={() => setHoveredScanBox(null)}
                  style={{
                    position: "relative",
                    padding: "32px 24px",
                    minHeight: "240px",
                    cursor: "pointer",
                    textAlign: "center",
                    border:
                      hoveredScanBox === "quick"
                        ? "2px solid var(--accent-primary)"
                        : "2px solid rgba(99, 102, 241, 0.3)",
                    backgroundColor:
                      hoveredScanBox === "quick"
                        ? "rgba(99, 102, 241, 0.05)"
                        : "rgba(99, 102, 241, 0.01)",
                    transition: "all 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      position: "absolute",
                      top: "-10px",
                      right: "20px",
                      background: "var(--accent-primary)",
                      color: "white",
                      padding: "4px 12px",
                      borderRadius: "12px",
                      fontSize: "11px",
                      fontWeight: "bold",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      boxShadow: "0 4px 12px rgba(99, 102, 241, 0.3)",
                    }}
                  >
                    ★ Recommended
                  </div>
                  <div
                    style={{
                      background: "var(--bg-root)",
                      padding: "16px",
                      borderRadius: "50%",
                      marginBottom: "20px",
                      boxShadow:
                        hoveredScanBox === "quick"
                          ? "0 0 15px rgba(99, 102, 241, 0.2)"
                          : "var(--shadow-sm)",
                    }}
                  >
                    <Zap
                      size={36}
                      color={
                        hoveredScanBox === "quick"
                          ? "var(--accent-primary)"
                          : "rgba(99, 102, 241, 0.7)"
                      }
                      style={{ transition: "all 0.2s" }}
                    />
                  </div>
                  <h2
                    style={{
                      fontSize: "20px",
                      fontWeight: "600",
                      color: "var(--text-primary)",
                      marginBottom: "8px",
                    }}
                  >
                    Quick Scan
                  </h2>
                  <div
                    style={{
                      display: "inline-block",
                      background:
                        hoveredScanBox === "quick"
                          ? "var(--accent-primary)"
                          : "rgba(99, 102, 241, 0.15)",
                      color:
                        hoveredScanBox === "quick"
                          ? "white"
                          : "var(--accent-primary)",
                      fontSize: "11px",
                      fontWeight: "600",
                      padding: "4px 10px",
                      borderRadius: "12px",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      transition: "all 0.2s",
                    }}
                  >
                    Fastest
                  </div>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                  >
                    Scans your installed programs, Documents, Downloads, and
                    Photos. Fastest way to find massive savings.
                  </p>
                </div>

                <div
                  className="drop-zone"
                  onClick={() => handleRunScan("full")}
                  onMouseEnter={() => setHoveredScanBox("full")}
                  onMouseLeave={() => setHoveredScanBox(null)}
                  style={{
                    position: "relative",
                    padding: "32px 24px",
                    minHeight: "240px",
                    cursor: "pointer",
                    textAlign: "center",
                    border:
                      hoveredScanBox === "full"
                        ? "2px solid var(--accent-primary)"
                        : "2px solid var(--border-light)",
                    backgroundColor:
                      hoveredScanBox === "full"
                        ? "rgba(99, 102, 241, 0.05)"
                        : "transparent",
                    transition: "all 0.2s",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      background: "var(--bg-root)",
                      padding: "16px",
                      borderRadius: "50%",
                      marginBottom: "20px",
                      boxShadow:
                        hoveredScanBox === "full"
                          ? "0 0 15px rgba(99, 102, 241, 0.2)"
                          : "var(--shadow-sm)",
                    }}
                  >
                    <HardDrive
                      size={36}
                      color={
                        hoveredScanBox === "full"
                          ? "var(--accent-primary)"
                          : "var(--text-secondary)"
                      }
                      style={{ transition: "all 0.2s" }}
                    />
                  </div>
                  <h2
                    style={{
                      fontSize: "20px",
                      fontWeight: "600",
                      color: "var(--text-primary)",
                      marginBottom: "8px",
                    }}
                  >
                    Full Scan
                  </h2>
                  <div
                    style={{
                      display: "inline-block",
                      background:
                        hoveredScanBox === "full"
                          ? "var(--accent-primary)"
                          : "var(--bg-tertiary)",
                      color:
                        hoveredScanBox === "full"
                          ? "white"
                          : "var(--text-secondary)",
                      fontSize: "11px",
                      fontWeight: "600",
                      padding: "4px 10px",
                      borderRadius: "12px",
                      marginBottom: "12px",
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                      transition: "all 0.2s",
                    }}
                  >
                    Biggest Savings
                  </div>
                  <p
                    style={{
                      color: "var(--text-secondary)",
                      fontSize: "14px",
                      lineHeight: "1.5",
                    }}
                  >
                    Analyzes your entire disk to find all possible savings. May
                    take several minutes.
                  </p>
                </div>
              </div>

              <div
                style={{
                  padding: "16px",
                  background: "var(--bg-tertiary)",
                  borderRadius: "var(--radius-lg)",
                  textAlign: "center",
                  color: "var(--text-secondary)",
                  fontSize: "14px",
                  border: "1px solid var(--border)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                }}
              >
                <Info size={18} color="var(--accent-primary)" />
                <span>Click on a scan type to start scanning.</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
