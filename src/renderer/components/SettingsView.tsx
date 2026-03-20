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
import type { QueueJob } from "../App";

export function SettingsView({
  platform,
  theme,
  setTheme,
  nativeAlgo,
  setNativeAlgo,
  imageCompressionEnabled,
  setImageCompressionEnabled,
  jpegMetadata,
  setJpegMetadata,
  outputFormat,
  setOutputFormat,
  jxlEffort,
  setJxlEffort,
  isPro,
}: {
  platform: string;
  theme: string;
  setTheme: (v: string) => void;
  nativeAlgo: string;
  setNativeAlgo: (v: string) => void;
  imageCompressionEnabled: boolean;
  setImageCompressionEnabled: (v: boolean) => void;
  jpegMetadata: boolean;
  setJpegMetadata: (v: boolean) => void;
  outputFormat: string;
  setOutputFormat: (v: string) => void;
  jxlEffort: number;
  setJxlEffort: (v: number) => void;
  isPro: boolean;
}) {
  const getAlgoDescription = () => {
    switch (nativeAlgo) {
      case "automatic":
        return "We let your OS pick the optimal algorithm.";
      case "LZX":
        return "Highest compression, significantly reduced speed. Best for archival.";
      case "XPRESS16K":
        return "High compression, reduced speed.";
      case "XPRESS8K":
        return "Balanced compression and speed.";
      case "XPRESS4K":
        return "Light compression, maximum speed.";
      case "LZFSE":
        return "Balanced compression and speed (Apple default).";
      case "ZLIB":
        return "Highest compression, reduced speed. Used for maximum space savings.";
      case "LZVN":
        return "Light compression, maximum speed.";
      case "off":
        return "Disables transparent compression entirely.";
      default:
        return "Higher compression saves more space but is slower to process.";
    }
  };

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
        <h1 className="view-title">App Settings</h1>
        <p className="view-subtitle">
          Configure advanced OS-level compression capabilities.
        </p>
      </div>

      <div className="settings-card">
        <div
          className="settings-card-header"
          style={{ alignItems: "flex-start" }}
        >
          <div style={{ flex: 1 }}>
            <h2 className="settings-card-title">Theme</h2>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "14px",
                marginTop: "4px",
                maxWidth: "80%",
              }}
            >
              Select the application appearance.
            </p>
          </div>
          <div
            style={{
              display: "flex",
              background: "var(--bg-secondary)",
              borderRadius: "20px",
              padding: "4px",
              border: "1px solid var(--border)",
            }}
          >
            <button
              className={`toggle-btn ${theme === "system" ? "btn-on" : ""}`}
              onClick={() => setTheme("system")}
              style={{
                color: theme === "system" ? "white" : "var(--text-secondary)",
                background:
                  theme === "system" ? "var(--accent-primary)" : "transparent",
                border: "none",
              }}
            >
              System
            </button>
            <button
              className={`toggle-btn ${theme === "light" ? "btn-on" : ""}`}
              onClick={() => setTheme("light")}
              style={{
                color: theme === "light" ? "white" : "var(--text-secondary)",
                background:
                  theme === "light" ? "var(--accent-primary)" : "transparent",
                border: "none",
              }}
            >
              Light
            </button>
            <button
              className={`toggle-btn ${theme === "dark" ? "btn-on" : ""}`}
              onClick={() => setTheme("dark")}
              style={{
                color: theme === "dark" ? "white" : "var(--text-secondary)",
                background:
                  theme === "dark" ? "var(--accent-primary)" : "transparent",
                border: "none",
              }}
            >
              Dark
            </button>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div
          className="settings-card-header"
          style={{ alignItems: "flex-start" }}
        >
          <div style={{ flex: 1 }}>
            <h2 className="settings-card-title">OS Transparent Compression</h2>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "14px",
                marginTop: "4px",
                maxWidth: "80%",
              }}
            >
              Select the algorithm used by the operating system for transparent
              file compression.
            </p>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "8px",
              flex: "0 0 240px",
            }}
          >
            <select
              value={nativeAlgo}
              onChange={(e) => setNativeAlgo(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px",
                background: "var(--bg-secondary)",
                color: "var(--text-primary)",
                border: "1px solid var(--border)",
                borderRadius: "var(--radius-md)",
                outline: "none",
              }}
            >
              <option value="automatic">Automatic (OS Default)</option>
              {platform === "win32" ? (
                <>
                  <option value="LZX">LZX (Strongest)</option>
                  <option value="XPRESS16K">XPRESS 16K (Stronger)</option>
                  <option value="XPRESS8K">XPRESS 8K (Balanced)</option>
                  <option value="XPRESS4K">XPRESS 4K (Fastest)</option>
                </>
              ) : null}
              <option value="off">Off</option>
            </select>
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "11px",
                textAlign: "left",
                lineHeight: "1.4",
              }}
            >
              {getAlgoDescription()}
            </span>
          </div>
        </div>
      </div>

 

      <div className="settings-card">
        <div
          className="settings-card-header"
          style={{ marginBottom: imageCompressionEnabled ? "24px" : "0" }}
        >
          <div>
            <h2 className="settings-card-title">Image Compression</h2>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "14px",
                marginTop: "4px",
              }}
            >
              Advanced configurations for handling standalone image files (JPEG,
              PNG).
            </p>
          </div>
          <div
            style={{
              display: "flex",
              background: "var(--bg-secondary)",
              borderRadius: "20px",
              padding: "4px",
              border: "1px solid var(--border)",
            }}
          >
            <button
              className={`toggle-btn ${imageCompressionEnabled ? "btn-on" : ""}`}
              onClick={() => setImageCompressionEnabled(true)}
              style={{
                background: imageCompressionEnabled
                  ? "var(--accent-primary)"
                  : "transparent",
                color: imageCompressionEnabled
                  ? "white"
                  : "var(--text-secondary)",
                border: "none",
                boxShadow: imageCompressionEnabled
                  ? "0 0 12px var(--accent-glow)"
                  : "none",
              }}
            >
              On
            </button>
            <button
              className={`toggle-btn ${!imageCompressionEnabled ? "btn-off" : ""}`}
              onClick={() => setImageCompressionEnabled(false)}
              style={{
                background: !imageCompressionEnabled
                  ? "var(--bg-tertiary)"
                  : "transparent",
                color: !imageCompressionEnabled
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
                border: "none",
              }}
            >
              Off
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {imageCompressionEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "16px",
                overflow: "hidden",
              }}
            >
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{ color: "var(--text-primary)", fontSize: "14px" }}
                  >
                    Compression Format
                  </span>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    style={{
                      padding: "8px 12px",
                      background: "var(--bg-root)",
                      color: "var(--text-primary)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      outline: "none",
                      flexShrink: 0,
                    }}
                  >
                    <option value="jpeg">Standard JPEG</option>
                    <option value="jxl" disabled={!isPro}>
                      Archival JPEG XL {!isPro && "(Pro Only)"}
                    </option>
                  </select>
                </div>
                <span
                  style={{
                    color: "var(--text-secondary)",
                    fontSize: "12px",
                    lineHeight: "1.4",
                  }}
                >
                  {outputFormat === "jxl"
                    ? "Archival JPEG XL is 25-30% smaller than regular JPEG and designed for long-term storage. "
                    : "Standard JPEG optimizes file size while retaining maximum compatibility across all older browsers and devices."}
                </span>

                {outputFormat === "jxl" && (
                  <div
                    style={{
                      marginTop: "16px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span
                        style={{
                          color: "var(--text-primary)",
                          fontSize: "14px",
                        }}
                      >
                        JXL Compression Effort
                      </span>
                      <select
                        value={jxlEffort}
                        onChange={(e) => setJxlEffort(parseInt(e.target.value))}
                        style={{
                          padding: "8px 12px",
                          background: "var(--bg-root)",
                          color: "var(--text-primary)",
                          border: "1px solid var(--border)",
                          borderRadius: "var(--radius-md)",
                          outline: "none",
                          flexShrink: 0,
                        }}
                      >
                        <option value={1}>1 (Fastest)</option>
                        <option value={2}>2</option>
                        <option value={3}>3 (Fast)</option>
                        <option value={4}>4</option>
                        <option value={5}>5 (Balanced)</option>
                        <option value={6}>6</option>
                        <option value={7}>7 (Strong - Default)</option>
                        <option value={8}>8</option>
                        <option value={9}>9 (Strongest)</option>
                      </select>
                    </div>
                    <span
                      style={{
                        color: "var(--text-secondary)",
                        fontSize: "12px",
                        lineHeight: "1.4",
                      }}
                    >
                      Higher effort values produce slightly better compression
                      ratios but dramatically increase processing time.
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
