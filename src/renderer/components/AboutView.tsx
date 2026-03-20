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
import npmLicenses from "../assets/npm-licenses.json";
import { bundledLicenses } from "../assets/bundled-licenses";

export function AboutView({ platform }: { platform: string }) {
  const [version, setVersion] = useState("");
  const [showLicenses, setShowLicenses] = useState(false);
  const [expandedLicenses, setExpandedLicenses] = useState<
    Record<string, boolean>
  >({});

  const toggleLicense = (name: string) => {
    setExpandedLicenses((prev) => ({ ...prev, [name]: !prev[name] }));
  };

  const handleViewLicenses = async () => {
    if (window.electron) {
      await window.electron.openLicenses();
    }
  };

  useEffect(() => {
    if (window.electron && window.electron.getAppVersion) {
      window.electron
        .getAppVersion()
        .then(setVersion)
        .catch(() => setVersion("Unknown"));
    }
  }, []);

  if (showLicenses) {
    return (
      <motion.div
        className="view-container"
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.2 }}
        style={{
          display: "flex",
          flexDirection: "column",
          flex: 1,
          overflowY: "auto",
          scrollbarGutter: "stable",
        }}
      >
        <div
          className="view-header"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "16px",
            marginBottom: "16px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => setShowLicenses(false)}
            className="toggle-btn btn-off"
            style={{
              padding: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
            }}
          >
            <ChevronRight size={20} style={{ transform: "rotate(180deg)" }} />
          </button>
          <div>
            <h1 className="view-title" style={{ marginBottom: 0 }}>
              Open Source Licenses
            </h1>
          </div>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            scrollbarGutter: "stable",
            paddingRight: "12px",
            paddingBottom: "32px",
          }}
        >
          <h2
            style={{
              color: "var(--text-primary)",
              fontSize: "16px",
              marginBottom: "16px",
            }}
          >
            Bundled Binaries
          </h2>
          {bundledLicenses.map((license) => (
            <div
              key={license.name}
              className="settings-card"
              style={{ padding: "16px", marginBottom: "16px" }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  marginBottom: "12px",
                }}
              >
                <h3
                  style={{
                    color: "var(--text-primary)",
                    margin: 0,
                    fontSize: "15px",
                  }}
                >
                  {license.name}
                </h3>
                <span
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    background: "var(--bg-secondary)",
                    padding: "4px 8px",
                    borderRadius: "4px",
                  }}
                >
                  {license.license}
                </span>
              </div>
              {license.url && (
                <p
                  style={{
                    fontSize: "12px",
                    color: "var(--text-secondary)",
                    marginBottom: "12px",
                    wordBreak: "break-all",
                  }}
                >
                  Source:{" "}
                  <a
                    href={license.url}
                    style={{
                      color: "var(--accent-primary)",
                      textDecoration: "none",
                    }}
                  >
                    {license.url}
                  </a>
                </p>
              )}

              <button
                onClick={() => toggleLicense(license.name)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--accent-primary)",
                  fontSize: "13px",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  cursor: "pointer",
                  padding: 0,
                  marginBottom: expandedLicenses[license.name] ? "12px" : 0,
                }}
              >
                {expandedLicenses[license.name]
                  ? "Hide License Text"
                  : "Show License Text"}
                <ChevronDown
                  size={14}
                  style={{
                    transform: expandedLicenses[license.name]
                      ? "rotate(180deg)"
                      : "none",
                    transition: "transform 0.2s",
                  }}
                />
              </button>

              <AnimatePresence initial={false}>
                {expandedLicenses[license.name] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: "hidden" }}
                  >
                    <div
                      style={{
                        background: "var(--bg-root)",
                        padding: "12px",
                        borderRadius: "var(--radius-md)",
                        maxHeight: "200px",
                        overflowY: "auto",
                        scrollbarGutter: "stable",
                        fontSize: "11px",
                        color: "var(--text-secondary)",
                        fontFamily: "monospace",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {license.content}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          <h2
            style={{
              color: "var(--text-primary)",
              fontSize: "16px",
              marginTop: "32px",
              marginBottom: "16px",
            }}
          >
            NPM Dependencies
          </h2>
          {Object.entries(npmLicenses).map(
            ([pkgName, details]: [string, any]) => (
              <div
                key={pkgName}
                className="settings-card"
                style={{
                  padding: "16px",
                  marginBottom: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                  }}
                >
                  <h3
                    style={{
                      color: "var(--text-primary)",
                      margin: 0,
                      fontSize: "14px",
                      wordBreak: "break-all",
                      paddingRight: "12px",
                    }}
                  >
                    {pkgName}
                  </h3>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: "11px",
                      color: "var(--text-secondary)",
                      background: "var(--bg-secondary)",
                      padding: "4px 8px",
                      borderRadius: "4px",
                    }}
                  >
                    {typeof details.licenses === "string"
                      ? details.licenses
                      : Array.isArray(details.licenses)
                        ? details.licenses.join(", ")
                        : "Unknown"}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {details.repository && (
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        margin: 0,
                        wordBreak: "break-all",
                      }}
                    >
                      Repository:{" "}
                      <a
                        href={
                          typeof details.repository === "string"
                            ? details.repository
                            : details.repository.url
                        }
                        style={{
                          color: "var(--accent-primary)",
                          textDecoration: "none",
                        }}
                      >
                        {typeof details.repository === "string"
                          ? details.repository
                          : details.repository.url}
                      </a>
                    </p>
                  )}
                  {details.publisher && (
                    <p
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        margin: 0,
                      }}
                    >
                      Publisher: {details.publisher}
                    </p>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className="view-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="view-header">
        <h1 className="view-title">About Shrink Wizard</h1>
        <p className="view-subtitle">
          System information and open source licenses.
        </p>
      </div>

      <div className="settings-card">
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ color: "var(--text-primary)", fontSize: "14px" }}>
              App Version
            </span>
            <span style={{ color: "var(--text-secondary)", fontSize: "14px" }}>
              {version}
            </span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <span style={{ color: "var(--text-primary)", fontSize: "14px" }}>
              Operating System
            </span>
            <span
              style={{
                color: "var(--text-secondary)",
                fontSize: "14px",
                textTransform: "capitalize",
              }}
            >
              {platform === "darwin"
                ? "macOS"
                : platform === "win32"
                  ? "Windows"
                  : platform}
            </span>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-header" style={{ marginBottom: 0 }}>
          <div>
            <h2 className="settings-card-title">Open Source Licenses</h2>
            <p
              style={{
                color: "var(--text-secondary)",
                fontSize: "14px",
                marginTop: "4px",
              }}
            >
              Shrink Wizard is made possible by open source software.
            </p>
          </div>
          <button
            className="toggle-btn btn-on"
            onClick={() => setShowLicenses(true)}
          >
            View Licenses
          </button>
        </div>
      </div>

      <div
        style={{
          marginTop: "16px",
          display: "flex",
          gap: "24px",
          justifyContent: "center",
        }}
      >
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.electron.openUrl("https://shrinkwizard.com/terms.html");
          }}
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            textDecoration: "underline",
          }}
        >
          Terms of Service
        </a>
        <a
          href="#"
          onClick={(e) => {
            e.preventDefault();
            window.electron.openUrl("https://shrinkwizard.com/privacy.html");
          }}
          style={{
            fontSize: "13px",
            color: "var(--text-secondary)",
            textDecoration: "underline",
          }}
        >
          Privacy Policy
        </a>
      </div>
    </motion.div>
  );
}
