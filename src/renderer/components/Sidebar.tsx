import React from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Search,
  HardDrive,
  Settings,
  Cpu,
  CheckCircle,
  Info,
  Sparkles,
} from "lucide-react";
import { formatBytes } from "../utils/formatters";

type TTab =
  | "compress"
  | "decompress"
  | "system"
  | "about"
  | "store"
  | "scanner"
  | "settings";

export function Sidebar({
  activeTab,
  isGlobalProcessing,
  isPro,
  globalSavingsMB,
  dailySavingsMB,
  hasSeenTrialEnd,
  platform,
  handleNavClick,
}: {
  activeTab: TTab;
  isGlobalProcessing: boolean;
  isPro: boolean;
  globalSavingsMB: number;
  dailySavingsMB: number;
  hasSeenTrialEnd: boolean;
  platform: string;
  handleNavClick: (tab: TTab) => void;
}) {
  return (
    <nav className="sidebar">
      <div className="brand">
        <Zap className="brand-icon" size={28} />
        <span className="brand-text">Shrink Wizard</span>
      </div>

      <div className="nav-items">
        <button
          className={`nav-btn ${activeTab === "scanner" ? "active" : ""}`}
          onClick={() => handleNavClick("scanner")}
          style={{
            opacity: isGlobalProcessing && activeTab !== "scanner" ? 0.5 : 1,
            cursor:
              isGlobalProcessing && activeTab !== "scanner"
                ? "not-allowed"
                : "pointer",
          }}
        >
          <Search size={20} />
          <span>Scanner</span>
        </button>
        <button
          className={`nav-btn ${activeTab === "compress" ? "active" : ""}`}
          onClick={() => handleNavClick("compress")}
          style={{
            opacity: isGlobalProcessing && activeTab !== "compress" ? 0.5 : 1,
            cursor:
              isGlobalProcessing && activeTab !== "compress"
                ? "not-allowed"
                : "pointer",
          }}
        >
          <HardDrive size={20} />
          <span>Compress</span>
        </button>
        <button
          className={`nav-btn ${activeTab === "decompress" ? "active" : ""}`}
          onClick={() => handleNavClick("decompress")}
          style={{
            opacity: isGlobalProcessing && activeTab !== "decompress" ? 0.5 : 1,
            cursor:
              isGlobalProcessing && activeTab !== "decompress"
                ? "not-allowed"
                : "pointer",
          }}
        >
          <Zap size={20} />
          <span>Decompress</span>
        </button>
        {platform === "win32" && (
          <button
            className={`nav-btn ${activeTab === "system" ? "active" : ""}`}
            onClick={() => handleNavClick("system")}
            style={{
              opacity: isGlobalProcessing && activeTab !== "system" ? 0.5 : 1,
              cursor:
                isGlobalProcessing && activeTab !== "system"
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            <Cpu size={20} />
            <span>System Data</span>
          </button>
        )}

        <button
          className={`nav-btn ${activeTab === "settings" ? "active" : ""}`}
          onClick={() => handleNavClick("settings")}
          style={{
            opacity: isGlobalProcessing && activeTab !== "settings" ? 0.5 : 1,
            cursor:
              isGlobalProcessing && activeTab !== "settings"
                ? "not-allowed"
                : "pointer",
          }}
        >
          <Settings size={20} />
          <span>Settings</span>
        </button>

        <button
          className={`nav-btn ${activeTab === "about" ? "active" : ""}`}
          onClick={() => handleNavClick("about")}
          style={{
            opacity: isGlobalProcessing && activeTab !== "about" ? 0.5 : 1,
            cursor:
              isGlobalProcessing && activeTab !== "about"
                ? "not-allowed"
                : "pointer",
          }}
        >
          <Info size={20} />
          <span>About</span>
        </button>

        <div
          className="usage-tracker"
          onClick={() => {
            if (!isGlobalProcessing || activeTab === "store") {
              handleNavClick("store");
            }
          }}
          style={{
            marginTop: "auto",
            cursor:
              isGlobalProcessing && activeTab !== "store"
                ? "not-allowed"
                : "pointer",
            opacity: isGlobalProcessing && activeTab !== "store" ? 0.5 : 1,
            border:
              activeTab === "store"
                ? isPro
                  ? "1px solid var(--success)"
                  : "1px solid var(--accent-primary)"
                : "1px solid var(--border)",
            background:
              activeTab === "store"
                ? isPro
                  ? "rgba(16, 185, 129, 0.05)"
                  : "rgba(99, 102, 241, 0.05)"
                : "var(--bg-secondary)",
            transition: "all 0.2s ease",
            marginBottom: 0,
          }}
        >
          {isPro ? (
            <>
              <div className="tracker-header">
                <span
                  className="tracker-title"
                  style={{ color: "var(--accent-primary)" }}
                >
                  Premium
                </span>
                <span
                  className="tracker-limit"
                  style={{ color: "var(--accent-primary)" }}
                >
                  {formatBytes(dailySavingsMB, false)} / Unlimited
                </span>
              </div>
              <div className="tracker-label">
                Total Saved:{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {formatBytes(globalSavingsMB, false)}
                </strong>
              </div>
            </>
          ) : (
            <>
              <div className="tracker-header">
                <span className="tracker-title">
                  {!hasSeenTrialEnd ? "Free Trial" : "Free Tier"}
                </span>
                <span className="tracker-limit">
                  {!hasSeenTrialEnd
                    ? `${formatBytes(globalSavingsMB, false)} / 3.00 GB`
                    : `${formatBytes(dailySavingsMB, false)} / 1.00 GB`}
                </span>
              </div>
              <div className="tracker-bar-bg">
                <motion.div
                  className="tracker-bar-fill"
                  initial={{ width: 0 }}
                  animate={{
                    width: !hasSeenTrialEnd
                      ? `${Math.min(100, (globalSavingsMB / 3000) * 100)}%`
                      : `${Math.min(100, (dailySavingsMB / 1000) * 100)}%`,
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <div className="tracker-label">
                Total Saved:{" "}
                <strong style={{ color: "var(--text-primary)" }}>
                  {formatBytes(globalSavingsMB, false)}
                </strong>
              </div>
              <div
                style={{
                  marginTop: "4px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  color: "var(--accent-primary)",
                  fontSize: "12px",
                  fontWeight: 600,
                }}
              >
                <Zap size={14} />
                <span>Upgrade to Pro</span>
              </div>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
