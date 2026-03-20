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
  | "settings"
  | "about"
  | "store"
  | "scanner";

export function Sidebar({
  activeTab,
  isGlobalProcessing,
  isPro,
  globalSavingsMB,
  platform,
  handleNavClick,
}: {
  activeTab: TTab;
  isGlobalProcessing: boolean;
  isPro: boolean;
  globalSavingsMB: number;
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
        <div style={{ flex: 1 }} /> {/* Spacer */}
        <div className="usage-tracker">
          {isPro ? (
            <>
              <div className="tracker-header">
                <span className="tracker-title">Pro Active</span>
                <Sparkles
                  size={14}
                  className="tracker-icon"
                  style={{ color: "var(--success)" }}
                />
              </div>
              <div className="tracker-value">
                {formatBytes(globalSavingsMB, false)}
              </div>
              <div className="tracker-label">Total Space Reclaimed</div>
            </>
          ) : (
            <>
              <div className="tracker-header">
                <span className="tracker-title">Free Tier</span>
                <span className="tracker-limit">
                  {formatBytes(globalSavingsMB, false)} / 5.00 GB
                </span>
              </div>
              <div className="tracker-bar-bg">
                <motion.div
                  className="tracker-bar-fill"
                  initial={{ width: 0 }}
                  animate={{
                    width: `${Math.min(100, (globalSavingsMB / 5000) * 100)}%`,
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                />
              </div>
              <div className="tracker-label">Total Space Reclaimed</div>
            </>
          )}
        </div>
        <button
          className={`nav-btn ${activeTab === "store" ? "active" : ""}`}
          onClick={() => handleNavClick("store")}
          style={{
            color: isPro ? "var(--success)" : "var(--accent-primary)",
            background:
              activeTab === "store"
                ? "var(--bg-secondary)"
                : isPro
                  ? "rgba(16, 185, 129, 0.1)"
                  : "rgba(99, 102, 241, 0.1)",
            opacity: isGlobalProcessing && activeTab !== "store" ? 0.5 : 1,
            cursor:
              isGlobalProcessing && activeTab !== "store"
                ? "not-allowed"
                : "pointer",
          }}
        >
          {isPro ? <CheckCircle size={20} /> : <Zap size={20} />}
          <span>{isPro ? "Pro Active" : "Upgrade to Pro"}</span>
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
      </div>
    </nav>
  );
}
