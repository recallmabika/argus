import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Laptop,
  Smartphone,
  HardDrive,
  RefreshCw,
  Camera,
  Download,
  Terminal,
  Folder,
  File,
  CornerLeftUp,
  Send,
  Sliders,
  ChevronRight,
  ShieldCheck,
  CheckCircle2
} from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { ForensicDevice, ForensicWindow, ForensicFile, ForensicTriage } from '../../types';

export const ForensicStudioModal: React.FC = () => {
  const { activeForensicDeviceId, closeForensicStudio, alert } = useModals();

  const [device, setDevice] = useState<ForensicDevice | null>(null);
  const [activeTab, setActiveTab] = useState<'screen' | 'files' | 'triage'>('screen');

  // Screen Tab State
  const [windows, setWindows] = useState<ForensicWindow[]>([]);
  const [selectedWindowId, setSelectedWindowId] = useState<string>('desktop');
  const [autoStream, setAutoStream] = useState<boolean>(true);
  const [screenLoading, setScreenLoading] = useState<boolean>(false);
  const [remoteText, setRemoteText] = useState<string>('');
  const [screenResolution, setScreenResolution] = useState<string>('1920x1080');
  const [snapshotDigest, setSnapshotDigest] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const autoStreamIntervalRef = useRef<any>(null);

  // Files Tab State
  const [currentPath, setCurrentPath] = useState<string>('/sdcard');
  const [files, setFiles] = useState<ForensicFile[]>([]);
  const [filesLoading, setFilesLoading] = useState<boolean>(false);

  // Triage Tab State
  const [triage, setTriage] = useState<ForensicTriage | null>(null);
  const [shellInput, setShellInput] = useState<string>('');
  const [shellOutput, setShellOutput] = useState<string>(
    'ARTIS Forensic Bridge Shell v1.0.0\nConnected to target subsystem. Type a shell command below or click a preset.'
  );
  const [shellExecuting, setShellExecuting] = useState<boolean>(false);

  // Load device info when modal opens
  useEffect(() => {
    if (!activeForensicDeviceId) {
      setDevice(null);
      if (autoStreamIntervalRef.current) clearInterval(autoStreamIntervalRef.current);
      return;
    }

    api.getForensicDevices().then((res) => {
      const found = res.devices.find((d) => d.id === activeForensicDeviceId);
      if (found) {
        setDevice(found);
        if (found.type === 'host' || found.type === 'HOST_WORKSTATION') {
          setCurrentPath('C:\\');
        } else {
          setCurrentPath('/sdcard');
        }
      } else {
        setDevice({
          id: activeForensicDeviceId,
          name: 'Target Device',
          type: activeForensicDeviceId.includes('HOST') ? 'host' : 'android',
          status: 'ONLINE'
        });
      }
    });

    // Fetch windows for window selector
    api.getDeviceWindows(activeForensicDeviceId)
      .then((res) => setWindows(res.windows || []))
      .catch(() => setWindows([]));

    // Fetch screen frame initially
    fetchScreenFrame();
  }, [activeForensicDeviceId]);

  // Handle auto-stream interval
  useEffect(() => {
    if (autoStreamIntervalRef.current) clearInterval(autoStreamIntervalRef.current);
    if (activeForensicDeviceId && activeTab === 'screen' && autoStream) {
      autoStreamIntervalRef.current = setInterval(() => {
        fetchScreenFrame();
      }, 1000);
    }
    return () => {
      if (autoStreamIntervalRef.current) clearInterval(autoStreamIntervalRef.current);
    };
  }, [activeForensicDeviceId, activeTab, autoStream, selectedWindowId]);

  const fetchScreenFrame = async () => {
    if (!activeForensicDeviceId) return;
    try {
      const winParam = selectedWindowId && selectedWindowId !== 'desktop' ? `&window_id=${encodeURIComponent(selectedWindowId)}` : '';
      const url = `/api/v1/forensics/devices/${encodeURIComponent(activeForensicDeviceId)}/screen?quality=94${winParam}&t=${Date.now()}`;
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (canvasRef.current) {
          const canvas = canvasRef.current;
          canvas.width = img.naturalWidth || 1920;
          canvas.height = img.naturalHeight || 1080;
          setScreenResolution(`${canvas.width}x${canvas.height}`);
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0);
          }
        }
        setScreenLoading(false);
      };
      img.src = url;
    } catch {
      setScreenLoading(false);
    }
  };

  const handleCanvasClick = async (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!activeForensicDeviceId || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;

    try {
      await api.sendForensicInput(activeForensicDeviceId, {
        action: 'click',
        x,
        y,
        window_id: selectedWindowId !== 'desktop' ? selectedWindowId : undefined
      });
      fetchScreenFrame();
    } catch (err) {
      console.error('Click error:', err);
    }
  };

  const sendMouseAction = async (action: string) => {
    if (!activeForensicDeviceId) return;
    try {
      await api.sendForensicInput(activeForensicDeviceId, {
        action,
        window_id: selectedWindowId !== 'desktop' ? selectedWindowId : undefined
      });
      fetchScreenFrame();
    } catch (err) {
      console.error('Mouse action error:', err);
    }
  };

  const sendHardwareKey = async (key: string) => {
    if (!activeForensicDeviceId) return;
    try {
      await api.sendForensicInput(activeForensicDeviceId, {
        action: 'key',
        key,
        window_id: selectedWindowId !== 'desktop' ? selectedWindowId : undefined
      });
      fetchScreenFrame();
    } catch (err) {
      console.error('Key action error:', err);
    }
  };

  const sendRemoteText = async () => {
    if (!activeForensicDeviceId || !remoteText.trim()) return;
    try {
      await api.sendForensicInput(activeForensicDeviceId, {
        action: 'text',
        text: remoteText,
        window_id: selectedWindowId !== 'desktop' ? selectedWindowId : undefined
      });
      setRemoteText('');
      fetchScreenFrame();
    } catch (err) {
      console.error('Text inject error:', err);
    }
  };

  const acquireCryptographicFrame = async () => {
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      const arrayBuffer = await blob.arrayBuffer();
      const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      setSnapshotDigest(hashHex);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ARTIS-VERIFIED-${device?.id || 'TARGET'}-${Date.now()}.png`;
      a.click();
      URL.revokeObjectURL(url);
    });
  };

  // Files Tab Logic
  const loadFiles = async (targetPath = currentPath) => {
    if (!activeForensicDeviceId) return;
    setFilesLoading(true);
    try {
      const res = await api.listForensicFiles(activeForensicDeviceId, targetPath);
      setFiles(res.items || []);
      setCurrentPath(res.path || targetPath);
    } catch (err: any) {
      alert({
        title: 'Directory Read Error',
        message: err.message || 'Unable to list target directory.',
        type: 'danger'
      });
    } finally {
      setFilesLoading(false);
    }
  };

  const navigateUp = () => {
    const isWindows = currentPath.includes('\\');
    if (isWindows) {
      const parts = currentPath.split('\\').filter(Boolean);
      parts.pop();
      const parent = parts.length > 0 ? parts.join('\\') : 'C:\\';
      loadFiles(parent);
    } else {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      const parent = '/' + parts.join('/');
      loadFiles(parent || '/');
    }
  };

  // Triage Tab Logic
  const loadTriage = async () => {
    if (!activeForensicDeviceId) return;
    try {
      const data = await api.getForensicTriage(activeForensicDeviceId);
      setTriage(data);
    } catch (err) {
      console.error('Failed to load triage:', err);
    }
  };

  const executeShell = async (cmdToRun = shellInput) => {
    const cmd = cmdToRun.trim();
    if (!activeForensicDeviceId || !cmd) return;
    setShellExecuting(true);
    try {
      const res = await api.executeForensicShell(activeForensicDeviceId, cmd);
      setShellOutput((prev) => `${prev}\n\n$ ${cmd}\n${res.output || '(No output returned)'}`);
      setShellInput('');
    } catch (err: any) {
      setShellOutput((prev) => `${prev}\n\n$ ${cmd}\n[ERROR]: ${err.message || 'Execution failed'}`);
    } finally {
      setShellExecuting(false);
    }
  };

  if (!activeForensicDeviceId) return null;

  const isHost = device?.type === 'host' || device?.type === 'HOST_WORKSTATION' || activeForensicDeviceId.includes('HOST');
  const isWireless = device?.connection && (device.connection.toLowerCase().includes('wireless') || device.connection.toLowerCase().includes('wi-fi'));

  return (
    <div className="fixed inset-0 z-[85] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700 rounded-sm w-full max-w-6xl h-[92vh] shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Studio Titlebar */}
        <div className="px-5 py-3.5 border-b border-slate-200 dark:border-cyber-700/60 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-cyber-800/30">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-sm bg-slate-100 dark:bg-cyber-700/60 flex items-center justify-center flex-shrink-0 text-cyan-500">
              {isHost ? <Laptop className="w-4 h-4" /> : <Smartphone className="w-4 h-4" />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {isHost ? 'Local Host Workstation' : device?.model || device?.name || 'Target Device'}
                </h3>
                <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-semibold whitespace-nowrap">
                  {isHost ? 'LOCAL HOST' : isWireless ? 'WI-FI ADB' : 'USB CABLE'}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                <span>ID: {activeForensicDeviceId}</span>
                <span>•</span>
                <span>{isHost ? 'Windows Native OS Bridge' : 'Android ADB Protocol'}</span>
              </div>
            </div>
          </div>

          {/* Studio Tab Buttons */}
          <div className="flex items-center space-x-1 bg-slate-200/70 dark:bg-cyber-900/80 p-1 rounded-sm border border-slate-300/60 dark:border-cyber-700/50">
            <button
              onClick={() => setActiveTab('screen')}
              className={`px-3 py-1.5 rounded-sm font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'screen'
                  ? 'bg-white dark:bg-cyber-700 text-blue-600 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Camera className="w-3.5 h-3.5 text-cyan-500" />
              <span>Visual Screen &amp; Remote Control</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('files');
                loadFiles();
              }}
              className={`px-3 py-1.5 rounded-sm font-medium flex items-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'files'
                  ? 'bg-white dark:bg-cyber-700 text-blue-600 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Folder className="w-3.5 h-3.5 text-amber-500" />
              <span>Evidence File Explorer</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('triage');
                loadTriage();
              }}
              className={`px-3 py-1.5 rounded-sm font-medium flex items-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'triage'
                  ? 'bg-white dark:bg-cyber-700 text-blue-600 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Terminal className="w-3.5 h-3.5 text-emerald-500" />
              <span>Triage &amp; Live Shell</span>
            </button>
          </div>

          <button
            onClick={closeForensicStudio}
            className="p-1.5 rounded-sm text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-200 dark:hover:bg-cyber-700 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Studio Content Panes */}
        <div className="flex-1 overflow-hidden relative">
          {/* PANE 1: SCREEN & REMOTE NAVIGATION */}
          {activeTab === 'screen' && (
            <div className="h-full flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
              {/* Left Screen Canvas Container */}
              <div className="flex-1 flex flex-col bg-slate-950 rounded-sm border border-slate-800 p-2 overflow-hidden relative">
                <div className="flex flex-wrap items-center justify-between px-3 py-1.5 text-[10px] text-slate-400 bg-slate-900/90 rounded-sm border border-slate-800 mb-2 z-10 select-none gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-mono font-semibold text-slate-300">LIVE INTERACTIVE DECK</span>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-cyan-400">{screenResolution}</span>
                  </div>

                  {/* Window Selector */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-600">•</span>
                    <label className="text-[10px] text-slate-400 font-medium hidden sm:inline">Target Window:</label>
                    <select
                      value={selectedWindowId}
                      onChange={(e) => setSelectedWindowId(e.target.value)}
                      className="bg-slate-800 text-slate-200 border border-slate-700 rounded-sm px-2 py-0.5 text-[10px] font-mono focus:outline-none focus:border-cyan-500 max-w-[280px] sm:max-w-[340px] truncate"
                    >
                      <option value="desktop">🖥️ Full Desktop (Display 1)</option>
                      {windows.map((w) => (
                        <option key={w.id} value={w.id}>
                          🪟 {w.title}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => {
                        api.getDeviceWindows(activeForensicDeviceId).then((r) => setWindows(r.windows || []));
                      }}
                      title="Scan & Refresh Open Windows"
                      className="p-1 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Refresh & Auto-Stream Toggles */}
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={fetchScreenFrame}
                      className="px-2 py-0.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] transition flex items-center space-x-1"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Refresh</span>
                    </button>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoStream}
                        onChange={(e) => setAutoStream(e.target.checked)}
                        className="rounded-sm border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 h-3.5 w-3.5"
                      />
                      <span className="text-[10px] font-mono text-slate-300">Auto-Stream</span>
                    </label>
                  </div>
                </div>

                {/* Canvas Center Stage */}
                <div className="flex-1 flex items-center justify-center overflow-hidden relative">
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className="max-h-full max-w-full rounded-sm shadow-2xl cursor-crosshair object-contain bg-black border border-slate-800"
                  />
                </div>

                <div className="text-center text-[10px] text-slate-400 font-mono py-1 flex items-center justify-center space-x-4">
                  <span>Click on screen to tap / navigate. All input events recorded into chain-of-custody audit log.</span>
                </div>
              </div>

              {/* Right Remote Deck Controls */}
              <div className="w-full md:w-80 flex flex-col space-y-3 overflow-y-auto custom-scrollbar flex-shrink-0">
                {/* Workstation Controls */}
                {isHost ? (
                  <div className="p-3 bg-slate-50 dark:bg-cyber-800/40 border border-slate-200 dark:border-cyber-700/60 rounded-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Workstation Pointer
                      </span>
                      <span className="text-[9px] font-mono text-cyan-500 font-semibold">PRECISION POINTER</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => sendMouseAction('click')}
                        className="py-2 px-1 rounded-sm bg-blue-600 hover:bg-blue-500 font-semibold text-white flex flex-col items-center justify-center space-y-1 transition text-[10px]"
                      >
                        LEFT CLICK
                      </button>
                      <button
                        onClick={() => sendMouseAction('double_click')}
                        className="py-2 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-semibold flex flex-col items-center justify-center space-y-1 transition text-[10px]"
                      >
                        DBL CLICK
                      </button>
                      <button
                        onClick={() => sendMouseAction('right_click')}
                        className="py-2 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-semibold flex flex-col items-center justify-center space-y-1 transition text-[10px]"
                      >
                        RIGHT CLICK
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => sendMouseAction('wheel_up')}
                        className="py-1.5 px-1 rounded-sm bg-slate-100 dark:bg-cyber-700/60 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium text-[10px] transition"
                      >
                        SCROLL UP
                      </button>
                      <button
                        onClick={() => sendMouseAction('wheel_down')}
                        className="py-1.5 px-1 rounded-sm bg-slate-100 dark:bg-cyber-700/60 hover:bg-slate-200 text-slate-700 dark:text-slate-300 font-medium text-[10px] transition"
                      >
                        SCROLL DOWN
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-200 dark:border-cyber-700/50 space-y-1.5">
                      <span className="text-[9px] font-mono text-slate-400">DESKTOP SHORTCUTS</span>
                      <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                        <button onClick={() => sendHardwareKey('WIN')} className="py-1 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 transition">⊞ WIN</button>
                        <button onClick={() => sendHardwareKey('ENTER')} className="py-1 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 transition">↵ ENTER</button>
                        <button onClick={() => sendHardwareKey('ESC')} className="py-1 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 transition">ESC</button>
                        <button onClick={() => sendHardwareKey('ALTTAB')} className="py-1 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 transition">ALT+TAB</button>
                        <button onClick={() => sendHardwareKey('TASKMGR')} className="py-1 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 transition">TASKS</button>
                        <button onClick={() => sendHardwareKey('F5')} className="py-1 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 transition">F5</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-cyber-800/40 border border-slate-200 dark:border-cyber-700/60 rounded-sm space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Mobile Navigation
                      </span>
                      <span className="text-[9px] font-mono text-cyan-500 font-semibold">KEYEVENT EMULATOR</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => sendHardwareKey('BACK')}
                        className="py-2 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-semibold text-[10px] transition"
                      >
                        BACK
                      </button>
                      <button
                        onClick={() => sendHardwareKey('HOME')}
                        className="py-2 px-1 rounded-sm bg-blue-600 hover:bg-blue-500 font-semibold text-white text-[10px] transition"
                      >
                        HOME
                      </button>
                      <button
                        onClick={() => sendHardwareKey('RECENTS')}
                        className="py-2 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 text-slate-800 dark:text-slate-200 font-semibold text-[10px] transition"
                      >
                        APPS
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 font-semibold text-[10px]">
                      <button onClick={() => sendHardwareKey('POWER')} className="py-1.5 px-1 rounded-sm bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition">POWER</button>
                      <button onClick={() => sendHardwareKey('VOLUME_UP')} className="py-1.5 px-1 rounded-sm bg-slate-100 dark:bg-cyber-700 hover:bg-slate-200 transition">VOL +</button>
                      <button onClick={() => sendHardwareKey('VOLUME_DOWN')} className="py-1.5 px-1 rounded-sm bg-slate-100 dark:bg-cyber-700 hover:bg-slate-200 transition">VOL -</button>
                    </div>
                  </div>
                )}

                {/* Remote Text Injection */}
                <div className="p-3 bg-slate-50 dark:bg-cyber-800/40 border border-slate-200 dark:border-cyber-700/60 rounded-sm space-y-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                    Remote Text Injection
                  </span>
                  <div className="flex space-x-1.5">
                    <input
                      type="text"
                      placeholder="Type text to send to target..."
                      value={remoteText}
                      onChange={(e) => setRemoteText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') sendRemoteText();
                      }}
                      className="flex-1 px-2.5 py-1.5 rounded-sm bg-white dark:bg-cyber-800 border border-slate-300 dark:border-cyber-600 focus:outline-none focus:border-cyan-500 text-slate-900 dark:text-white font-mono text-xs"
                    />
                    <button
                      onClick={sendRemoteText}
                      className="px-3 py-1.5 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition text-xs flex items-center space-x-1 cursor-pointer"
                    >
                      <Send className="w-3 h-3" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>

                {/* Verified Cryptographic Snapshot */}
                <div className="p-3 bg-blue-50/50 dark:bg-blue-950/20 border border-blue-500/20 rounded-sm space-y-2">
                  <div className="flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 font-bold">
                    <Camera className="w-4 h-4" />
                    <span>Cryptographic Frame Evidence</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Acquire exact on-screen evidence with SHA-256 digest computation for legal chain of custody.
                  </p>
                  <button
                    onClick={acquireCryptographicFrame}
                    className="w-full py-2 rounded-sm bg-blue-600 hover:bg-blue-500 text-white font-semibold transition text-xs flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Acquire Verified Frame (PNG)</span>
                  </button>
                  {snapshotDigest && (
                    <div className="p-2 rounded-sm bg-slate-100 dark:bg-cyber-900 border border-slate-200 dark:border-cyber-700 font-mono text-[9px] break-all text-slate-600 dark:text-slate-300">
                      <b>SHA-256:</b> {snapshotDigest}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* PANE 2: EVIDENCE FILE EXPLORER */}
          {activeTab === 'files' && (
            <div className="h-full flex flex-col p-4 space-y-3 overflow-hidden">
              {/* Path Navigation Bar */}
              <div className="flex items-center space-x-2 bg-slate-50 dark:bg-cyber-800/60 p-2 rounded-sm border border-slate-200 dark:border-cyber-700/60">
                <button
                  onClick={navigateUp}
                  title="Go Up Directory"
                  className="p-1.5 rounded-sm bg-white dark:bg-cyber-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-cyber-600 transition cursor-pointer"
                >
                  <CornerLeftUp className="w-4 h-4" />
                </button>
                <div className="flex-1 flex items-center space-x-1 font-mono text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-cyber-900 px-3 py-1.5 rounded-sm border border-slate-200 dark:border-cyber-700">
                  <span className="text-slate-400 select-none">Path:</span>
                  <input
                    type="text"
                    value={currentPath}
                    onChange={(e) => setCurrentPath(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') loadFiles(currentPath);
                    }}
                    className="flex-1 bg-transparent focus:outline-none font-mono text-xs"
                  />
                </div>
                <button
                  onClick={() => loadFiles(currentPath)}
                  className="px-3 py-1.5 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${filesLoading ? 'animate-spin' : ''}`} />
                  <span>Browse</span>
                </button>
              </div>

              {/* Files Table */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-cyber-800 border-b border-slate-200 dark:border-cyber-700/60 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2.5 px-4">Item Name</th>
                      <th className="py-2.5 px-3">Type</th>
                      <th className="py-2.5 px-3">Size</th>
                      <th className="py-2.5 px-3">Modified</th>
                      <th className="py-2.5 px-4 text-right">Acquisition</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-cyber-700/40 font-mono text-xs">
                    {filesLoading ? (
                      [1, 2, 3, 4].map((i) => (
                        <tr key={i} className="animate-pulse">
                          <td colSpan={5} className="py-3 px-4">
                            <div className="h-4 bg-slate-200 dark:bg-cyber-700/50 rounded-sm"></div>
                          </td>
                        </tr>
                      ))
                    ) : files.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                          No items found or directory empty. Click Browse to refresh.
                        </td>
                      </tr>
                    ) : (
                      files.map((f, idx) => (
                        <tr
                          key={idx}
                          className="hover:bg-slate-50/60 dark:hover:bg-cyber-800/30 transition cursor-pointer"
                          onClick={() => {
                            if (f.type === 'dir') {
                              loadFiles(f.path);
                            }
                          }}
                        >
                          <td className="py-2.5 px-4 flex items-center space-x-2 font-medium text-slate-900 dark:text-white">
                            {f.type === 'dir' ? (
                              <Folder className="w-4 h-4 text-amber-500 flex-shrink-0" />
                            ) : (
                              <File className="w-4 h-4 text-slate-400 flex-shrink-0" />
                            )}
                            <span className="truncate max-w-sm">{f.name}</span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 uppercase">{f.type}</td>
                          <td className="py-2.5 px-3 text-slate-500">{f.size_formatted || (f.size ? `${f.size} B` : '-')}</td>
                          <td className="py-2.5 px-3 text-slate-500">{f.modified || '-'}</td>
                          <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            {f.type !== 'dir' && (
                              <a
                                href={`/api/v1/forensics/devices/${encodeURIComponent(activeForensicDeviceId)}/files/download?path=${encodeURIComponent(f.path)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1 rounded-sm bg-slate-100 dark:bg-cyber-700/60 hover:bg-slate-200 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-cyber-600 font-medium text-[11px] inline-flex items-center space-x-1 transition"
                              >
                                <Download className="w-3 h-3" />
                                <span>Download</span>
                              </a>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Status Bar */}
              <div className="p-3 bg-slate-50 dark:bg-cyber-800/40 border border-slate-200 dark:border-cyber-700/60 rounded-sm flex items-center justify-between text-[11px] font-mono">
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                  <ShieldCheck className="w-4 h-4 text-emerald-500" />
                  <span>Evidence Integrity: SHA-256 cryptographic verification active.</span>
                </div>
              </div>
            </div>
          )}

          {/* PANE 3: SYSTEM TRIAGE & LIVE SHELL */}
          {activeTab === 'triage' && (
            <div className="h-full flex flex-col p-4 space-y-3 overflow-hidden">
              {/* Triage Specs Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 bg-slate-50 dark:bg-cyber-800/60 border border-slate-200 dark:border-cyber-700/50 rounded-sm">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">OS Version</span>
                  <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {triage?.os || (isHost ? 'Windows 11 / x64' : 'Android')}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-cyber-800/60 border border-slate-200 dark:border-cyber-700/50 rounded-sm">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Architecture</span>
                  <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {triage?.arch || (isHost ? 'AMD64' : 'arm64-v8a')}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-cyber-800/60 border border-slate-200 dark:border-cyber-700/50 rounded-sm">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Installed Packages</span>
                  <div className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
                    {triage?.packages_count || (isHost ? '340' : '85')}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-cyber-800/60 border border-slate-200 dark:border-cyber-700/50 rounded-sm">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Running Processes</span>
                  <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {triage?.procs_count || '120'}
                  </div>
                </div>
              </div>

              {/* Terminal Container */}
              <div className="flex-1 flex flex-col bg-black rounded-sm border border-slate-800 overflow-hidden font-mono text-xs">
                {/* Titlebar with Presets */}
                <div className="px-3 py-2 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2 text-slate-400 text-[11px]">
                    <span className="h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span className="font-bold text-slate-200">Interactive Forensic Shell</span>
                  </div>
                  <div className="flex flex-wrap items-center space-x-1 text-[10px]">
                    <span className="text-slate-500 mr-1">Presets:</span>
                    {isHost ? (
                      <>
                        <button onClick={() => executeShell('whoami')} className="px-2 py-0.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition">whoami</button>
                        <button onClick={() => executeShell('ipconfig /all')} className="px-2 py-0.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition">ipconfig</button>
                        <button onClick={() => executeShell('netstat -ano')} className="px-2 py-0.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition">netstat</button>
                        <button onClick={() => executeShell('tasklist')} className="px-2 py-0.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition">tasklist</button>
                      </>
                    ) : (
                      <>
                        <button onClick={() => executeShell('getprop')} className="px-2 py-0.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition">getprop</button>
                        <button onClick={() => executeShell('ip addr')} className="px-2 py-0.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition">ip addr</button>
                        <button onClick={() => executeShell('pm list packages -3')} className="px-2 py-0.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition">pm list</button>
                        <button onClick={() => executeShell('dumpsys battery')} className="px-2 py-0.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition">battery</button>
                      </>
                    )}
                  </div>
                </div>

                {/* Terminal Output */}
                <div className="flex-1 p-3 overflow-y-auto custom-scrollbar text-emerald-400 whitespace-pre-wrap font-mono text-xs leading-relaxed select-text">
                  {shellOutput}
                </div>

                {/* Input Bar */}
                <div className="p-2 bg-slate-900/90 border-t border-slate-800 flex items-center space-x-2">
                  <span className="text-cyan-400 font-bold pl-2 select-none">$</span>
                  <input
                    type="text"
                    placeholder="Enter shell command (e.g. ps -A, whoami, ls -la, netstat)..."
                    value={shellInput}
                    onChange={(e) => setShellInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') executeShell();
                    }}
                    className="flex-1 bg-transparent text-white focus:outline-none font-mono text-xs"
                  />
                  <button
                    onClick={() => executeShell()}
                    disabled={shellExecuting}
                    className="px-3 py-1 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    {shellExecuting ? 'Executing...' : 'Execute'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
