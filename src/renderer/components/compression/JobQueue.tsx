import React from "react";
import { X } from "lucide-react";
import {
  formatBytes,
  formatPath,
  formatCompactNumber,
} from "../../utils/formatters";
import { QueueJob } from "../../../shared/ipc-types";

interface JobQueueProps {
  activeQueue: QueueJob[];
  setActiveQueue: React.Dispatch<React.SetStateAction<QueueJob[]>>;
  doneJobs: QueueJob[];
  inProgressJobs: QueueJob[];
  isCompress: boolean;
  isProcessing: boolean;
  isPaused: boolean;
  setIsPaused: (paused: boolean) => void;
  setIsProcessing: (processing: boolean) => void;
  totalSavingsMB: number;
  totalProcessedMB: number;
  totalCompressed: number;
  totalSkipped: number;
  totalFailed: number;
  totalIncompressible: number;
  outOfSpace: boolean;
  startQueue: () => void;
  isProcessingRef: React.MutableRefObject<boolean>;
  handleSelectFiles: (filesOnly?: boolean) => Promise<void>;
}

export function JobQueue({
  activeQueue,
  setActiveQueue,
  doneJobs,
  inProgressJobs,
  isCompress,
  isProcessing,
  isPaused,
  setIsPaused,
  setIsProcessing,
  totalSavingsMB,
  totalProcessedMB,
  totalCompressed,
  totalSkipped,
  totalFailed,
  totalIncompressible,
  outOfSpace,
  startQueue,
  isProcessingRef,
  handleSelectFiles,
}: JobQueueProps) {
  return (
    <div
      style={{
        background: "var(--bg-secondary)",
        borderRadius: "var(--radius-xl)",
        border: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        boxShadow: "var(--shadow-sm)",
        flex: 1,
        minHeight: 0,
      }}
    >
      {/* Active / Finished Queue Header Metrics */}
      {(isProcessing || doneJobs.length > 0) && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
              gap: "20px",
              padding: "24px",
              background: "var(--bg-root)",
              borderBottom: "1px solid var(--border)",
            }}
          >
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                textAlign: "center",
                padding: "16px",
                background: "var(--bg-secondary)",
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
                {isCompress ? "Total Saved" : "Size Increase"}
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
                    color: isCompress ? "var(--success)" : "var(--warning)",
                    fontVariantNumeric: "tabular-nums",
                    lineHeight: 1.1,
                  }}
                >
                  {formatBytes(Math.abs(totalSavingsMB), true)}
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                textAlign: "center",
                padding: "16px",
                background: "var(--bg-secondary)",
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
                Processed Data
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
                  {formatBytes(totalProcessedMB, true)}
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                textAlign: "center",
                padding: "16px",
                background: "var(--bg-secondary)",
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
                Files Processed
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
                  {formatCompactNumber(
                    totalCompressed +
                      totalSkipped +
                      totalFailed +
                      totalIncompressible,
                  )}
                </div>
              </div>
            </div>
          </div>

          {outOfSpace && (
            <div
              style={{
                background: "var(--error)",
                color: "#fff",
                padding: "16px 24px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid var(--border)",
              }}
            >
              <span style={{ fontSize: "15px", fontWeight: "600" }}>
                Decompression stopped. You have less than 2.00 GB of free space
                left on your active drive!
              </span>
            </div>
          )}
        </div>
      )}

      {/* Pre-Compression Info Header */}
      {!isProcessing && doneJobs.length === 0 && activeQueue.length > 0 && (
        <div
          style={{
            padding: "16px 24px",
            borderBottom: "1px solid var(--border)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "600" }}>
            Ready to Process ({activeQueue.length} items)
          </h3>
          <button
            className="toggle-btn btn-off"
            style={{ fontSize: "12px", padding: "6px 12px" }}
            onClick={() => setActiveQueue([])}
          >
            Clear All
          </button>
        </div>
      )}

      {/* Dynamic Queue List Generator */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          overflowY: "auto",
          flex: 1,
          minHeight: 0,
          maxHeight: "var(--queue-max-height, 450px)",
        }}
      >
        {(() => {
          let displayJobs: QueueJob[];
          let remainingCount: number;

          if (!isProcessing && doneJobs.length === 0) {
            displayJobs = activeQueue.slice(0, 250);
            remainingCount = Math.max(0, activeQueue.length - 250);
          } else if (
            !isProcessing &&
            doneJobs.length > 0 &&
            inProgressJobs.length === 0
          ) {
            displayJobs = doneJobs.slice().reverse().slice(0, 250);
            remainingCount = Math.max(0, doneJobs.length - 250);
          } else {
            const recentDone =
              doneJobs.length > 0 ? doneJobs.slice().reverse() : [];
            const activeProc = inProgressJobs.filter(
              (j: QueueJob) => j.status === "processing",
            );
            const upcoming = inProgressJobs.filter(
              (j: QueueJob) => j.status === "pending" || j.status === "staging",
            );

            const combined = [...recentDone, ...activeProc, ...upcoming];
            displayJobs = combined.slice(0, 250);

            const visibleIds = new Set(displayJobs.map((j) => j.id));
            remainingCount = combined.filter(
              (j) => !visibleIds.has(j.id),
            ).length;
          }

          return (
            <>
              {displayJobs.length === 0 ? (
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: "24px",
                    color: "var(--text-secondary)",
                    gap: "20px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      width: "80px",
                      height: "80px",
                      borderRadius: "50%",
                      background: "rgba(99, 102, 241, 0.05)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      border: "1px dashed var(--border)",
                    }}
                  >
                    <svg
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{ opacity: 0.5 }}
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" y1="3" x2="12" y2="15" />
                    </svg>
                  </div>
                  <div>
                    <div
                      style={{
                        fontSize: "18px",
                        fontWeight: "600",
                        color: "var(--text-primary)",
                        marginBottom: "4px",
                      }}
                    >
                      Drag & Drop items here to begin
                    </div>
                    <div style={{ fontSize: "14px" }}>
                      Your files will appear here ready for processing
                    </div>
                  </div>

                  <div
                    style={{ display: "flex", gap: "12px", marginTop: "8px" }}
                  >
                    {window.electron?.platform === "win32" && (
                      <button
                        className="btn btn-primary"
                        style={{ padding: "10px 20px" }}
                        onClick={() => handleSelectFiles(false)}
                      >
                        Browse Folders
                      </button>
                    )}
                    <button
                      className="btn btn-primary"
                      style={{ padding: "10px 20px" }}
                      onClick={() => handleSelectFiles(true)}
                    >
                      Browse Files
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {displayJobs.map((job) => {
                    const isDone =
                      job.status === "done" || job.status === "failed";
                    const isProc = job.status === "processing";

                    const filePercent =
                      job.progressData && job.progressData.processedMB > 0
                        ? Math.round(
                            (job.progressData.savingsMB /
                              job.progressData.processedMB) *
                              100,
                          )
                        : 0;
                    const isNegative = filePercent < 0;

                    const savedText = job.progressData?.savingsMB
                      ? `${filePercent < 0 ? "Used" : "Saved"} ${formatBytes(Math.abs(job.progressData.savingsMB))} ${filePercent !== 0 ? `(${Math.abs(filePercent)}%)` : ""}`
                      : "";

                    return (
                      <div
                        key={job.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "16px 24px",
                          borderBottom: "1px solid var(--border)",
                          background: isProc
                            ? "rgba(245, 158, 11, 0.05)"
                            : isDone
                              ? isNegative
                                ? "rgba(99, 102, 241, 0.05)"
                                : "rgba(16, 185, 129, 0.05)"
                              : "transparent",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "12px",
                              minWidth: 0,
                              width: "100%",
                            }}
                          >
                            {isDone ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                  background: isNegative
                                    ? "var(--accent-primary)"
                                    : "var(--success)",
                                  color: "white",
                                  letterSpacing: "0.05em",
                                  flexShrink: 0,
                                }}
                              >
                                {job.status === "failed" ? "FAILED" : "DONE"}
                              </span>
                            ) : isProc ? (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                  background: "var(--warning)",
                                  color: "white",
                                  letterSpacing: "0.05em",
                                  flexShrink: 0,
                                }}
                              >
                                {job.progressData?.percentage || 0}%
                              </span>
                            ) : (
                              <span
                                style={{
                                  fontSize: "11px",
                                  fontWeight: "700",
                                  padding: "2px 8px",
                                  borderRadius: "12px",
                                  background: "var(--border)",
                                  color: "var(--text-secondary)",
                                  letterSpacing: "0.05em",
                                  flexShrink: 0,
                                }}
                              >
                                PENDING
                              </span>
                            )}

                            <span
                              title={job.path}
                              style={{
                                fontSize: "14px",
                                color: isDone
                                  ? "var(--text-secondary)"
                                  : "var(--text-primary)",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                flex: 1,
                              }}
                            >
                              {formatPath(job.path)}
                            </span>
                          </div>

                          {(isProc || isDone) && job.progressData && (
                            <div
                              style={{
                                fontSize: "12px",
                                color: isNegative
                                  ? "var(--accent-primary)"
                                  : "var(--success)",
                                fontWeight: "600",
                                paddingLeft: "4px",
                              }}
                            >
                              {savedText}
                            </div>
                          )}
                        </div>

                        {!isProcessing && job.status === "pending" && (
                          <button
                            onClick={() =>
                              setActiveQueue((prev) =>
                                prev.filter((j) => j.id !== job.id),
                              )
                            }
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "var(--text-secondary)",
                              cursor: "pointer",
                              padding: "8px",
                              borderRadius: "50%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              transition: "var(--transition)",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "rgba(239, 68, 68, 0.1)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                          >
                            <X size={16} />
                          </button>
                        )}
                      </div>
                    );
                  })}

                  {!isProcessing && (
                    <div
                      style={{
                        padding: "20px 24px",
                        display: "flex",
                        justifyContent: "center",
                      }}
                    >
                      <button
                        className="btn btn-outline"
                        style={{
                          width: "100%",
                          borderStyle: "dashed",
                          padding: "12px",
                          background: "var(--bg-root)",
                          color: "var(--text-secondary)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                        }}
                        onClick={() => handleSelectFiles(true)}
                      >
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <line x1="12" y1="5" x2="12" y2="19"></line>
                          <line x1="5" y1="12" x2="19" y2="12"></line>
                        </svg>
                        Add More Files
                      </button>
                    </div>
                  )}
                </>
              )}

              {remainingCount > 0 && (
                <div
                  style={{
                    padding: "16px 24px",
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    fontSize: "13px",
                    fontStyle: "italic",
                    background: "var(--bg-root)",
                  }}
                >
                  + {remainingCount} more pending items
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
