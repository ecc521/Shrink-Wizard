import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Info } from "lucide-react";

export function LimitModal({
  showLimitModal,
  setShowLimitModal,
  setIsPaused,
  limitType = "trial",
}: {
  showLimitModal: boolean;
  setShowLimitModal: (show: boolean) => void;
  setIsPaused: (paused: boolean) => void;
  limitType?: "trial" | "daily";
}) {
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
              borderLeft:
                limitType === "trial"
                  ? "4px solid var(--accent-primary)"
                  : "4px solid var(--warning)",
            }}
          >
            <h2
              className="eula-title"
              style={{ display: "flex", alignItems: "center", gap: "12px" }}
            >
              {limitType === "trial" ? (
                <>
                  <Info className="text-primary" /> Premium Trial Complete
                </>
              ) : (
                <>
                  <AlertTriangle className="text-warning" /> Daily Limit Reached
                </>
              )}
            </h2>
            <div className="eula-content">
              {limitType === "trial" ? (
                <>
                  <p>
                    You have successfully saved over <strong>3GB</strong> of
                    space using Shrink Wizard! Your premium trial is now
                    complete.
                  </p>
                  <p>How would you like to continue?</p>
                </>
              ) : (
                <>
                  <p>
                    You have successfully saved <strong>1GB</strong> of space
                    today!
                  </p>
                  <p>
                    You've hit your daily limit on the Free Tier. Please wait
                    until tomorrow to process more files, or upgrade for
                    unlimited access.
                  </p>
                </>
              )}
              <p>
                <em>
                  Note: Decompressing/Restoring files is always completely free
                  and unlimited.
                </em>
              </p>
            </div>
            <div
              className="eula-footer"
              style={{
                flexDirection: "column",
                marginTop: "24px",
                gap: "12px",
              }}
            >
              <button
                className="btn btn-primary"
                onClick={() => {
                  setShowLimitModal(false);
                  window.electron.openUrl("https://shrinkwizard.com/#pricing");
                }}
                style={{ width: "100%", padding: "12px" }}
              >
                Upgrade to Unlimited
              </button>

              {limitType === "trial" ? (
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
                  Continue with 1GB Daily Limit
                </button>
              ) : (
                <button
                  className="btn"
                  onClick={() => {
                    setShowLimitModal(false);
                  }}
                  style={{
                    width: "100%",
                    padding: "12px",
                    background: "transparent",
                    border: "1px solid var(--border)",
                  }}
                >
                  Close
                </button>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
