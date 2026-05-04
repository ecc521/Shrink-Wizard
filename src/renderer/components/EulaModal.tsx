import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, CheckCircle } from "lucide-react";

export function EulaModal({
  showEula,
  handleAgreeEula,
}: {
  showEula: boolean;
  handleAgreeEula: () => void;
}) {
  return (
    <AnimatePresence>
      {showEula && (
        <motion.div
          className="eula-overlay"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="eula-modal"
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <div className="eula-icon-wrap">
              <AlertTriangle size={36} className="text-warning" />
            </div>
            <h2>Data Loss Disclaimer & EULA</h2>
            <div className="eula-content">
              <p>
                Welcome to Shrink Wizard! Before you shrink your first file,
                please read and acknowledge the following:
              </p>

              <div className="eula-warning-box">
                <strong>Critical Warning</strong>
                <p>
                  Shrink Wizard alters your files in-place on your storage drive
                  to reclaim space. While the algorithms used are strictly
                  lossless, unexpected events during processing (such as a power
                  outage, operating system crash, or hardware failure) can
                  result in irreversible data corruption.
                </p>
              </div>

              <p>
                <strong>Backups are recommended.</strong> While data loss is
                extremely unlikely, unexpected events (such as power outages or
                hardware failures) can occur.
              </p>
              <p>
                By clicking &quot;I Agree&quot;, you also accept our standard{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.electron.openUrl(
                      "https://shrinkwizard.com/terms.html",
                    );
                  }}
                >
                  Terms of Service
                </a>{" "}
                and{" "}
                <a
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    window.electron.openUrl(
                      "https://shrinkwizard.com/privacy.html",
                    );
                  }}
                >
                  Privacy Policy
                </a>
                .
              </p>
            </div>
            <div className="eula-actions">
              <button
                className="btn btn-primary btn-full"
                onClick={handleAgreeEula}
              >
                <CheckCircle size={18} /> I Agree to the Terms
              </button>
              <button
                className="btn btn-secondary btn-full"
                onClick={() => window.close()}
              >
                Quit Application
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
