import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { httpsCallable } from 'firebase/functions';
import { functions } from './firebase';
import { HardDrive, Settings, Search, CheckCircle, AlertTriangle, ChevronRight, X, File, Zap, Info, ArrowUpDown, ChevronDown, Sparkles } from 'lucide-react';
import npmLicenses from './assets/npm-licenses.json';
import { bundledLicenses } from './assets/bundled-licenses';
import './index.css';
import type { ProgressData } from '../shared/ipc-types';

// Helper to truncate middle of paths
const formatPath = (fullPath: string) => {
  if (fullPath.length <= 40) return fullPath;
  const parts = fullPath.split('/');
  if (parts.length <= 2) return fullPath.slice(0, 15) + '...' + fullPath.slice(-15);
  return `.../${parts[parts.length - 2]}/${parts[parts.length - 1]}`;
};

const formatBytes = (mb: number | undefined, fixed: boolean = false) => {
  if (!mb) return '0 MB';
  const isNegative = mb < 0;
  const absMb = Math.abs(mb);

  const formatted = (() => {
    const rawBytes = absMb * 1024 * 1024;
    if (!fixed) {
       // Original dynamic precision fallback for secondary text
       if (rawBytes >= 1000 * 1000 * 1000) return `${parseFloat((rawBytes / 1e9).toFixed(2))} GB`;
       if (rawBytes >= 1000 * 1000) return `${parseFloat((rawBytes / 1e6).toFixed(1))} MB`;
       if (rawBytes >= 1000) return `${parseFloat((rawBytes / 1e3).toFixed(0))} KB`;
       return `${rawBytes.toFixed(0)} B`;
    }
    // Fixed UI Cards Mode
    // Prevent 1000.00 by forcing the unit bump at strictly 999.99
    if (rawBytes >= 999.995 * 1000 * 1000) return `${(rawBytes / 1e9).toFixed(2)} GB`;
    if (rawBytes >= 999.995 * 1000) return `${(rawBytes / 1e6).toFixed(2)} MB`;
    if (rawBytes >= 999.995) return `${(rawBytes / 1e3).toFixed(2)} KB`;
    return `${rawBytes.toFixed(0)} B`;
  })();

  return isNegative ? `-${formatted}` : formatted;
};

const formatCompactNumber = (num: number | undefined) => {
  if (num === undefined) return '0';
  return Intl.NumberFormat('en-US', {
    notation: 'compact',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(num);
};

export interface QueueJob {
  id: string;
  path: string;
  mode: 'compress' | 'restore' | 'scan';
  status: 'staging' | 'pending' | 'processing' | 'done' | 'failed';
  progressData: ProgressData | null;
}

declare global {
  interface Window {
    electron: any;
  }
}

type TTab = 'compress' | 'decompress' | 'settings' | 'about' | 'store' | 'scanner';

export default function App() {
  const [activeTab, setActiveTab] = useState<TTab>('scanner');
  const [isGlobalProcessing, setIsGlobalProcessing] = useState(false);
  const [platform, setPlatform] = useState<string>('unknown');

  // CompactOS State
  const [compactOsEnabled, setCompactOsEnabled] = useState<boolean | null>(null);
  const [isCheckingOs, setIsCheckingOs] = useState(false);

  // Settings State
  const [theme, setTheme] = useState('system');
  const [nativeAlgo, setNativeAlgo] = useState('automatic');
  const [imageCompressionEnabled, setImageCompressionEnabled] = useState(true);
  const [jpegMetadata, setJpegMetadata] = useState(true);
  const [outputFormat, setOutputFormat] = useState('jpeg');
  const [jxlEffort, setJxlEffort] = useState(7);

  // EULA State
  const [showEula, setShowEula] = useState(false);

  // Pro State
  const [isPro, setIsPro] = useState(false);

  // Scanner State
  const [isAdminUser, setIsAdminUser] = useState<boolean>(true);
  const [pendingScannerPaths, setPendingScannerPaths] = useState<string[]>([]);
  const [autoStartCompression, setAutoStartCompression] = useState(false);

  useEffect(() => {
    const hasAgreed = localStorage.getItem('shrinkwizard_eula_agreed');
    if (!hasAgreed) {
      setShowEula(true);
    }
  }, []);

  const handleAgreeEula = () => {
    localStorage.setItem('shrinkwizard_eula_agreed', 'true');
    setShowEula(false);
  };

  useEffect(() => {
    const isDarkOS = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const resolvedTheme = theme === 'system' ? (isDarkOS ? 'dark' : 'light') : theme;
    if (resolvedTheme === 'light') {
      document.documentElement.setAttribute('data-theme', 'light');
    } else {
      document.documentElement.removeAttribute('data-theme');
    }
  }, [theme]);

  useEffect(() => {
    if (window.electron) {
      setPlatform(window.electron.platform);
      setOutputFormat(window.electron.platform === 'darwin' || window.electron.platform === 'win32' ? 'jxl' : 'jpeg');

      if (window.electron.platform === 'win32') {
        checkCompactOS();
      }

      window.electron.getProStatus().then((status: boolean) => {
        setIsPro(status);
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

    if (window.electron?.platform === 'win32') {
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
      if (window.confirm("An operation is currently running.\n\nDo you want to cancel it and switch tabs?")) {
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
      {/* Sidebar Navigation */}
      <nav className="sidebar">
        <div className="brand">
          <Zap className="brand-icon" size={28} />
          <span className="brand-text">Shrink Wizard</span>
        </div>

        <div className="nav-items">
          <button
            className={`nav-btn ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => handleNavClick('scanner')}
            style={{ opacity: isGlobalProcessing && activeTab !== 'scanner' ? 0.5 : 1, cursor: isGlobalProcessing && activeTab !== 'scanner' ? 'not-allowed' : 'pointer' }}
          >
            <Search size={20} />
            <span>Scanner</span>
          </button>

          <button
            className={`nav-btn ${activeTab === 'compress' ? 'active' : ''}`}
            onClick={() => handleNavClick('compress')}
            style={{ opacity: isGlobalProcessing && activeTab !== 'compress' ? 0.5 : 1, cursor: isGlobalProcessing && activeTab !== 'compress' ? 'not-allowed' : 'pointer' }}
          >
            <HardDrive size={20} />
            <span>Compress</span>
          </button>

          <button
            className={`nav-btn ${activeTab === 'decompress' ? 'active' : ''}`}
            onClick={() => handleNavClick('decompress')}
            style={{ opacity: isGlobalProcessing && activeTab !== 'decompress' ? 0.5 : 1, cursor: isGlobalProcessing && activeTab !== 'decompress' ? 'not-allowed' : 'pointer' }}
          >
            <Zap size={20} />
            <span>Decompress</span>
          </button>

          <button
            className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => handleNavClick('settings')}
            style={{ opacity: isGlobalProcessing && activeTab !== 'settings' ? 0.5 : 1, cursor: isGlobalProcessing && activeTab !== 'settings' ? 'not-allowed' : 'pointer' }}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>

          <div style={{ flex: 1 }} /> {/* Spacer */}

          <button
            className={`nav-btn ${activeTab === 'store' ? 'active' : ''}`}
            onClick={() => handleNavClick('store')}
            style={{
              color: isPro ? 'var(--success)' : 'var(--accent-primary)',
              background: activeTab === 'store' ? 'var(--bg-secondary)' : isPro ? 'rgba(16, 185, 129, 0.1)' : 'rgba(99, 102, 241, 0.1)',
              opacity: isGlobalProcessing && activeTab !== 'store' ? 0.5 : 1,
              cursor: isGlobalProcessing && activeTab !== 'store' ? 'not-allowed' : 'pointer'
            }}
          >
            {isPro ? <CheckCircle size={20} /> : <Zap size={20} />}
            <span>{isPro ? 'Pro Active' : 'Upgrade to Pro'}</span>
          </button>

          <button
            className={`nav-btn ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => handleNavClick('about')}
            style={{ opacity: isGlobalProcessing && activeTab !== 'about' ? 0.5 : 1, cursor: isGlobalProcessing && activeTab !== 'about' ? 'not-allowed' : 'pointer' }}
          >
            <Info size={20} />
            <span>About</span>
          </button>
        </div>
      </nav>

      {/* EULA Modal */}
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
                <p>Welcome to Shrink Wizard! Before you shrink your first file, please read and acknowledge the following:</p>

                <div className="eula-warning-box">
                  <strong>Critical Warning</strong>
                  <p>Shrink Wizard alters your files in-place on your storage drive to reclaim space. While the algorithms used are strictly lossless, unexpected events during processing (such as a power outage, operating system crash, or hardware failure) can result in irreversible data corruption.</p>
                </div>

                <p><strong>Backups are recommended.</strong> While data loss is extremely unlikely, unexpected events (such as power outages or hardware failures) can occur.</p>
                <p>By clicking "I Agree", you also accept our standard <a href="#" onClick={(e) => { e.preventDefault(); window.electron.openUrl('https://shrinkwizard.com/terms.html'); }}>Terms of Service</a> and <a href="#" onClick={(e) => { e.preventDefault(); window.electron.openUrl('https://shrinkwizard.com/privacy.html'); }}>Privacy Policy</a>.</p>
              </div>
              <div className="eula-actions">
                <button className="btn btn-primary btn-full" onClick={handleAgreeEula}>
                  <CheckCircle size={18} /> I Agree to the Terms
                </button>
                <button className="btn btn-secondary btn-full" onClick={() => window.close()}>
                  Quit Application
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          {activeTab === 'compress' || activeTab === 'decompress' ? (

            <motion.div
              key={activeTab}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              style={{ width: '100%', height: '100%' }}
            >
              <CompressionView
                activeTab={activeTab}
                outputFormat={outputFormat}
                nativeAlgo={nativeAlgo}
                imageCompressionEnabled={imageCompressionEnabled}
                jpegMetadata={jpegMetadata}
                jxlEffort={jxlEffort}
                isPro={isPro}
                pendingScannerPaths={pendingScannerPaths}
                setPendingScannerPaths={setPendingScannerPaths}
                autoStartCompression={autoStartCompression}
                setAutoStartCompression={setAutoStartCompression}
                isAdminUser={isAdminUser}
                onProcessingChange={setIsGlobalProcessing}
              />
            </motion.div>
          ) : activeTab === 'scanner' ? (
            <motion.div
              key="scanner"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
              style={{ width: '100%', height: '100%' }}
            >
              <ScannerView
                isAdminUser={isAdminUser}
                isPro={isPro}
                onMigrate={(paths) => {
                  setPendingScannerPaths(paths);
                  setActiveTab('compress');
                }}
                onProcessingChange={setIsGlobalProcessing}
              />
            </motion.div>
          ) : activeTab === 'settings' ? (
            <SettingsView
              key="settings"
              platform={platform}
              compactOsEnabled={compactOsEnabled}
              isCheckingOs={isCheckingOs}
              onToggleCompactOs={toggleCompactOS}
              theme={theme} setTheme={setTheme}
              nativeAlgo={nativeAlgo} setNativeAlgo={setNativeAlgo}
              imageCompressionEnabled={imageCompressionEnabled} setImageCompressionEnabled={setImageCompressionEnabled}
              jpegMetadata={jpegMetadata} setJpegMetadata={setJpegMetadata}
              outputFormat={outputFormat} setOutputFormat={setOutputFormat}
              jxlEffort={jxlEffort} setJxlEffort={setJxlEffort}
              isPro={isPro}
            />
          ) : activeTab === 'store' ? (
            <StoreView key="store" isPro={isPro} setIsPro={setIsPro} />
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
          padding: 30px 40px;
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

function CompressionView({
  activeTab,
  outputFormat,
  nativeAlgo,
  imageCompressionEnabled,
  jpegMetadata,
  jxlEffort,
  isPro,
  pendingScannerPaths,
  setPendingScannerPaths,
  autoStartCompression,
  setAutoStartCompression,
  isAdminUser,
  onProcessingChange
}: {
  activeTab: 'compress' | 'decompress',
  outputFormat: string,
  nativeAlgo: string,
  imageCompressionEnabled: boolean,
  jpegMetadata: boolean,
  jxlEffort: number,
  isPro?: boolean,
  pendingScannerPaths?: string[],
  setPendingScannerPaths?: (paths: string[]) => void,
  autoStartCompression?: boolean,
  setAutoStartCompression?: (val: boolean) => void,
  isAdminUser?: boolean,
  onProcessingChange: (processing: boolean) => void
}) {
  const [activeQueue, setActiveQueue] = useState<QueueJob[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [doneQueueHeight, setDoneQueueHeight] = useState(30);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [globalSavingsMB, setGlobalSavingsMB] = useState(0);
  const [showLimitModal, setShowLimitModal] = useState(false);
  const [sudoFailed, setSudoFailed] = useState(false);
  const [outOfSpace, setOutOfSpace] = useState(false);
  const [isDraggingOverTarget, setIsDraggingOverTarget] = useState(false);
  const isProcessingRef = useRef(false);

  // maxSlots has been intentionally removed in favor of CSS infinite scroll boundaries
  useEffect(() => {
    // 
  }, []);

  useEffect(() => {
    onProcessingChange(isProcessing);
  }, [isProcessing, onProcessingChange]);
  const isCompress = activeTab === 'compress';

  useEffect(() => {
    if (pendingScannerPaths && pendingScannerPaths.length > 0 && setPendingScannerPaths) {
      const newJobs: QueueJob[] = pendingScannerPaths.map((f: string) => ({
        id: Math.random().toString(36).substring(7),
        path: f,
        mode: isCompress ? 'compress' : 'restore',
        status: 'pending',
        progressData: null
      }));
      setActiveQueue(prev => [...prev, ...newJobs]);
      setPendingScannerPaths([]);
    }
  }, [pendingScannerPaths, setPendingScannerPaths, isCompress]);

  useEffect(() => {
    if (autoStartCompression && activeQueue.some(j => j.status === 'pending') && !isProcessing && setAutoStartCompression) {
      setAutoStartCompression(false);
      startQueue();
    }
  }, [autoStartCompression, activeQueue, isProcessing, setAutoStartCompression]);

  useEffect(() => {
    if (!isDraggingDivider) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Calculate split percentage based on mouse position relative to window height.
      // Siderail fits the screen vertically minus top padding, but percent of unscaled 
      // viewport height works great for intuitive resizing.
      const windowHeight = window.innerHeight;
      const mouseVertical = e.clientY;
      const heightPercent = ((windowHeight - mouseVertical) / windowHeight) * 100;

      if (heightPercent >= 5 && heightPercent <= 90) {
        setDoneQueueHeight(heightPercent);
      }
    };

    const handleMouseUp = () => setIsDraggingDivider(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  useEffect(() => {
    if (window.electron) {
      window.electron.getGlobalSavingsMB().then((val: number) => setGlobalSavingsMB(val));

      window.electron.onProgress((data: any) => {
        if (data.globalSavingsMB !== undefined) {
          setGlobalSavingsMB(data.globalSavingsMB);
        }
        if (data.sudoFailed !== undefined && data.sudoFailed) {
          setSudoFailed(true);
        }
        if (data.outOfSpace !== undefined && data.outOfSpace) {
          setOutOfSpace(true);
        }
        setActiveQueue(prev => prev.map(job => {
          if (job.status === 'processing' || job.status === 'pending') {
            return { ...job, status: 'processing', progressData: data };
          }
          return job;
        }));
      });

      window.electron.onLimitReached(() => {
        setIsPaused(true);
        setShowLimitModal(true);
      });

      return () => {
        window.electron.removeProgressListeners();
        window.electron.removeLimitReachedListeners();
      };
    }
  }, []);

  const needsElevation = activeQueue.some(j => j.path === '/' || j.path.startsWith('/Applications') || j.path.startsWith('/System') || j.path.startsWith('/Library'));

  const totalProcessedMB = activeQueue.reduce((acc, job) => acc + (job.progressData?.processedMB || 0), 0);
  const totalSavingsMB = activeQueue.reduce((acc, job) => acc + (job.progressData?.savingsMB || 0), 0);
  const totalCompressed = activeQueue.reduce((acc, job) => acc + (job.progressData?.compressedCount || 0), 0);
  const totalSkipped = activeQueue.reduce((acc, job) => acc + (job.progressData?.skippedCount || 0), 0);
  const totalSkippedMB = activeQueue.reduce((acc, job) => acc + (job.progressData?.skippedMB || 0), 0);
  const totalFailed = activeQueue.reduce((acc, job) => acc + (job.progressData?.failedCount || 0), 0);
  const totalIncompressible = activeQueue.reduce((acc, job) => acc + (job.progressData?.alreadyCompressedCount || 0), 0);

  const percentSaved = totalProcessedMB > 0 ? Math.round((totalSavingsMB / totalProcessedMB) * 100) : 0;
  // If negative savings (uncompressing), it's using more space, so we still show %, but perhaps negative
  // 97 KB (-15%)
  const displayPercent = percentSaved > 0 ? `(${percentSaved}%)` : (percentSaved < 0 ? `(${percentSaved}%)` : '');

  const inProgressJobs = activeQueue.filter(j => j.status !== 'done');
  const doneJobs = activeQueue.filter(j => j.status === 'done');

  const handleSelectFiles = async (filesOnly: boolean = false) => {
    if (window.electron) {
      const files = filesOnly ? await window.electron.openFiles() : await window.electron.openDirectory();
      if (files && files.length > 0) {
        const newJobs: QueueJob[] = files.map((f: string) => ({
          id: Math.random().toString(36).substring(7),
          path: f,
          mode: isCompress ? 'compress' : 'restore',
          status: 'pending',
          progressData: null
        }));
        setActiveQueue(prev => [...prev, ...newJobs]);
      }
    }
  };

  const handleFixNow = () => {
    if (window.electron) window.electron.abortProcess();
    isProcessingRef.current = false;
    setIsProcessing(false);
    setActiveQueue(prev => prev.map(job => ({
      ...job,
      status: 'pending',
      progressData: null
    })));
    setSudoFailed(false);
    setOutOfSpace(false);
    setTimeout(() => {
      startQueue();
    }, 250);
  };

  const startQueue = async () => {
    setSudoFailed(false);
    setOutOfSpace(false);
    if (isProcessingRef.current) return;
    if (!window.electron) return;

    isProcessingRef.current = true;
    setIsProcessing(true);

    const getNextJob = () => new Promise<QueueJob | undefined>(resolve => {
      let jobTarget: QueueJob | undefined;
      setActiveQueue(prev => {
        const nextJob = prev.find(j => j.status === 'pending');
        if (!jobTarget) {
          jobTarget = nextJob;
          setTimeout(() => resolve(nextJob), 0);
        }
        if (nextJob) {
          return prev.map(j => j.id === nextJob.id ? { ...j, status: 'processing', progressData: { phase: 'scanning', totalMB: 0, processedMB: 0, savingsMB: 0, percentage: 0, compressedCount: 0, skippedCount: 0, skippedMB: 0, failedCount: 0, alreadyCompressedCount: 0, totalFiles: 0 } } : j);
        }
        return prev;
      });
    });

    while (isProcessingRef.current) {
      let nextJob = await getNextJob();

      if (!nextJob) {
        isProcessingRef.current = false;
        setIsProcessing(false);
        break;
      }

      if (window.electron) window.electron.removeProgressListeners();
      window.electron.onProgress((data: ProgressData) => {
        setActiveQueue(prev => prev.map(j => j.id === nextJob!.id ? { ...j, progressData: data } : j));
      });

      try {
        await window.electron.processPaths([nextJob.path], nextJob.mode, {
          outputFormat, nativeAlgo, imageCompressionEnabled, jpegMetadata, effort: jxlEffort, isPro
        });

        setActiveQueue(prev => prev.map(j => j.id === nextJob!.id ? { ...j, status: 'done', progressData: j.progressData ? { ...j.progressData, phase: 'done', percentage: 100 } : null } : j));
      } catch (err) {
        console.error('Process error:', err);
        setActiveQueue(prev => prev.map(j => j.id === nextJob!.id ? { ...j, status: 'failed' } : j));
      } finally {
        if (window.electron) window.electron.removeProgressListeners();
      }
    }

    // Once loop terminates normally
    if (window.electron) {
      window.electron.removeProgressListeners();
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden', position: 'relative' }}>
      <motion.div
        className="view-container"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', scrollbarGutter: 'stable', position: 'relative' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!isDraggingOverTarget) setIsDraggingOverTarget(true);
        }}
        onDragEnter={(e) => {
          e.preventDefault();
          setIsDraggingOverTarget(true);
        }}
        onDragLeave={(e) => {
          e.preventDefault();
          // Ensure we don't flicker on child elements by checking relatedTarget
          if (!e.currentTarget.contains(e.relatedTarget as Node)) {
            setIsDraggingOverTarget(false);
          }
        }}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOverTarget(false);

          if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            // Electron v30+ with context isolation strips the .path property from the native HTML5 File struct during synthetic React drag events.
            // We must pipe the raw File object over the Preload boundary via webUtils to legally extract its absolute path.
            const paths = Array.from(e.dataTransfer.files).map(f => window.electron.getPathForFile(f as File));

            const newJobs: QueueJob[] = paths.map(p => ({
              id: Math.random().toString(36).substring(7),
              path: p,
              mode: isCompress ? 'compress' : 'restore',
              status: 'pending',
              progressData: null
            }));
            setActiveQueue(prev => [...prev, ...newJobs]);
          }
        }}
      >
        <AnimatePresence>
          {isDraggingOverTarget && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              style={{
                position: 'absolute',
                top: 0, left: 0, right: 0, bottom: 0,
                background: isCompress ? 'rgba(99, 102, 241, 0.1)' : 'rgba(245, 158, 11, 0.1)',
                backdropFilter: 'blur(4px)',
                zIndex: 50,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexDirection: 'column',
                gap: '16px',
                border: `4px dashed ${isCompress ? 'var(--accent-primary)' : 'var(--warning)'}`,
                borderRadius: '8px',
                margin: '16px',
                pointerEvents: 'none' // lets the drop event hit the container underneath
              }}
            >
              <div style={{
                background: 'var(--bg-root)',
                padding: '24px',
                borderRadius: '50%',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
              }}>
                <HardDrive size={64} color={isCompress ? "var(--accent-primary)" : "var(--warning)"} />
              </div>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '28px', fontWeight: 'bold', textShadow: '0 2px 4px rgba(0,0,0,0.5)' }}>
                Drop to {isCompress ? 'Compress' : 'Decompress'}
              </h2>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
          <div>
            <h1 className="view-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              {isCompress ? <><HardDrive className="text-primary" /> Shrink Your Data</> : <><Zap className="text-secondary" /> Restore Your Data</>}
            </h1>
            <p className="view-subtitle" style={{ maxWidth: '600px' }}>
              {isCompress
                ? "Drop files, folders, photos, and/or applications here to shrink them gracefully."
                : "Drop previously compressed files here to reverse the compression."}
            </p>
          </div>
        </div>

        {(needsElevation && !isAdminUser) || sudoFailed ? (
          <div style={{ marginBottom: '24px', padding: '12px 16px', background: 'rgba(245, 158, 11, 0.1)', border: '1px solid var(--warning)', borderRadius: '8px', color: 'var(--warning)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <AlertTriangle size={18} />
              <span style={{ fontSize: '14px', lineHeight: '1.5' }}>
                {sudoFailed ? (
                  <>{formatBytes(totalSkippedMB, true)} of files skipped due to <strong>missing Admin permissions.</strong></>
                ) : (
                  <><strong>Some of these files require Admin permissions.</strong> You will be asked for an Admin Login.</>
                )}
              </span>
            </div>
            {sudoFailed && (
              <button className="btn" style={{ background: 'transparent', border: '1px solid var(--warning)', color: 'var(--warning)', padding: '6px 16px', fontSize: '13px', fontWeight: 'bold' }} onClick={handleFixNow}>Fix Now</button>
            )}
          </div>
        ) : null}


        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: '24px' }}>
          {/* Always show the slim Drop Zone when Pre-Compression */}
          {!isProcessing && doneJobs.length === 0 && (
            <>
              <div
                className="drop-zone"
                style={{
                  background: 'var(--bg-secondary)',
                  border: '2px dashed var(--border)',
                  borderRadius: 'var(--radius-xl)',
                  padding: '32px',
                  textAlign: 'center',
                  transition: 'all 0.2s',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '12px'
                }}
                onDragOver={(e) => { e.preventDefault(); }}
                onDrop={(e) => {
                  // Bubbles up to view-container smoothly
                  e.preventDefault();
                }}
                onClick={() => handleSelectFiles(false)}
              >
                <HardDrive size={32} color={isCompress ? "var(--accent-primary)" : "var(--text-secondary)"} />
                <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '500', color: 'var(--text-primary)' }}>
                  {isCompress ? "Select Items to Compress" : "Select Items to Decompress"}
                </h3>
                <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>or drag and drop anywhere in this window</p>

                {window.electron?.platform === 'win32' && (
                  <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '16px' }}
                      onClick={(e) => { e.stopPropagation(); handleSelectFiles(false); }}
                    >Select Folders</button>
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: '13px', padding: '8px 16px', borderRadius: '16px' }}
                      onClick={(e) => { e.stopPropagation(); handleSelectFiles(true); }}
                    >Select Files</button>
                  </div>
                )}
              </div>

              {/* Ghosted button shown explicitly when queue is empty so users know dropping a file won't auto-start immediately */}
              {activeQueue.length === 0 && (
                <div style={{
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-xl)',
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  boxShadow: 'var(--shadow-sm)'
                }}>
                  <div style={{ padding: '20px 24px', display: 'flex', gap: '16px', background: 'var(--bg-root)' }}>
                    <button
                      className="btn btn-primary"
                      style={{ flex: 1, padding: '14px', fontSize: '16px', fontWeight: '600', opacity: 0.5, cursor: 'not-allowed' }}
                    >
                      Start Processing
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {/* New Central Queue Data */}
          {activeQueue.length > 0 && (
            <div style={{
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-xl)',
              border: '1px solid var(--border)',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: 'var(--shadow-sm)',
              flex: 1,
              minHeight: 0
            }}>

              {/* Active / Finished Queue Header Metrics */}
              {(isProcessing || doneJobs.length > 0) && (
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px', padding: '24px', background: 'var(--bg-root)', borderBottom: '1px solid var(--border)' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px' }}>{isCompress ? 'Total Saved' : 'Size Increase'}</div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div id="live-savings-val" style={{ fontSize: '36px', fontWeight: '700', color: isCompress ? 'var(--success)' : 'var(--warning)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{formatBytes(Math.abs(totalSavingsMB), true)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px' }}>Processed Data</div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div id="live-scanned-val" style={{ fontSize: '36px', fontWeight: '700', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{formatBytes(totalProcessedMB, true)}</div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center', padding: '16px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px' }}>Files Processed</div>
                      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <div id="live-files-val" style={{ fontSize: '36px', fontWeight: '700', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{formatCompactNumber(totalCompressed + totalSkipped + totalFailed + totalIncompressible)}</div>
                      </div>
                    </div>
                  </div>

                  {outOfSpace && (
                    <div style={{ background: 'var(--error)', color: '#fff', padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: '15px', fontWeight: '600' }}>Decompression stopped. You have less than 2.00 GB of free space left on your active drive!</span>
                    </div>
                  )}
                </div>
              )}

              {/* Pre-Compression Info Header */}
              {!isProcessing && doneJobs.length === 0 && (
                <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Ready to Process ({activeQueue.length} items)</h3>
                  <button
                    className="toggle-btn btn-off"
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                    onClick={() => setActiveQueue([])}
                  >
                    Clear All
                  </button>
                </div>
              )}

              {/* Dynamic Queue List Generator */}
              <div style={{ display: 'flex', flexDirection: 'column', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {(() => {
                  let displayJobs: QueueJob[] = [];
                  let remainingCount = 0;

                  if (!isProcessing && doneJobs.length === 0) {
                    // Pre-Compression State: Show all pending up to 250 explicitly inside the scroll window
                    displayJobs = activeQueue.slice(0, 250);
                    remainingCount = Math.max(0, activeQueue.length - 250);

                  } else if (!isProcessing && doneJobs.length > 0 && inProgressJobs.length === 0) {
                    // Post-Compression State: Show all completed chronologically reversed up to 250
                    displayJobs = doneJobs.slice().reverse().slice(0, 250);
                    remainingCount = Math.max(0, doneJobs.length - 250);

                  } else {
                    // Active/Paused Running State -> Show recent done, active, and upcoming items up to 250!
                    // It infinitely scrolls, so we just aggregate the list
                    const recentDone = doneJobs.length > 0 ? doneJobs.slice().reverse() : [];
                    const activeProc = inProgressJobs.filter(j => j.status === 'processing');
                    const upcoming = inProgressJobs.filter(j => j.status === 'pending' || j.status === 'staging');

                    const combined = [...recentDone, ...activeProc, ...upcoming];
                    displayJobs = combined.slice(0, 250);

                    // How many completely pending items are hiding off-screen?
                    const visibleIds = new Set(displayJobs.map(j => j.id));
                    remainingCount = combined.filter(j => !visibleIds.has(j.id)).length;
                  }

                  return (
                    <>
                      {displayJobs.map(job => {
                        const isDone = job.status === 'done' || job.status === 'failed';
                        const isProc = job.status === 'processing';

                        const filePercent = (job.progressData && job.progressData.processedMB > 0) ? Math.round((job.progressData.savingsMB / job.progressData.processedMB) * 100) : 0;
                        const isNegative = filePercent < 0;

                        const savedText = job.progressData?.savingsMB ? `${filePercent < 0 ? 'Used' : 'Saved'} ${formatBytes(Math.abs(job.progressData.savingsMB))} ${filePercent !== 0 ? `(${Math.abs(filePercent)}%)` : ''}` : '';

                        return (
                          <div key={job.id} style={{
                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                            padding: '16px 24px', borderBottom: '1px solid var(--border)',
                            background: isProc ? 'rgba(245, 158, 11, 0.05)' : isDone ? (isNegative ? 'rgba(99, 102, 241, 0.05)' : 'rgba(16, 185, 129, 0.05)') : 'transparent'
                          }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                {isDone ? (
                                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: isNegative ? 'var(--accent-primary)' : 'var(--success)', color: 'white', letterSpacing: '0.05em' }}>
                                    {job.status === 'failed' ? 'FAILED' : 'DONE'}
                                  </span>
                                ) : isProc ? (
                                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: 'var(--warning)', color: 'white', letterSpacing: '0.05em' }}>
                                    {job.progressData?.percentage || 0}%
                                  </span>
                                ) : (
                                  <span style={{ fontSize: '11px', fontWeight: '700', padding: '2px 8px', borderRadius: '12px', background: 'var(--border)', color: 'var(--text-secondary)', letterSpacing: '0.05em' }}>
                                    PENDING
                                  </span>
                                )}

                                <span title={job.path} style={{ fontSize: '14px', color: isDone ? 'var(--text-secondary)' : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {formatPath(job.path)}
                                </span>
                              </div>

                              {(isProc || isDone) && job.progressData && (
                                <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '12px' }}>
                                  {savedText && <span style={{ color: isNegative ? 'var(--accent-primary)' : 'var(--success)', fontWeight: '500' }}>{savedText}</span>}
                                  {isProc && <span>Scanning: {formatBytes(job.progressData.processedMB)}</span>}
                                </div>
                              )}
                            </div>

                            {(!isProcessing && doneJobs.length === 0) && (
                              <button onClick={() => setActiveQueue(prev => prev.filter(j => j.id !== job.id))} style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '8px', marginLeft: '16px' }}>
                                <X size={18} />
                              </button>
                            )}
                          </div>
                        );
                      })}

                      {remainingCount > 0 && (
                        <div style={{ padding: '16px 24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic', background: 'var(--bg-root)' }}>
                          + {remainingCount} more pending items
                        </div>
                      )}
                      {activeQueue.length === 0 && (
                        <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px' }}>
                          Drag items here to begin
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>

              {/* Dynamic Bottom Action Keys */}
              <div style={{ padding: '20px 24px', display: 'flex', gap: '16px', background: 'var(--bg-root)', borderTop: '1px solid var(--border)', borderBottomLeftRadius: 'var(--radius-xl)', borderBottomRightRadius: 'var(--radius-xl)', flexShrink: 0 }}>
                {!isProcessing && (
                  <>
                    {activeQueue.some(j => j.status === 'pending') && (
                      <button
                        className="btn btn-primary"
                        style={{ flex: 1, padding: '14px', fontSize: '16px', fontWeight: '600' }}
                        onClick={startQueue}
                      >
                        {doneJobs.length > 0 ? "Start Additional Processing" : "Start Processing"}
                      </button>
                    )}

                    {doneJobs.length > 0 && (
                      <button
                        className="btn btn-outline"
                        style={{ flex: activeQueue.some(j => j.status === 'pending') ? 1 : '100%', padding: '14px', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}
                        onClick={() => setActiveQueue(prev => prev.filter(j => j.status !== 'done' && j.status !== 'failed'))}
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
                      style={{ flex: 1, padding: '14px', fontSize: '16px', fontWeight: '600', backgroundColor: 'var(--warning)', color: 'white', border: 'none' }}
                      onClick={async () => { setIsPaused(true); await window.electron.togglePause(true); }}
                    >
                      Pause Processing
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ flex: 1, padding: '14px', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}
                      onClick={() => {
                        isProcessingRef.current = false;
                        setIsProcessing(false);
                        setIsPaused(false);
                        window.electron.togglePause(false);
                        window.electron.abortProcess();
                        setActiveQueue(prev => prev.filter(j => j.status === 'done' || j.status === 'failed'));
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
                      style={{ flex: 1, padding: '14px', fontSize: '16px', fontWeight: '600' }}
                      onClick={async () => { setIsPaused(false); await window.electron.togglePause(false); }}
                    >
                      Resume Processing
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ flex: 1, padding: '14px', fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}
                      onClick={() => {
                        isProcessingRef.current = false;
                        setIsProcessing(false);
                        setIsPaused(false);
                        window.electron.togglePause(false);
                        window.electron.abortProcess();
                        setActiveQueue(prev => prev.filter(j => j.status === 'done' || j.status === 'failed'));
                      }}
                    >
                      Stop Processing
                    </button>
                  </>
                )}
              </div>
            </div>
          )}
        </div>

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
                style={{ maxWidth: '480px', borderLeft: '4px solid var(--warning)' }}
              >
                <h2 className="eula-title" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}><AlertTriangle className="text-warning" /> 5GB Limit Reached</h2>
                <div className="eula-content">
                  <p>
                    You have successfully saved over <strong>5GB</strong> of absolute disk space using Shrink Wizard!
                  </p>
                  <p>
                    As an independent developer, I offer this tool for free to help everyone reclaim their storage. To keep the project sustainable, compression speed is now dynamically throttled to <strong>1 background thread.</strong>
                  </p>
                  <p>
                    <em>Note: Decompressing/Restoring files is completely separate, always highly-concurrent, and effectively free forever.</em>
                  </p>
                  <p>
                    If you want to unthrottle and process large nested folders immediately at full native multi-core speed (as well as access our JXL transcoding features), please consider upgrading.
                  </p>
                </div>
                <div className="eula-footer" style={{ flexDirection: 'column', marginTop: '24px' }}>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      setShowLimitModal(false);
                      window.electron.openUrl('https://shrinkwizard.com/#pricing');
                    }}
                    style={{ width: '100%', padding: '12px' }}
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
                    style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid var(--border)' }}
                  >
                    Continue Slower
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function SettingsView({
  platform, compactOsEnabled, isCheckingOs, onToggleCompactOs,
  theme, setTheme,
  nativeAlgo, setNativeAlgo,
  imageCompressionEnabled, setImageCompressionEnabled,
  jpegMetadata, setJpegMetadata,
  outputFormat, setOutputFormat,
  jxlEffort, setJxlEffort,
  isPro
}: {
  platform: string, compactOsEnabled: boolean | null, isCheckingOs: boolean, onToggleCompactOs: () => void,
  theme: string, setTheme: (v: string) => void,
  nativeAlgo: string, setNativeAlgo: (v: string) => void,
  imageCompressionEnabled: boolean, setImageCompressionEnabled: (v: boolean) => void,
  jpegMetadata: boolean, setJpegMetadata: (v: boolean) => void,
  outputFormat: string, setOutputFormat: (v: string) => void,
  jxlEffort: number, setJxlEffort: (v: number) => void,
  isPro: boolean
}) {
  const getAlgoDescription = () => {
    switch (nativeAlgo) {
      case 'automatic': return 'We let your OS pick the optimal algorithm.';
      case 'LZX': return 'Highest compression, significantly reduced speed. Best for archival.';
      case 'XPRESS16K': return 'High compression, reduced speed.';
      case 'XPRESS8K': return 'Balanced compression and speed.';
      case 'XPRESS4K': return 'Light compression, maximum speed.';
      case 'LZFSE': return 'Balanced compression and speed (Apple default).';
      case 'ZLIB': return 'Highest compression, reduced speed. Used for maximum space savings.';
      case 'LZVN': return 'Light compression, maximum speed.';
      case 'off': return 'Disables transparent compression entirely.';
      default: return 'Higher compression saves more space but is slower to process.';
    }
  };

  return (
    <motion.div
      className="view-container"
      style={{ flex: 1, overflowY: 'auto', scrollbarGutter: 'stable', paddingBottom: '40px' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="view-header">
        <h1 className="view-title">App Settings</h1>
        <p className="view-subtitle">Configure advanced OS-level compression capabilities.</p>
      </div>

      <div className="settings-card">
        <div className="settings-card-header" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2 className="settings-card-title">Theme</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px', maxWidth: '80%' }}>
              Select the application appearance.
            </p>
          </div>
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '20px', padding: '4px', border: '1px solid var(--border)' }}>
            <button
              className={`toggle-btn ${theme === 'system' ? 'btn-on' : ''}`}
              onClick={() => setTheme('system')}
              style={{ color: theme === 'system' ? 'white' : 'var(--text-secondary)', background: theme === 'system' ? 'var(--accent-primary)' : 'transparent', border: 'none' }}
            >
              System
            </button>
            <button
              className={`toggle-btn ${theme === 'light' ? 'btn-on' : ''}`}
              onClick={() => setTheme('light')}
              style={{ color: theme === 'light' ? 'white' : 'var(--text-secondary)', background: theme === 'light' ? 'var(--accent-primary)' : 'transparent', border: 'none' }}
            >
              Light
            </button>
            <button
              className={`toggle-btn ${theme === 'dark' ? 'btn-on' : ''}`}
              onClick={() => setTheme('dark')}
              style={{ color: theme === 'dark' ? 'white' : 'var(--text-secondary)', background: theme === 'dark' ? 'var(--accent-primary)' : 'transparent', border: 'none' }}
            >
              Dark
            </button>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-header" style={{ alignItems: 'flex-start' }}>
          <div style={{ flex: 1 }}>
            <h2 className="settings-card-title">OS Transparent Compression</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px', maxWidth: '80%' }}>
              Select the algorithm used by the operating system for transparent file compression.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', flex: '0 0 240px' }}>
            <select
              value={nativeAlgo}
              onChange={(e) => setNativeAlgo(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', outline: 'none' }}
            >
              <option value="automatic">Automatic (OS Default)</option>
              {platform === 'win32' ? (
                <>
                  <option value="LZX">LZX (Strongest)</option>
                  <option value="XPRESS16K">XPRESS 16K (Stronger)</option>
                  <option value="XPRESS8K">XPRESS 8K (Balanced)</option>
                  <option value="XPRESS4K">XPRESS 4K (Fastest)</option>
                </>
              ) : null}
              <option value="off">Off</option>
            </select>
            <span style={{ color: 'var(--text-secondary)', fontSize: '11px', textAlign: 'left', lineHeight: '1.4' }}>{getAlgoDescription()}</span>
          </div>
        </div>
      </div>

      {platform === 'win32' && (
        <div className="settings-card">
          <div className="settings-card-header">
            <div>
              <h2 className="settings-card-title">CompactOS</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
                Compress your entire Windows operating system. Can save 1GB to 3GB of disk space.
              </p>
            </div>
            <button
              className={`toggle-btn ${compactOsEnabled ? 'btn-on' : 'btn-off'}`}
              onClick={onToggleCompactOs}
              disabled={isCheckingOs}
            >
              {isCheckingOs ? 'Checking...' : (compactOsEnabled ? 'Enabled' : 'Disabled')}
            </button>
          </div>
        </div>
      )}

      <div className="settings-card">
        <div className="settings-card-header" style={{ marginBottom: imageCompressionEnabled ? '24px' : '0' }}>
          <div>
            <h2 className="settings-card-title">Image Compression</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
              Advanced configurations for handling standalone image files (JPEG, PNG).
            </p>
          </div>
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '20px', padding: '4px', border: '1px solid var(--border)' }}>
            <button
              className={`toggle-btn ${imageCompressionEnabled ? 'btn-on' : ''}`}
              onClick={() => setImageCompressionEnabled(true)}
              style={{ background: imageCompressionEnabled ? 'var(--accent-primary)' : 'transparent', color: imageCompressionEnabled ? 'white' : 'var(--text-secondary)', border: 'none', boxShadow: imageCompressionEnabled ? '0 0 12px var(--accent-glow)' : 'none' }}
            >
              On
            </button>
            <button
              className={`toggle-btn ${!imageCompressionEnabled ? 'btn-off' : ''}`}
              onClick={() => setImageCompressionEnabled(false)}
              style={{ background: !imageCompressionEnabled ? 'var(--bg-tertiary)' : 'transparent', color: !imageCompressionEnabled ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none' }}
            >
              Off
            </button>
          </div>
        </div>

        <AnimatePresence initial={false}>
          {imageCompressionEnabled && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}
            >


              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Compression Format</span>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    style={{ padding: '8px 12px', background: 'var(--bg-root)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', outline: 'none', flexShrink: 0 }}
                  >
                    <option value="jpeg">Standard JPEG</option>
                    <option value="jxl" disabled={!isPro}>Archival JPEG XL {!isPro && '(Pro Only)'}</option>
                  </select>
                </div>
                <span style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.4' }}>
                  {outputFormat === 'jxl'
                    ? 'Archival JPEG XL is 25-30% smaller than regular JPEG and designed for long-term storage. '
                    : 'Standard JPEG optimizes file size while retaining maximum compatibility across all older browsers and devices.'}
                </span>

                {outputFormat === 'jxl' && (
                  <div style={{ marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>JXL Compression Effort</span>
                      <select
                        value={jxlEffort}
                        onChange={(e) => setJxlEffort(parseInt(e.target.value))}
                        style={{ padding: '8px 12px', background: 'var(--bg-root)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', outline: 'none', flexShrink: 0 }}
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
                    <span style={{ color: 'var(--text-secondary)', fontSize: '12px', lineHeight: '1.4' }}>
                      Higher effort values produce slightly better compression ratios but dramatically increase processing time.
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

function AboutView({ platform }: { platform: string }) {
  const [version, setVersion] = useState('');
  const [showLicenses, setShowLicenses] = useState(false);
  const [expandedLicenses, setExpandedLicenses] = useState<Record<string, boolean>>({});

  const toggleLicense = (name: string) => {
    setExpandedLicenses(prev => ({ ...prev, [name]: !prev[name] }));
  };

  const handleViewLicenses = async () => {
    if (window.electron) {
      await window.electron.openLicenses();
    }
  };

  useEffect(() => {
    if (window.electron && window.electron.getAppVersion) {
      window.electron.getAppVersion().then(setVersion).catch(() => setVersion('Unknown'));
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
        style={{ display: 'flex', flexDirection: 'column', flex: 1, overflowY: 'auto', scrollbarGutter: 'stable' }}
      >
        <div className="view-header" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '16px', flexShrink: 0 }}>
          <button
            onClick={() => setShowLicenses(false)}
            className="toggle-btn btn-off"
            style={{ padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%' }}
          >
            <ChevronRight size={20} style={{ transform: 'rotate(180deg)' }} />
          </button>
          <div>
            <h1 className="view-title" style={{ marginBottom: 0 }}>Open Source Licenses</h1>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', scrollbarGutter: 'stable', paddingRight: '12px', paddingBottom: '32px' }}>
          <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', marginBottom: '16px' }}>Bundled Binaries</h2>
          {bundledLicenses.map(license => (
            <div key={license.name} className="settings-card" style={{ padding: '16px', marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '15px' }}>{license.name}</h3>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '4px' }}>
                  {license.license}
                </span>
              </div>
              {license.url && <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '12px', wordBreak: 'break-all' }}>Source: <a href={license.url} style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>{license.url}</a></p>}

              <button
                onClick={() => toggleLicense(license.name)}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-primary)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', padding: 0, marginBottom: expandedLicenses[license.name] ? '12px' : 0 }}
              >
                {expandedLicenses[license.name] ? 'Hide License Text' : 'Show License Text'}
                <ChevronDown size={14} style={{ transform: expandedLicenses[license.name] ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
              </button>

              <AnimatePresence initial={false}>
                {expandedLicenses[license.name] && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    style={{ overflow: 'hidden' }}
                  >
                    <div style={{ background: 'var(--bg-root)', padding: '12px', borderRadius: 'var(--radius-md)', maxHeight: '200px', overflowY: 'auto', scrollbarGutter: 'stable', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                      {license.content}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}

          <h2 style={{ color: 'var(--text-primary)', fontSize: '16px', marginTop: '32px', marginBottom: '16px' }}>NPM Dependencies</h2>
          {Object.entries(npmLicenses).map(([pkgName, details]: [string, any]) => (
            <div key={pkgName} className="settings-card" style={{ padding: '16px', marginBottom: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <h3 style={{ color: 'var(--text-primary)', margin: 0, fontSize: '14px', wordBreak: 'break-all', paddingRight: '12px' }}>{pkgName}</h3>
                <span style={{ flexShrink: 0, fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '4px 8px', borderRadius: '4px' }}>
                  {typeof details.licenses === 'string' ? details.licenses : (Array.isArray(details.licenses) ? details.licenses.join(', ') : 'Unknown')}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {details.repository && (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0, wordBreak: 'break-all' }}>
                    Repository: <a href={typeof details.repository === 'string' ? details.repository : details.repository.url} style={{ color: 'var(--accent-primary)', textDecoration: 'none' }}>{typeof details.repository === 'string' ? details.repository : details.repository.url}</a>
                  </p>
                )}
                {details.publisher && (
                  <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                    Publisher: {details.publisher}
                  </p>
                )}
              </div>
            </div>
          ))}
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
        <p className="view-subtitle">System information and open source licenses.</p>
      </div>

      <div className="settings-card">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>App Version</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{version}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Operating System</span>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px', textTransform: 'capitalize' }}>
              {platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : platform}
            </span>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <div className="settings-card-header" style={{ marginBottom: 0 }}>
          <div>
            <h2 className="settings-card-title">Open Source Licenses</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '4px' }}>
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

      <div style={{ marginTop: '16px', display: 'flex', gap: '24px', justifyContent: 'center' }}>
        <a href="#" onClick={(e) => { e.preventDefault(); window.electron.openUrl('https://shrinkwizard.com/terms.html'); }} style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'underline' }}>Terms of Service</a>
        <a href="#" onClick={(e) => { e.preventDefault(); window.electron.openUrl('https://shrinkwizard.com/privacy.html'); }} style={{ fontSize: '13px', color: 'var(--text-secondary)', textDecoration: 'underline' }}>Privacy Policy</a>
      </div>
    </motion.div>
  );
}

function StoreView({ isPro, setIsPro }: { isPro: boolean, setIsPro: (val: boolean) => void }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [activating, setActivating] = useState(false);

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setActivating(true);
    try {
      let machineId = localStorage.getItem('sw_machine_id');
      if (!machineId) {
        machineId = Math.random().toString(36).substring(2) + Date.now().toString(36);
        localStorage.setItem('sw_machine_id', machineId);
      }

      const activateLicenseFn = httpsCallable(functions, 'activateLicense');
      const result = await activateLicenseFn({ licenseKey: licenseKey.trim(), machineId });
      const data = result.data as any;

      if (data.success) {
        const valid = await window.electron.verifyLicense("PRO_TEST");
        if (valid) setIsPro(true);
      } else {
        alert("Activation failed: " + (data.message || "Invalid Key"));
      }
    } catch (err: any) {
      alert("Verification Failed: " + (err.message || err));
    } finally {
      setActivating(false);
    }
  };

  return (
    <motion.div
      className="view-container"
      style={{ flex: 1, overflowY: 'auto', scrollbarGutter: 'stable', paddingBottom: '40px' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="view-header" style={{ marginBottom: '32px' }}>
        <h1 className="view-title">Shrink Wizard Pro</h1>
        <p className="view-subtitle">Unlock unlimited compression speeds and JPEG XL transcoding.</p>
      </div>

      {isPro ? (
        <div className="settings-card" style={{ borderLeft: '4px solid var(--success)', background: 'rgba(16, 185, 129, 0.05)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '16px' }}>
            <div style={{ background: 'var(--success)', borderRadius: '50%', padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'black' }}>
              <CheckCircle size={32} />
            </div>
            <div>
              <h2 style={{ color: 'var(--text-primary)', fontSize: '20px', margin: '0 0 8px 0' }}>Pro Actived</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0, lineHeight: '1.5' }}>
                Thank you for supporting the development of Shrink Wizard! You have unlimited access to all features, full CPU core utilization, and priority updates.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="settings-card" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div>
              <h2 className="settings-card-title">Upgrade to Pro - $10 One-Time</h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px', lineHeight: '1.6' }}>
                The Free tier gives you 5GB of space savings. After that, compression is locked to a single CPU thread. Upgrading to Pro unlocks:
              </p>
              <ul style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '16px', display: 'flex', flexDirection: 'column', gap: '12px', paddingLeft: '20px' }}>
                <li><strong>Full Speed Processing:</strong> Utilize 100% of your CPU cores for massive file batches.</li>
                <li><strong>Unlimited Savings:</strong> Compress hundreds of Gigabytes with absolutely no throttling.</li>
                <li><strong>Archival JPEG XL:</strong> Access the next-generation JXL format natively.</li>
              </ul>
            </div>

            <button
              className="btn btn-primary"
              style={{ padding: '16px', fontSize: '16px' }}
              onClick={() => window.electron.openUrl('https://buy.stripe.com/test_3cI6oG9b78D17wfeIj00000')}
            >
              Buy Pro License
            </button>
          </div>

          <div className="settings-card" style={{ marginTop: '24px' }}>
            <h2 className="settings-card-title">Already purchased?</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px', marginTop: '8px', marginBottom: '16px' }}>
              Enter the License Key you received via email to activate your copy.
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <input
                type="text"
                placeholder="e.g. SW-ABCD-1234-EFGH-5678"
                value={licenseKey}
                onChange={(e) => setLicenseKey(e.target.value)}
                style={{
                  flex: 1,
                  background: 'var(--bg-root)',
                  border: '1px solid var(--border)',
                  color: 'var(--text-primary)',
                  padding: '12px 16px',
                  borderRadius: 'var(--radius-md)',
                  outline: 'none',
                  fontFamily: 'monospace',
                  fontSize: '15px'
                }}
              />
              <button
                className="btn btn-primary"
                disabled={!licenseKey.trim() || activating}
                onClick={handleActivate}
              >
                {activating ? 'Validating...' : 'Activate'}
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

function ScannerView({ isAdminUser, isPro, onMigrate, onProcessingChange }: { isAdminUser: boolean, isPro: boolean, onMigrate: (paths: string[]) => void, onProcessingChange: (processing: boolean) => void }) {
  const [activeQueue, setActiveQueue] = useState<QueueJob[]>([]);
  const [selectedScanType, setSelectedScanType] = useState<'quick' | 'full'>('quick');
  const [isProcessing, setIsProcessing] = useState(false);
  const [hoveredScanBox, setHoveredScanBox] = useState<'quick' | 'full' | null>(null);

  useEffect(() => {
    onProcessingChange(isProcessing);
  }, [isProcessing, onProcessingChange]);

  const [doneQueueHeight, setDoneQueueHeight] = useState(30);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const [endedEarly, setEndedEarly] = useState(false);

  const isProcessingRef = useRef(false);
  const queueTokenRef = useRef(0);

  const [autoStart, setAutoStart] = useState(false);

  useEffect(() => {
    if (autoStart && activeQueue.length > 0 && !isProcessing) {
      setAutoStart(false);
      startQueue();
    }
  }, [autoStart, activeQueue, isProcessing]);

  const handleRunScan = (type: 'quick' | 'full') => {
    if (isProcessing) return;
    const paths = type === 'quick'
      ? ['/Applications', '~/Documents', '~/Downloads', '~/Pictures']
      : ['/'];

    const newJobs: QueueJob[] = paths.map(p => ({
      id: Math.random().toString(36).substring(7),
      path: p,
      mode: 'scan',
      status: 'pending',
      progressData: null
    }));

    setActiveQueue(newJobs);
    setAutoStart(true);
  };

  useEffect(() => {
    if (!isDraggingDivider) return;
    const handleMouseMove = (e: MouseEvent) => {
      const windowHeight = window.innerHeight;
      const mouseVertical = e.clientY;
      const heightPercent = ((windowHeight - mouseVertical) / windowHeight) * 100;
      if (heightPercent >= 5 && heightPercent <= 90) setDoneQueueHeight(heightPercent);
    };
    const handleMouseUp = () => setIsDraggingDivider(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingDivider]);

  const doneJobsTotalsRef = useRef({ savingsMB: 0, originalMB: 0, fileCount: 0 });

  useEffect(() => {
    const doneJobs = activeQueue.filter(j => j.status === 'done');
    doneJobsTotalsRef.current = {
      savingsMB: doneJobs.reduce((acc, job) => acc + (job.progressData?.savingsMB || (job.progressData as any)?.currentSettingsSavingsMB || 0), 0),
      originalMB: doneJobs.reduce((acc, job) => acc + (job.progressData?.processedMB || (job.progressData as any)?.originalMB || 0), 0),
      fileCount: doneJobs.reduce((acc, job) => acc + ((job.progressData as any)?.fileCount || 0), 0)
    };
  }, [activeQueue]);

  useEffect(() => {
    if (window.electron) {
      window.electron.onScanProgress((data: any) => {
        // Mute React! Directly bind into pure DOM components to render at 60 FPS without V8 Garbage Collection drops
        const totals = doneJobsTotalsRef.current;
        const liveSavings = totals.savingsMB + data.currentSettingsSavingsMB;
        const liveScanned = totals.originalMB + data.originalMB;
        const liveFiles = totals.fileCount + data.fileCount;

        const savingsEl = document.getElementById('live-savings-val');
        if (savingsEl) savingsEl.textContent = formatBytes(liveSavings, true);

        const scannedEl = document.getElementById('live-scanned-val');
        if (scannedEl) scannedEl.textContent = formatBytes(liveScanned, true);

        const filesEl = document.getElementById('live-files-val');
        if (filesEl) filesEl.textContent = formatCompactNumber(liveFiles);
        
        const pathEl = document.getElementById('live-path-val');
        if (pathEl) pathEl.textContent = formatPath(data.path);
      });
      return () => {
        window.electron.removeScanProgressListeners();
      };
    }
  }, []);

  const startQueue = async () => {
    if (isProcessing) return;
    
    queueTokenRef.current++;
    const myToken = queueTokenRef.current;

    setIsProcessing(true);
    isProcessingRef.current = true;
    setEndedEarly(false);

    try {
      await window.electron.scanSystem([], { clearCache: true }); // Reset backend dedup state

      for (let i = 0; i < activeQueue.length; i++) {
        if (!isProcessingRef.current || myToken !== queueTokenRef.current) break;

        let currentState = activeQueue[i]; // Fetch newest state to check pause
        if (currentState.status !== 'pending' && currentState.status !== 'staging') continue;

        setActiveQueue(prev => prev.map(j => j.id === currentState.id ? { ...j, status: 'processing', progressData: { processedMB: 0, savingsMB: 0, percentage: 0 } as any } : j));

        while (true) {
          if (!isProcessingRef.current) break;
          const freshQueue = activeQueue; // It's a stale closure, wait! We can just use an IPC signal.
          // Wait, `isPaused` state is handled via `window.electron.togglePause()`. Backend halts natively.
          break;
        }

        if (!isProcessingRef.current) break;

        try {
          const res = await window.electron.scanSystem([currentState.path], { outputFormat: 'jxl', nativeAlgo: 'lzvn', imageCompressionEnabled: true });

          setActiveQueue(prev => prev.map(j => {
            if (j.id === currentState.id) {
              const finalData = res && res.results && res.results.length > 0 ? res.results[0] : { currentSettingsSavingsMB: 0, maxSettingsSavingsMB: 0, originalMB: 0, fileCount: 0 };
              return {
                ...j,
                status: 'done',
                progressData: {
                  processedMB: finalData.originalMB,
                  savingsMB: finalData.currentSettingsSavingsMB,
                  percentage: 100, // done
                  maxSavings: finalData.maxSettingsSavingsMB,
                  fileCount: finalData.fileCount
                } as any
              };
            }
            return j;
          }));
        } catch (err: any) {
          console.error("Scan aborted or failed for", currentState.path, err);
          setActiveQueue(prev => prev.map(j => j.id === currentState.id ? { ...j, status: 'failed' } : j));
        }
      }
    } finally {
      if (myToken === queueTokenRef.current) {
        setIsProcessing(false);
        isProcessingRef.current = false;
      }
    }
  };

  const inProgressJobs = activeQueue.filter(j => j.status !== 'done' && j.status !== 'failed');
  const doneJobs = activeQueue.filter(j => j.status === 'done' || j.status === 'failed');
  const totalSavingsMB = activeQueue.reduce((acc, job) => acc + (job.progressData?.savingsMB || (job.progressData as any)?.currentSettingsSavingsMB || 0), 0);
  const totalScannedMB = activeQueue.reduce((acc, job) => acc + (job.progressData?.processedMB || (job.progressData as any)?.originalMB || 0), 0);
  const totalFilesScanned = activeQueue.reduce((acc, job) => acc + ((job.progressData as any)?.fileCount || 0), 0);
  const totalMaxSavingsMB = activeQueue.reduce((acc, job) => acc + ((job.progressData as any)?.maxSettingsSavingsMB || (job.progressData as any)?.maxSavings || 0), 0);
  const potentialProSavingsMB = Math.max(0, totalMaxSavingsMB - totalSavingsMB);

  const selectedDonePaths = doneJobs.map(j => j.path);

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
      <motion.div
        className="view-container"
        style={{ flex: 1, overflowY: 'auto', scrollbarGutter: 'stable' }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        <div className="view-header">
          <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '28px', margin: 0 }}>
            <Search className="text-primary" /> Smart Scanner
          </h1>
          <p className="view-subtitle" style={{ maxWidth: '600px', marginTop: '8px' }}>
            Find historically compressible files and folders on your system to reclaim space.
          </p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '24px' }}>

          {(isProcessing || doneJobs.length > 0) && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                padding: '40px',
                background: !isProcessing ? (endedEarly ? 'rgba(245, 158, 11, 0.05)' : 'rgba(16, 185, 129, 0.05)') : 'var(--bg-secondary)',
                border: `2px solid ${!isProcessing ? (endedEarly ? 'var(--warning)' : 'var(--success)') : 'var(--accent-primary)'}`,
                borderRadius: 'var(--radius-xl)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                boxShadow: !isProcessing ? (endedEarly ? '0 8px 32px rgba(245, 158, 11, 0.1)' : '0 8px 32px rgba(16, 185, 129, 0.1)') : '0 8px 32px rgba(99, 102, 241, 0.1)'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px' }}>
                {!isProcessing ? (
                  <div style={{ background: endedEarly ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)', padding: '12px', borderRadius: '50%', display: 'flex' }}>
                    <Zap size={32} color={endedEarly ? "var(--warning)" : "var(--success)"} />
                  </div>
                ) : (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 2, ease: "linear" }} style={{ display: 'flex' }}>
                    <Search size={32} color="var(--accent-primary)" />
                  </motion.div>
                )}

                <h2 style={{ fontSize: '28px', fontWeight: '600', color: 'var(--text-primary)', margin: 0 }}>
                  {!isProcessing
                    ? (endedEarly ? 'Scan Ended Early' : 'Scan Complete!')
                    : (activeQueue.length > 2 ? 'Quick Scan in Progress...' : 'Full Scan in Progress...')
                  }
                </h2>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '20px', width: '100%', maxWidth: '800px', marginBottom: '40px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center', padding: '16px', background: 'var(--bg-root)', borderRadius: 'var(--radius-lg)', border: `1px solid ${!isProcessing ? (endedEarly ? 'var(--warning)' : 'var(--success)') : 'var(--border)'}`, boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px' }}>Estimated Savings</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div id="live-savings-val" style={{ fontSize: '36px', fontWeight: '700', color: !isProcessing ? (endedEarly ? 'var(--warning)' : 'var(--success)') : 'var(--success)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{formatBytes(totalSavingsMB, true)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center', padding: '16px', background: 'var(--bg-root)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px' }}>Data Scanned</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div id="live-scanned-val" style={{ fontSize: '36px', fontWeight: '700', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{formatBytes(totalScannedMB, true)}</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', textAlign: 'center', padding: '16px', background: 'var(--bg-root)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-sm)' }}>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '8px' }}>Files Analyzed</div>
                  <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div id="live-files-val" style={{ fontSize: '36px', fontWeight: '700', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums', lineHeight: 1.1 }}>{formatCompactNumber(totalFilesScanned)}</div>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', alignItems: 'center' }}>
                {!isProcessing ? (
                  <>
                    <button
                      className="btn btn-primary"
                      style={{ fontSize: '18px', padding: '16px 48px', borderRadius: '30px', boxShadow: '0 4px 20px var(--accent-glow)' }}
                      onClick={() => onMigrate(selectedDonePaths)}
                    >
                      Reclaim Space Now
                    </button>
                    <button
                      className="btn btn-outline"
                      style={{ fontSize: '16px', padding: '14px 28px', borderRadius: '30px', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                      onClick={() => {
                        window.electron.abortScan();
                        setActiveQueue([]);
                        setEndedEarly(false);
                      }}
                    >
                      Start New Scan
                    </button>
                  </>
                ) : (
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: '16px', padding: '14px 32px', borderRadius: '30px', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                    onClick={() => {
                      setEndedEarly(true);
                      isProcessingRef.current = false;
                      setIsProcessing(false); // Instantly free the UI
                      window.electron.abortScan();
                    }}
                  >
                    End Scan Early
                  </button>
                )}
              </div>
            </motion.div>
          )}

          {(!doneJobs.length && !isProcessing) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '24px' }}>
                <div
                  className="drop-zone"
                  onClick={() => handleRunScan('quick')}
                  onMouseEnter={() => setHoveredScanBox('quick')}
                  onMouseLeave={() => setHoveredScanBox(null)}
                  style={{ position: 'relative', padding: '32px 24px', minHeight: '240px', cursor: 'pointer', textAlign: 'center', border: hoveredScanBox === 'quick' ? '2px solid var(--accent-primary)' : '2px solid rgba(99, 102, 241, 0.3)', backgroundColor: hoveredScanBox === 'quick' ? 'rgba(99, 102, 241, 0.05)' : 'rgba(99, 102, 241, 0.01)', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <div style={{ position: 'absolute', top: '-10px', right: '20px', background: 'var(--accent-primary)', color: 'white', padding: '4px 12px', borderRadius: '12px', fontSize: '11px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.05em', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.3)' }}>
                    ★ Recommended
                  </div>
                  <div style={{ background: 'var(--bg-root)', padding: '16px', borderRadius: '50%', marginBottom: '20px', boxShadow: hoveredScanBox === 'quick' ? '0 0 15px rgba(99, 102, 241, 0.2)' : 'var(--shadow-sm)' }}>
                    <Zap size={36} color={hoveredScanBox === 'quick' ? "var(--accent-primary)" : "rgba(99, 102, 241, 0.7)"} style={{ transition: 'all 0.2s' }} />
                  </div>
                  <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Quick Scan
                  </h2>
                  <div style={{ display: 'inline-block', background: hoveredScanBox === 'quick' ? 'var(--accent-primary)' : 'rgba(99, 102, 241, 0.15)', color: hoveredScanBox === 'quick' ? 'white' : 'var(--accent-primary)', fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '12px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.2s' }}>Fastest</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
                    Scans your Applications, Documents, Downloads, and Photos. Fastest way to find massive savings.
                  </p>
                </div>

                <div
                  className="drop-zone"
                  onClick={() => handleRunScan('full')}
                  onMouseEnter={() => setHoveredScanBox('full')}
                  onMouseLeave={() => setHoveredScanBox(null)}
                  style={{ position: 'relative', padding: '32px 24px', minHeight: '240px', cursor: 'pointer', textAlign: 'center', border: hoveredScanBox === 'full' ? '2px solid var(--accent-primary)' : '2px solid var(--border-light)', backgroundColor: hoveredScanBox === 'full' ? 'rgba(99, 102, 241, 0.05)' : 'transparent', transition: 'all 0.2s', display: 'flex', flexDirection: 'column', alignItems: 'center' }}
                >
                  <div style={{ background: 'var(--bg-root)', padding: '16px', borderRadius: '50%', marginBottom: '20px', boxShadow: hoveredScanBox === 'full' ? '0 0 15px rgba(99, 102, 241, 0.2)' : 'var(--shadow-sm)' }}>
                    <HardDrive size={36} color={hoveredScanBox === 'full' ? "var(--accent-primary)" : "var(--text-secondary)"} style={{ transition: 'all 0.2s' }} />
                  </div>
                  <h2 style={{ fontSize: '20px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                    Full Scan
                  </h2>
                  <div style={{ display: 'inline-block', background: hoveredScanBox === 'full' ? 'var(--accent-primary)' : 'var(--bg-tertiary)', color: hoveredScanBox === 'full' ? 'white' : 'var(--text-secondary)', fontSize: '11px', fontWeight: '600', padding: '4px 10px', borderRadius: '12px', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', transition: 'all 0.2s' }}>Biggest Savings</div>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '14px', lineHeight: '1.5' }}>
                    Analyzes your entire disk to find all possible savings. May take several minutes.
                  </p>
                </div>
              </div>

              <div style={{ padding: '16px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '14px', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                <Info size={18} color="var(--accent-primary)" />
                <span>Click on a scan type to start scanning.</span>
              </div>
            </div>
          )}
        </div>
      </motion.div>


    </div>
  );
}
