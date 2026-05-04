import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import "./index.css";
import { CompressionView } from "./components/CompressionView";
import { ScannerView } from "./components/ScannerView";

import { SystemView } from "./components/SystemView";
import { StoreView } from "./components/StoreView";
import { AboutView } from "./components/AboutView";
import { SettingsView } from "./components/SettingsView";
import { Sidebar } from "./components/Sidebar";
import { EulaModal } from "./components/EulaModal";

import type { ProgressData, ElectronAPI } from "../shared/ipc-types";

export interface QueueJob {
  id: string;
  path: string;
  mode: "compress" | "restore" | "scan";
  status: "staging" | "pending" | "processing" | "done" | "failed";
  progressData: ProgressData | null;
}

declare global {
  interface Window {
    electron: ElectronAPI;
  }
}

type TTab =
  | "compress"
  | "decompress"
  | "system"
  | "about"
  | "store"
  | "scanner"
  | "settings";

export default function App() {
  const [activeTab, setActiveTab] = useState<TTab>("scanner");
  const [isGlobalProcessing, setIsGlobalProcessing] = useState(false);
  const [globalSavingsMB, setGlobalSavingsMB] = useState(0);
  const [dailySavingsMB, setDailySavingsMB] = useState(0);
  const [hasSeenTrialEnd, setHasSeenTrialEnd] = useState(false);
  const [platform, setPlatform] = useState<string>("unknown");

  // CompactOS State
  const [compactOsEnabled, setCompactOsEnabled] = useState<boolean | null>(
    null,
  );
  const [isCheckingOs, setIsCheckingOs] = useState(false);

  // Settings State
  const [theme, setTheme] = useState("system"); // Theme could be persisted too if needed, keeping simple for now
  const [nativeAlgo, setNativeAlgo] = useState<
    | "automatic"
    | "lzvn"
    | "lzfse"
    | "zlib"
    | "off"
    | "none"
    | "LZX"
    | "XPRESS16K"
    | "XPRESS8K"
    | "XPRESS4K"
  >(() => (localStorage.getItem("sw_nativeAlgo") as any) || "automatic");
  const [fileCompressionEnabled, setFileCompressionEnabled] = useState(
    () => localStorage.getItem("sw_fileComp") !== "false",
  );
  const [imageCompressionEnabled, setImageCompressionEnabled] = useState(
    () => localStorage.getItem("sw_imageComp") !== "false",
  );
  const [outputFormat, setOutputFormat] = useState<"jxl" | "jpeg" | "original">(
    () => (localStorage.getItem("sw_outputFormat") as any) || "jxl",
  );
  const [jxlEffort, setJxlEffort] = useState(() =>
    parseInt(localStorage.getItem("sw_jxlEffort") || "7"),
  );

  // Persist Settings
  useEffect(() => {
    localStorage.setItem("sw_nativeAlgo", nativeAlgo);
    localStorage.setItem("sw_fileComp", fileCompressionEnabled.toString());
    localStorage.setItem("sw_imageComp", imageCompressionEnabled.toString());
    localStorage.setItem("sw_outputFormat", outputFormat);
    localStorage.setItem("sw_jxlEffort", jxlEffort.toString());
  }, [
    nativeAlgo,
    fileCompressionEnabled,
    imageCompressionEnabled,
    outputFormat,
    jxlEffort,
  ]);

  // EULA State
  const [showEula, setShowEula] = useState(false);

  // Pro State
  const [isPro, setIsPro] = useState(false);

  // Scanner State
  const [isAdminUser, setIsAdminUser] = useState<boolean>(true);
  const [pendingScannerPaths, setPendingScannerPaths] = useState<string[]>([]);
  const [scannerEstimates, setScannerEstimates] = useState<{
    imageMB: number;
    fileMB: number;
  } | null>(null);
  const [autoStartCompression, setAutoStartCompression] = useState(false);

  useEffect(() => {
    const hasAgreed = localStorage.getItem("shrinkwizard_eula_agreed");
    if (!hasAgreed) {
      setShowEula(true);
    }
  }, []);

  const handleAgreeEula = () => {
    localStorage.setItem("shrinkwizard_eula_agreed", "true");
    setShowEula(false);
  };

  useEffect(() => {
    const isDarkOS = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedTheme =
      theme === "system" ? (isDarkOS ? "dark" : "light") : theme;
    if (resolvedTheme === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  }, [theme]);

  useEffect(() => {
    if (window.electron) {
      setPlatform(window.electron.platform);

      if (window.electron.platform === "win32") {
        checkCompactOS();
      }

      window.electron.getProStatus().then((status: boolean) => {
        setIsPro(status);
      });
      window.electron
        .getGlobalSavingsMB?.()
        .then((stats) => {
          if (stats) {
            setGlobalSavingsMB(stats.globalSavingsMB);
            setDailySavingsMB(stats.dailySavingsMB);
            setHasSeenTrialEnd(stats.hasSeenTrialEnd);
          }
        })
        .catch((_e: unknown) => {
          /* ignore */
        });
      window.electron.isAdmin().then((status: boolean) => {
        setIsAdminUser(status);
      });
    }
  }, []);

  useEffect(() => {
    const isCompact = async () => {
      const isCompact = await window.electron.queryCompactOS();
      setCompactOsEnabled(isCompact);
    };

    if (window.electron?.platform === "win32") {
      isCompact();
    }
  }, []);

  const checkCompactOS = async () => {
    setIsCheckingOs(true);
    try {
      const isCompact = await window.electron.queryCompactOS();
      setCompactOsEnabled(isCompact);
    } catch (err) {
      console.error(err);
    }
    setIsCheckingOs(false);
  };

  const toggleCompactOS = async () => {
    if (compactOsEnabled === null) return;
    try {
      await window.electron.toggleCompactOS(!compactOsEnabled);
      await checkCompactOS();
    } catch (err) {
      alert(`Failed to toggle CompactOS: ${err}`);
    }
  };

  const handleNavClick = (tabId: TTab) => {
    if (activeTab === tabId) return;
    if (isGlobalProcessing) {
      if (
        window.confirm(
          "An operation is currently running.\n\nDo you want to cancel it and switch tabs?",
        )
      ) {
        window.electron.abortScan();
        window.electron.abortProcess();
        setIsGlobalProcessing(false);
        setActiveTab(tabId);
      }
    } else {
      setActiveTab(tabId);
    }
  };

  return (
    <div className="app-container">
      <Sidebar
        activeTab={activeTab}
        isGlobalProcessing={isGlobalProcessing}
        isPro={isPro}
        globalSavingsMB={globalSavingsMB}
        dailySavingsMB={dailySavingsMB}
        hasSeenTrialEnd={hasSeenTrialEnd}
        platform={platform}
        handleNavClick={handleNavClick}
      />

      {/* EULA Modal */}
      <EulaModal showEula={showEula} handleAgreeEula={handleAgreeEula} />

      {/* Main Content Area */}
      <main className="main-content">
        <div className="main-drag-handle" />
        <AnimatePresence mode="wait">
          {activeTab === "compress" || activeTab === "decompress" ? (
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              style={{ width: "100%", height: "100%" }}
            >
              <CompressionView
                activeTab={activeTab}
                platform={platform}
                outputFormat={outputFormat}
                setOutputFormat={setOutputFormat as (v: any) => void}
                nativeAlgo={nativeAlgo}
                setNativeAlgo={setNativeAlgo as (v: any) => void}
                fileCompressionEnabled={fileCompressionEnabled}
                setFileCompressionEnabled={setFileCompressionEnabled}
                imageCompressionEnabled={imageCompressionEnabled}
                setImageCompressionEnabled={setImageCompressionEnabled}
                jxlEffort={jxlEffort}
                setJxlEffort={setJxlEffort}
                isPro={isPro}
                globalSavingsMB={globalSavingsMB}
                dailySavingsMB={dailySavingsMB}
                hasSeenTrialEnd={hasSeenTrialEnd}
                pendingScannerPaths={pendingScannerPaths}
                setPendingScannerPaths={setPendingScannerPaths}
                autoStartCompression={autoStartCompression}
                setAutoStartCompression={setAutoStartCompression}
                scannerEstimates={scannerEstimates}
                setScannerEstimates={setScannerEstimates}
                isAdminUser={isAdminUser}
                onProcessingChange={setIsGlobalProcessing}
                onSavingsUpdate={setGlobalSavingsMB}
              />
            </motion.div>
          ) : activeTab === "scanner" ? (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              style={{ width: "100%", height: "100%" }}
            >
              <ScannerView
                isAdminUser={isAdminUser}
                isPro={isPro}
                onMigrate={(paths, estimates) => {
                  setPendingScannerPaths(paths);
                  if (estimates) {
                    setScannerEstimates(estimates);
                  }
                  setActiveTab("compress");
                }}
                onProcessingChange={setIsGlobalProcessing}
              />
            </motion.div>
          ) : activeTab === "store" ? (
            <StoreView key="store" isPro={isPro} setIsPro={setIsPro} />
          ) : activeTab === "settings" ? (
            <SettingsView
              key="settings"
              platform={platform}
              theme={theme}
              setTheme={setTheme}
              nativeAlgo={nativeAlgo}
              setNativeAlgo={setNativeAlgo as any}
              imageCompressionEnabled={imageCompressionEnabled}
              setImageCompressionEnabled={setImageCompressionEnabled}
              jpegMetadata={false} // Assuming default as it was not in App state
              setJpegMetadata={() => {}}
              outputFormat={outputFormat}
              setOutputFormat={setOutputFormat as any}
              jxlEffort={jxlEffort}
              setJxlEffort={setJxlEffort}
              isPro={isPro}
              setIsPro={setIsPro}
            />
          ) : activeTab === "system" ? (
            <SystemView
              key="system"
              compactOsEnabled={compactOsEnabled}
              isCheckingOs={isCheckingOs}
              onToggleCompactOs={toggleCompactOS}
              isPro={isPro}
            />
          ) : (
            <AboutView key="about" platform={platform} />
          )}
        </AnimatePresence>
      </main>

      {/* Styles defined here to keep vanilla css easily readable for component specific logic */}
      <style>{`
        .app-container {
          display: flex;
          height: 100vh;
          width: 100vw;
          background-color: var(--bg-root);
        }

        .sidebar {
          width: 260px;
          background-color: var(--bg-primary);
          border-right: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          padding: 40px 16px 24px 16px;
          -webkit-app-region: drag;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 40px;
          padding: 0 12px;
        }

        .brand-icon {
          color: var(--accent-primary);
        }

        .brand-text {
          font-size: 20px;
          font-weight: 700;
          letter-spacing: -0.5px;
          color: var(--text-primary);
          background: var(--logo-gradient);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
        }

        .nav-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .nav-btn {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-radius: var(--radius-md);
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: var(--transition);
          -webkit-app-region: no-drag;
        }

        .nav-btn:hover {
          color: var(--text-primary);
          background-color: var(--border-light);
        }

        .nav-btn.active {
          color: var(--text-primary);
          background-color: var(--bg-tertiary);
          box-shadow: inset 2px 0 0 var(--accent-primary);
        }

        .main-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          background-color: var(--bg-secondary);
        }

        .main-drag-handle {
          height: 40px;
          width: 100%;
          -webkit-app-region: drag;
          flex-shrink: 0;
          z-index: 100;
        }

        .usage-tracker {
          background-color: var(--bg-secondary);
          border: 1px solid var(--border);
          border-radius: var(--radius-md);
          padding: 14px;
          margin-bottom: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          -webkit-app-region: no-drag;
        }

        .tracker-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .tracker-title {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .tracker-limit {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-secondary);
        }

        .tracker-value {
          font-size: 18px;
          font-weight: 700;
          color: var(--accent-primary);
          margin-top: 2px;
        }

        .tracker-bar-bg {
          width: 100%;
          height: 6px;
          background-color: var(--bg-tertiary);
          border-radius: 3px;
          overflow: hidden;
        }

        .tracker-bar-fill {
          height: 100%;
          background: var(--accent-primary);
          border-radius: 3px;
        }

        .tracker-label {
          font-size: 11px;
          color: var(--text-secondary);
        }

        .queue-siderail {
          width: 320px;
          background-color: var(--bg-primary);
          border-left: 1px solid var(--border);
          display: flex;
          flex-direction: column;
          height: 100vh;
        }

        .queue-section {
          display: flex;
          flex-direction: column;
          padding: 20px 16px;
          overflow: hidden;
        }

        .queue-section h3 {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary);
          margin-top: 0;
          margin-bottom: 12px;
          padding-left: 4px;
        }

        .active-queue {
          flex: 6; /* Top 60% */
          border-bottom: 1px solid var(--border);
        }

        .staging-area {
          flex: 4; /* Bottom 40% */
        }

        .queue-list {
          flex: 1;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        /* View styles */
        .view-container {
          padding: 0 40px 30px 40px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .view-header {
          margin-bottom: 32px;
          -webkit-app-region: drag;
        }

        .view-title {
          font-size: 28px;
          font-weight: 600;
          color: var(--text-primary);
          letter-spacing: -0.5px;
          margin-bottom: 8px;
        }

        .view-subtitle {
          color: var(--text-secondary);
          font-size: 15px;
        }

        /* Compression Drop Zone */
        .drop-zone {
          flex: 1;
          border: 2px dashed var(--border-light);
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background-color: var(--bg-tertiary);
          transition: var(--transition);
          cursor: pointer;
        }

        .drop-zone:hover {
          border-color: var(--accent-primary);
          background-color: rgba(99, 102, 241, 0.05);
        }

        .drop-zone-secondary {
          border: 2px dashed var(--border-light);
          border-radius: var(--radius-xl);
          display: flex;
          flex-direction: column;
          justify-content: center;
          background-color: transparent;
          transition: var(--transition);
          cursor: pointer;
          height: 120px;
          padding: 0 24px;
        }

        .drop-zone-secondary:hover {
          border-color: var(--accent-primary);
          background-color: rgba(99, 102, 241, 0.05);
        }

        /* Settings panels */
        .settings-card {
          background-color: var(--bg-tertiary);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 24px;
          margin-bottom: 24px;
        }

        .settings-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }

        .settings-card-title {
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary);
        }

        .toggle-btn {
          padding: 8px 16px;
          border-radius: 20px;
          font-weight: 500;
          font-size: 14px;
          cursor: pointer;
          transition: var(--transition);
          border: none;
        }

        .toggle-btn.btn-on {
          background-color: var(--accent-primary);
          color: white;
          box-shadow: 0 0 12px var(--accent-glow);
        }

        .toggle-btn.btn-off {
          background-color: var(--bg-secondary);
          color: var(--text-secondary);
          border: 1px solid var(--border);
        }

        /* EULA Overlay */
        .eula-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background-color: rgba(0, 0, 0, 0.85);
          backdrop-filter: blur(8px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 24px;
        }

        .eula-modal {
          background-color: var(--bg-primary);
          border: 1px solid var(--border);
          border-radius: var(--radius-xl);
          width: 100%;
          max-width: 540px;
          padding: 40px;
          box-shadow: var(--shadow-lg), 0 20px 40px rgba(0,0,0,0.5);
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .eula-icon-wrap {
          width: 64px;
          height: 64px;
          background-color: rgba(245, 158, 11, 0.1);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
        }

        .eula-modal h2 {
          text-align: center;
          font-size: 24px;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .eula-content {
          color: var(--text-secondary);
          font-size: 14px;
          line-height: 1.6;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .eula-warning-box {
          background-color: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: var(--radius-md);
          padding: 16px;
        }

        .eula-warning-box strong {
          color: var(--error);
          display: block;
          margin-bottom: 4px;
          font-size: 15px;
        }

        .eula-actions {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }
        
        .btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 12px 24px;
          border-radius: var(--radius-md);
          font-size: 15px;
          font-weight: 500;
          cursor: pointer;
          transition: var(--transition);
          border: none;
        }

        .btn-full {
          width: 100%;
        }

        .btn-primary {
          background-color: var(--accent-primary);
          color: white;
          box-shadow: var(--shadow-sm);
        }

        .btn-primary:hover {
          background-color: var(--accent-hover);
          box-shadow: var(--shadow-md), 0 0 12px var(--accent-glow);
        }

        .btn-secondary {
          background-color: var(--bg-secondary);
          color: var(--text-secondary);
          border: 1px solid var(--border);
        }

        .btn-secondary:hover {
          color: var(--text-primary);
          background-color: var(--border-light);
        }
      `}</style>
    </div>
  );
}
