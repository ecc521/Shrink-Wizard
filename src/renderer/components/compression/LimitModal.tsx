import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle } from "lucide-react";

export function LimitModal({
  showLimitModal,
  setShowLimitModal,
  setIsPaused,
}: any) {
  return (
    <AnimatePresence>
      {showLimitModal && (
        <motion.div
          className="eula-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="eula-modal"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -20, opacity: 0 }}
            style={{
              maxWidth: "480px",
              borderLeft: "4px solid var(--warning)",
            }}
          >
            <h2
              className="eula-title"
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              <AlertTriangle className="text-warning" /> 5GB Limit Reached
            </h2>
            <div className="eula-content">
              <p>
                You have successfully saved over <strong>5GB</strong> of
                absolute disk space using Shrink Wizard!
              </p>
              <p>
                As an independent developer, I offer this tool for free to help
                everyone reclaim their storage. To keep the project sustainable,
                compression speed is now dynamically throttled to{" "}
                <strong>1 background thread.</strong>
              </p>
              <p>
                <em>
                  Note: Decompressing/Restoring files is completely separate,
                  always highly-concurrent, and effectively free forever.
                </em>
              </p>
              <p>
                If you want to unthrottle and process large nested folders
                immediately at full native multi-core speed (as well as access
                our JXL transcoding features), please consider upgrading.
              </p>
            </div>
            <div
              className="eula-footer"
              style={{ flexDirection: "column", marginTop: "24px" }}
            >
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowLimitModal(false);
                  window.electron.openUrl("https://shrinkwizard.com/#pricing");
                }}
                style={{ width: "100%", padding: "12px" }}
              >
                View Pro Settings ($10)
              </button>
              <button
                className="btn"
                onClick={() => {
                  setShowLimitModal(false);
                  setIsPaused(false);
                  window.electron.togglePause(false);
                }}
                style={{
                  width: "100%",
                  padding: "12px",
                  background: "transparent",
                  border: "1px solid var(--border)",
                }}
              >
                Continue Slower
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
