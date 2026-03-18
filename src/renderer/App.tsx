import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { HardDrive, Settings, Search, CheckCircle, AlertTriangle, ChevronRight, X, File, Zap, Info, ArrowUpDown, ChevronDown } from 'lucide-react';
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

const formatBytes = (mb: number | undefined) => {
  if (!mb) return '0 MB';
  const isNegative = mb < 0;
  const absMb = Math.abs(mb);
  
  const formatted = (() => {
    if (absMb >= 1024) return `${(absMb / 1024).toFixed(2)} GB`;
    if (absMb < 1) return `${(absMb * 1024).toFixed(0)} KB`;
    return `${absMb.toFixed(1)} MB`;
  })();
  
  return isNegative ? `-${formatted}` : formatted;
};

export interface QueueJob {
  id: string;
  path: string;
  mode: 'compress' | 'restore';
  status: 'staging' | 'pending' | 'processing' | 'done' | 'failed';
  progressData: ProgressData | null;
}

declare global {
  interface Window {
    electron: any;
  }
}

type TTab = 'compress' | 'decompress' | 'settings' | 'about';

export default function App() {
  const [activeTab, setActiveTab] = useState<TTab>('compress');
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
            className={`nav-btn ${activeTab === 'compress' ? 'active' : ''}`}
            onClick={() => setActiveTab('compress')}
          >
            <HardDrive size={20} />
            <span>Compress</span>
          </button>

          <button
            className={`nav-btn ${activeTab === 'decompress' ? 'active' : ''}`}
            onClick={() => setActiveTab('decompress')}
          >
            <Zap size={20} />
            <span>Decompress</span>
          </button>

          <button
            className={`nav-btn ${activeTab === 'settings' ? 'active' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <Settings size={20} />
            <span>Settings</span>
          </button>

          <button
            className={`nav-btn ${activeTab === 'about' ? 'active' : ''}`}
            onClick={() => setActiveTab('about')}
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
                
                <p><strong>Backups are your responsibility.</strong> By using this software, you agree that you are solely responsible for maintaining independent backups of any critical data processed by Shrink Wizard. We are not liable for any data loss, corruption, or damages that may occur.</p>
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
            <CompressionView 
              key={activeTab} 
              activeTab={activeTab}
              outputFormat={outputFormat}
              nativeAlgo={nativeAlgo}
              imageCompressionEnabled={imageCompressionEnabled}
              jpegMetadata={jpegMetadata}
              jxlEffort={jxlEffort}
            />
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
          padding: 24px 16px;
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
          padding: 40px;
          height: 100%;
          display: flex;
          flex-direction: column;
        }

        .view-header {
          margin-bottom: 32px;
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
  jxlEffort
}: {
  activeTab: 'compress' | 'decompress',
  outputFormat: string, 
  nativeAlgo: string, 
  imageCompressionEnabled: boolean,
  jpegMetadata: boolean,
  jxlEffort: number
}) {
  const [activeQueue, setActiveQueue] = useState<QueueJob[]>([]);
  const [isPaused, setIsPaused] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [doneQueueHeight, setDoneQueueHeight] = useState(30);
  const [isDraggingDivider, setIsDraggingDivider] = useState(false);
  const isProcessingRef = useRef(false);
  const isCompress = activeTab === 'compress';

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

  const totalProcessedMB = activeQueue.reduce((acc, job) => acc + (job.progressData?.processedMB || 0), 0);
  const totalSavingsMB = activeQueue.reduce((acc, job) => acc + (job.progressData?.savingsMB || 0), 0);
  const totalCompressed = activeQueue.reduce((acc, job) => acc + (job.progressData?.compressedCount || 0), 0);
  const totalSkipped = activeQueue.reduce((acc, job) => acc + (job.progressData?.skippedCount || 0), 0);
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

  const startQueue = async () => {
    if (isProcessingRef.current) return;
    if (!window.electron) return;
    
    isProcessingRef.current = true;
    setIsProcessing(true);
    
    const getNextJob = () => new Promise<QueueJob | undefined>(resolve => {
      setActiveQueue(prev => {
        const nextJob = prev.find(j => j.status === 'pending');
        resolve(nextJob);
        if (nextJob) {
          return prev.map(j => j.id === nextJob.id ? { ...j, status: 'processing', progressData: { phase: 'scanning', totalMB: 0, processedMB: 0, savingsMB: 0, percentage: 0, compressedCount: 0, skippedCount: 0, failedCount: 0, alreadyCompressedCount: 0, totalFiles: 0 } } : j);
        }
        return prev;
      });
    });

    while(isProcessingRef.current) {
      let nextJob = await getNextJob();

      if (!nextJob) {
         isProcessingRef.current = false;
         setIsProcessing(false);
         break;
      }

      window.electron.onProgress((data: ProgressData) => {
        setActiveQueue(prev => prev.map(j => j.id === nextJob!.id ? { ...j, progressData: data } : j));
      });

      try {
        await window.electron.processPaths([nextJob.path], nextJob.mode, {
          outputFormat, nativeAlgo, imageCompressionEnabled, jpegMetadata, effort: jxlEffort
        });
        
        setActiveQueue(prev => prev.map(j => j.id === nextJob!.id ? { ...j, status: 'done', progressData: j.progressData ? { ...j.progressData, phase: 'done', percentage: 100 } : null } : j));
      } catch (err) {
        console.error('Process error:', err);
        setActiveQueue(prev => prev.map(j => j.id === nextJob!.id ? { ...j, status: 'failed' } : j));
      } finally {
        window.electron.removeProgressListeners();
      }
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', overflow: 'hidden' }}>
    <motion.div
      className="view-container"
      style={{ flex: 1, overflowY: 'auto' }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2 }}
    >
      <div className="view-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '24px' }}>
        <div>
          <h1 className="view-title">{isCompress ? "Compress Files" : "Decompress Files"}</h1>
          <p className="view-subtitle" style={{ maxWidth: '600px' }}>
            {isCompress 
              ? "Drag and drop folders, documents, or entire game directories to magically compress them."
              : "Drop previously compressed items here (including .jxl files) to return them to their original state and format."}
          </p>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', flex: 1, gap: '24px' }}>
            <div
              className="drop-zone"
              onClick={() => handleSelectFiles(false)}
            >
              <div style={{ background: 'var(--bg-secondary)', padding: '32px', borderRadius: '50%', marginBottom: '24px' }}>
                <HardDrive size={64} color={isCompress ? "var(--accent-primary)" : "var(--text-secondary)"} />
              </div>
              <h2 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-primary)', marginBottom: '8px' }}>
                {isCompress ? "Select Items to Compress" : "Select Items to Decompress"}
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: '16px' }}>or drop them anywhere in this window</p>
              {window.electron?.platform === 'win32' && (
                <button 
                  className="toggle-btn btn-off" 
                  style={{ marginTop: '24px', fontSize: '15px' }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectFiles(true);
                  }}
                >
                  Select Files Only
                </button>
              )}
            </div>
      </div>
    </motion.div>

    <aside className="queue-siderail" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="queue-section active-queue" style={{ flex: doneJobs.length > 0 ? `1 1 ${100 - doneQueueHeight}%` : '1 1 100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0 }}>
          <h3 style={{ margin: 0 }}>Processing Queue ({inProgressJobs.length})</h3>
          {inProgressJobs.length > 0 && (
            <button
              className="toggle-btn btn-off"
              style={{ 
                fontSize: '12px', 
                padding: '4px 8px',
                opacity: (isProcessing && !isPaused) ? 0.6 : 1,
                cursor: (isProcessing && !isPaused) ? 'not-allowed' : 'pointer'
              }}
              onClick={() => {
                if (isProcessing && !isPaused) {
                  alert("Please pause compression first before clearing the queue.");
                } else {
                  setActiveQueue(prev => prev.filter(j => j.status === 'done'));
                  if (isPaused) {
                    setIsPaused(false);
                    setIsProcessing(false);
                    isProcessingRef.current = false;
                    window.electron.togglePause(false);
                  }
                }
              }}
              title={isProcessing && !isPaused ? "Please pause compression first" : "Clear pending items"}
            >
              Clear Pending
            </button>
          )}
        </div>
        
        {inProgressJobs.length > 0 && (
          <div style={{ flexShrink: 0 }}>
            <button 
              className={`toggle-btn ${!isProcessing ? 'btn-on' : isPaused ? 'btn-on' : 'btn-off'}`} 
              style={{ width: '100%', marginBottom: '12px', padding: '12px', fontSize: '15px', fontWeight: '600', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', ...(isPaused ? { backgroundColor: 'var(--warning)', color: 'white' } : {}) }} 
              onClick={async () => {
                if (!isProcessing) {
                  startQueue();
                } else {
                  const newState = !isPaused;
                  setIsPaused(newState);
                  await window.electron.togglePause(newState);
                }
              }}
            >
              {!isProcessing ? 'Start Processing' : isPaused ? 'Resume Processing' : 'Pause Processing'}
            </button>
          </div>
        )}
        
        {activeQueue.length > 0 && (
          <div style={{ flexShrink: 0, padding: '12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '12px', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
              <span>Saved: <strong style={{color: percentSaved < 0 ? 'var(--accent-primary)' : 'var(--success)', fontSize: '13px'}}>{formatBytes(totalSavingsMB)}{displayPercent ? ` ${displayPercent}` : ''}</strong></span>
              <span>Processed: <strong>{formatBytes(totalProcessedMB)}</strong></span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px' }}>
              <span>{isCompress ? 'Compressed' : 'Decompressed'}: <strong>{totalCompressed}</strong></span>
              <span style={{ margin: '0 8px' }}>Skipped: <strong>{totalSkipped}</strong></span>
              <span>Incompressible: <strong>{totalIncompressible}</strong></span>
            </div>
          </div>
        )}

        <div className="queue-list" style={{ flex: 1 }}>
          {inProgressJobs.slice(0, 100).map(job => (
            <div key={job.id} style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${job.status === 'processing' ? 'var(--warning)' : job.status === 'failed' ? 'var(--error)' : 'var(--text-secondary)'}` }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', flex: 1 }}>
                  <span title={job.path} style={{ fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                    {formatPath(job.path)}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '600', color: 'var(--text-secondary)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                    {job.status.toUpperCase()}
                    {job.status === 'processing' && job.progressData && (() => {
                      const pct = job.progressData.processedMB > 0 ? Math.round((job.progressData.savingsMB / job.progressData.processedMB) * 100) : 0;
                      const pctStr = pct > 0 ? `(${pct}%)` : (pct < 0 ? `(${pct}%)` : '');
                      const savedAmt = job.progressData.savingsMB ? `${formatBytes(job.progressData.savingsMB)}${pctStr ? ` ${pctStr}` : ''}` : '';
                      return (
                        <span style={{ marginLeft: '4px', color: 'var(--warning)' }}>
                          {job.progressData.percentage}% {savedAmt ? `(${savedAmt} ${pct < 0 ? 'used' : 'saved'})` : ''}
                        </span>
                      );
                    })()}
                  </span>
                </div>
                <button 
                  onClick={() => setActiveQueue(prev => prev.filter(j => j.id !== job.id))}
                  style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex' }}
                  title="Remove from Queue"
                >
                  <X size={14} />
                </button>
              </div>
              
              {job.progressData && job.status === 'processing' && (
                <div style={{ width: '100%', height: '4px', background: 'var(--bg-tertiary)', borderRadius: '2px', overflow: 'hidden' }}>
                  <motion.div initial={{ width: 0 }} animate={{ width: `${job.progressData.percentage}%` }} style={{ height: '100%', background: 'var(--warning)' }} />
                </div>
              )}
            </div>
          ))}
          {inProgressJobs.length > 100 && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', padding: '8px' }}>
              ... and {inProgressJobs.length - 100} more items
            </div>
          )}
          {inProgressJobs.length === 0 && (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px', marginTop: '20px' }}>
              Queue is empty
            </div>
          )}
        </div>
      </div>

      {doneJobs.length > 0 && (
        <>
          <div 
            style={{
              height: '8px',
              cursor: 'row-resize',
              backgroundColor: isDraggingDivider ? 'var(--accent-glow)' : 'transparent',
              borderTop: '1px solid var(--border)',
              borderBottom: '1px solid transparent',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.1s'
            }}
            onMouseDown={(e) => { e.preventDefault(); setIsDraggingDivider(true); }}
          >
            <div style={{ width: '40px', height: '4px', borderRadius: '2px', backgroundColor: 'var(--border)' }} />
          </div>
          
          <div className="queue-section done-queue" style={{ flex: `0 0 ${doneQueueHeight}%`, overflowY: 'auto', background: 'var(--bg-root)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexShrink: 0, padding: '16px 16px 0 16px' }}>
              <h3 style={{ margin: 0, color: 'var(--success)' }}>Completed ({doneJobs.length})</h3>
              <button
                className="toggle-btn btn-off"
                style={{ fontSize: '12px', padding: '4px 8px' }}
                onClick={() => setActiveQueue(prev => prev.filter(j => j.status !== 'done'))}
              >
                Clear Done
              </button>
            </div>
            <div className="queue-list" style={{ flex: 1, padding: '0 16px 16px 16px' }}>
              {doneJobs.slice(0, 100).map(job => {
                const filePercent = (job.progressData && job.progressData.processedMB > 0) 
                  ? Math.round((job.progressData.savingsMB / job.progressData.processedMB) * 100) 
                  : 0;
                const filePercentDisplay = filePercent !== 0 ? `(${filePercent}%)` : '';
                const isNegative = filePercent < 0;
                const savedText = job.progressData?.savingsMB 
                  ? `- Saved ${formatBytes(job.progressData.savingsMB)}${filePercentDisplay ? ` ${filePercentDisplay}` : ''}` 
                  : '';
  
                return (
                <div key={job.id} style={{ padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '6px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', borderLeft: `3px solid ${isNegative ? 'var(--accent-primary)' : 'var(--success)'}`, marginBottom: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '4px', flex: 1 }}>
                      <span title={job.path} style={{ fontSize: '13px', color: 'var(--text-primary)', wordBreak: 'break-all' }}>
                        {formatPath(job.path)}
                      </span>
                      <span style={{ fontSize: '10px', fontWeight: '600', color: isNegative ? 'var(--accent-primary)' : 'var(--success)', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
                        DONE {savedText}
                      </span>
                    </div>
                    <button 
                      onClick={() => setActiveQueue(prev => prev.filter(j => j.id !== job.id))}
                      style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: 0, flexShrink: 0, display: 'flex' }}
                      title="Remove from Queue"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              )})}
              {doneJobs.length > 100 && (
                <div style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '12px', padding: '8px' }}>
                  ... and {doneJobs.length - 100} more items
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </aside>
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
  jxlEffort, setJxlEffort
}: { 
  platform: string, compactOsEnabled: boolean | null, isCheckingOs: boolean, onToggleCompactOs: () => void,
  theme: string, setTheme: (v: string) => void,
  nativeAlgo: string, setNativeAlgo: (v: string) => void,
  imageCompressionEnabled: boolean, setImageCompressionEnabled: (v: boolean) => void,
  jpegMetadata: boolean, setJpegMetadata: (v: boolean) => void,
  outputFormat: string, setOutputFormat: (v: string) => void,
  jxlEffort: number, setJxlEffort: (v: number) => void
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
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px', flex: '0 0 240px' }}>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value)}
              style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', outline: 'none' }}
            >
              <option value="system">System Default</option>
              <option value="dark">Dark</option>
              <option value="light">Light</option>
            </select>
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
              ) : (
                <>
                  <option value="ZLIB">ZLIB (Strongest)</option>
                  <option value="LZFSE">LZFSE (Balanced)</option>
                  <option value="LZVN">LZVN (Fastest)</option>
                </>
              )}
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Compression Quality</span>
                <div
                  style={{ padding: '8px 12px', background: 'var(--bg-root)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', fontSize: '13px' }}
                >
                  Pixel Perfect (Lossless)
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Compression Format</span>
                  <select
                    value={outputFormat}
                    onChange={(e) => setOutputFormat(e.target.value)}
                    style={{ padding: '8px 12px', background: 'var(--bg-root)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', outline: 'none', flexShrink: 0 }}
                  >
                    <option value="jpeg">Standard JPEG</option>
                    <option value="jxl">Archival JPEG XL</option>
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: 'var(--text-primary)', fontSize: '14px' }}>Preserve Metadata (EXIF/ICC)</span>

                <div style={{ display: 'flex', background: 'var(--bg-secondary)', borderRadius: '20px', padding: '4px', border: '1px solid var(--border)' }}>
                  <button
                    className={`toggle-btn ${jpegMetadata ? 'btn-on' : ''}`}
                    onClick={() => setJpegMetadata(true)}
                    style={{ background: jpegMetadata ? 'var(--accent-primary)' : 'transparent', color: jpegMetadata ? 'white' : 'var(--text-secondary)', border: 'none', boxShadow: jpegMetadata ? '0 0 12px var(--accent-glow)' : 'none' }}
                  >
                    Yes
                  </button>
                  <button
                    className={`toggle-btn ${!jpegMetadata ? 'btn-off' : ''}`}
                    onClick={() => setJpegMetadata(false)}
                    style={{ background: !jpegMetadata ? 'var(--bg-tertiary)' : 'transparent', color: !jpegMetadata ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none' }}
                  >
                    No
                  </button>
                </div>
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
        style={{ display: 'flex', flexDirection: 'column' }}
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

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '12px', paddingBottom: '32px' }}>
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
                    <div style={{ background: 'var(--bg-root)', padding: '12px', borderRadius: 'var(--radius-md)', maxHeight: '200px', overflowY: 'auto', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
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
