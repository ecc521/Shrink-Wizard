import React from "react";
import { motion } from "framer-motion";
import { X } from "lucide-react";
import {
  formatBytes,
  formatPath,
  formatCompactNumber,
} from "../../utils/formatters";
import { QueueJob } from "../../../shared/ipc-types";

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
}: any) {
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
      {!isProcessing && doneJobs.length === 0 && (
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
        }}
      >
        {(() => {
          let displayJobs: QueueJob[] = [];
          let remainingCount = 0;

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
              (j: any) => j.status === "processing",
            );
            const upcoming = inProgressJobs.filter(
              (j: any) => j.status === "pending" || j.status === "staging",
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
              {displayJobs.map((job) => {
                const isDone = job.status === "done" || job.status === "failed";
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
                          }}
                        >
                          {formatPath(job.path)}
                        </span>
                      </div>

                      {(isProc || isDone) && job.progressData && (
                        <div
                          style={{
                            display: "flex",
                            gap: "16px",
                            fontSize: "13px",
                            color: "var(--text-secondary)",
                            marginLeft: "12px",
                          }}
                        >
                          {savedText && (
                            <span
                              style={{
                                color: isNegative
                                  ? "var(--accent-primary)"
                                  : "var(--success)",
                                fontWeight: "500",
                              }}
                            >
                              {savedText}
                            </span>
                          )}
                          {isProc && (
                            <span>
                              Scanning:{" "}
                              {formatBytes(job.progressData.processedMB)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {!isProcessing && doneJobs.length === 0 && (
                      <button
                        onClick={() =>
                          setActiveQueue((prev: any) =>
                            prev.filter((j: any) => j.id !== job.id),
                          )
                        }
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-secondary)",
                          cursor: "pointer",
                          padding: "8px",
                          marginLeft: "16px",
                        }}
                      >
                        <X size={18} />
                      </button>
                    )}
                  </div>
                );
              })}

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
              {activeQueue.length === 0 && (
                <div
                  style={{
                    padding: "32px",
                    textAlign: "center",
                    color: "var(--text-secondary)",
                    fontSize: "14px",
                  }}
                >
                  Drag items here to begin
                </div>
              )}
            </>
          );
        })()}
      </div>

      {/* Dynamic Bottom Action Keys */}
      <div
        style={{
          padding: "20px 24px",
          display: "flex",
          gap: "16px",
          background: "var(--bg-root)",
          borderTop: "1px solid var(--border)",
          borderBottomLeftRadius: "var(--radius-xl)",
          borderBottomRightRadius: "var(--radius-xl)",
          flexShrink: 0,
        }}
      >
        {!isProcessing && (
          <>
            {activeQueue.some((j: any) => j.status === "pending") && (
              <button
                className="btn btn-primary"
                style={{
                  flex: 1,
                  padding: "14px",
                  fontSize: "16px",
                  fontWeight: "600",
                }}
                onClick={startQueue}
              >
                {doneJobs.length > 0
                  ? "Start Additional Processing"
                  : "Start Processing"}
              </button>
            )}

            {doneJobs.length > 0 && (
              <button
                className="btn btn-outline"
                style={{
                  flex: activeQueue.some((j: any) => j.status === "pending")
                    ? 1
                    : "100%",
                  padding: "14px",
                  fontSize: "16px",
                  fontWeight: "600",
                  color: "var(--text-primary)",
                }}
                onClick={() =>
                  setActiveQueue((prev: any) =>
                    prev.filter(
                      (j: any) => j.status !== "done" && j.status !== "failed",
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
          <>
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
              Pause Processing
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
                setActiveQueue((prev: any) =>
                  prev.filter(
                    (j: any) => j.status === "done" || j.status === "failed",
                  ),
                );
              }}
            >
              Stop Processing
            </button>
          </>
        )}

        {isProcessing && isPaused && (
          <>
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
              Resume Processing
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
                setActiveQueue((prev: any) =>
                  prev.filter(
                    (j: any) => j.status === "done" || j.status === "failed",
                  ),
                );
              }}
            >
              Stop Processing
            </button>
          </>
        )}
      </div>
    </div>
  );
}
