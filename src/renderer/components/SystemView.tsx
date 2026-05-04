import React from "react";
import { motion } from "framer-motion";
import { HardDrive } from "lucide-react";

export function SystemView({
  compactOsEnabled,
  isCheckingOs,
  onToggleCompactOs,
  isPro,
}: {
  compactOsEnabled: boolean | null;
  isCheckingOs: boolean;
  onToggleCompactOs: () => void;
  isPro: boolean;
}) {
  return (
    <motion.div
      className="view-container"
      style={{
        flex: 1,
        overflowY: "auto",
        scrollbarGutter: "stable",
        paddingBottom: "40px",
      }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="view-header">
        <h1 className="view-title">System Storage</h1>
        <p className="view-subtitle">
          Compress your entire Windows operating system securely.
        </p>
      </div>

      <div
        style={{
          marginBottom: "24px",
          padding: "16px",
          background: "rgba(99, 102, 241, 0.1)",
          border: "1px solid var(--accent-primary)",
          borderRadius: "8px",
          color: "var(--text-primary)",
          display: "flex",
          gap: "16px",
        }}
      >
        <HardDrive
          size={24}
          color="var(--accent-primary)"
          style={{ flexShrink: 0 }}
        />
        <div>
          <strong>What is CompactOS?</strong>
          <p
            style={{
              margin: "4px 0 0 0",
              fontSize: "14px",
              color: "var(--text-secondary)",
              lineHeight: 1.5,
            }}
          >
            CompactOS is a native Windows 10/11 feature that compresses your
            Windows installation files (C:\Windows) without affecting
            performance. Enabling this is the safest way to shrink your system
            footprint, safely saving 1GB to 3GB of disk space.
          </p>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <div>
            <h2
              className="settings-card-title"
              style={{ display: "flex", alignItems: "center", gap: "8px" }}
            >
              Enable CompactOS
              {!isPro && (
                <span
                  style={{
                    fontSize: "11px",
                    padding: "2px 8px",
                    background: "rgba(16, 185, 129, 0.1)",
                    color: "var(--success)",
                    borderRadius: "12px",
                    border: "1px solid rgba(16,185,129,0.3)",
                  }}
                >
                  Pro Only
                </span>
              )}
            </h2>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "14px",
                marginTop: "4px",
              }}
            >
              This process may take 10-20 minutes depending on your disk speed.
            </p>
          </div>
          <button
            className={`btn toggle-btn ${compactOsEnabled ? "btn-on" : "btn-off"}`}
            onClick={onToggleCompactOs}
            disabled={isCheckingOs || !isPro}
            style={{
              width: "120px",
              opacity: !isPro ? 0.5 : 1,
              cursor: !isPro ? "not-allowed" : "pointer",
            }}
          >
            {isCheckingOs
              ? "Checking..."
              : compactOsEnabled
                ? "Turn Off"
                : "Turn On"}
          </button>
        </div>
      </div>
    </motion.div>
  );
}
