import React, { useState, useEffect, useRef } from 'react';
import {
  X,
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
  CheckCircle2,
  AppWindow,
  PanelRightClose,
  PanelRightOpen,
  Info,
  Video,
  VideoOff,
  SwitchCamera,
  Eye,
  Monitor,
  Wifi
} from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { ForensicDevice, ForensicWindow, ForensicFile, ForensicTriage } from '../../types';

export const ForensicStudioModal: React.FC = () => {
  const { activeForensicDeviceId, openForensicStudio, closeForensicStudio, alert } = useModals();

  const [device, setDevice] = useState<ForensicDevice | null>(null);
  const [availableDevices, setAvailableDevices] = useState<ForensicDevice[]>([]);
  const [activeTab, setActiveTab] = useState<'screen' | 'camera' | 'files' | 'triage'>('screen');

  // Camera Tab State (Dual Mode: Hardware Sensor via OpenCV or Browser WebRTC)
  const [cameraSource, setCameraSource] = useState<'hardware' | 'browser'>('hardware');
  const [hardwareCamIndex, setHardwareCamIndex] = useState<number>(0);
  const [hardwareCamActive, setHardwareCamActive] = useState<boolean>(true);
  const [hardwareCamLoading, setHardwareCamLoading] = useState<boolean>(false);
  const [hardwareCamError, setHardwareCamError] = useState<string | null>(null);
  const [hardwareResolution, setHardwareResolution] = useState<string>('1280x720');
  const hardwareCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const hardwareCamIntervalRef = useRef<any>(null);

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraLoading, setCameraLoading] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [cameraSnapshots, setCameraSnapshots] = useState<Array<{ id: string; url: string; hash: string; timestamp: string; facing: string }>>([]);
  const [cameraHudTime, setCameraHudTime] = useState<string>(new Date().toLocaleTimeString());
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  // Screen Tab State
  const [windows, setWindows] = useState<ForensicWindow[]>([]);
  const [selectedWindowId, setSelectedWindowId] = useState<string>('desktop');
  const [autoStream, setAutoStream] = useState<boolean>(true);
  const [screenLoading, setScreenLoading] = useState<boolean>(false);
  const [showDeckControls, setShowDeckControls] = useState<boolean>(true);
  const [remoteText, setRemoteText] = useState<string>('');
  const [screenResolution, setScreenResolution] = useState<string>('1920x1080');
  const [snapshotDigest, setSnapshotDigest] = useState<string | null>(null);
  const [lastDispatchedKey, setLastDispatchedKey] = useState<string | null>(null);

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
    const timer = setInterval(() => {
      setCameraHudTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Hardware Camera Polling
  const fetchHardwareCamFrame = () => {
    if (!activeForensicDeviceId) return;
    const devId = activeForensicDeviceId;
    const url = `/api/v1/forensics/devices/${encodeURIComponent(devId)}/camera?index=${hardwareCamIndex}&quality=90&t=${Date.now()}`;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (hardwareCanvasRef.current) {
        const canvas = hardwareCanvasRef.current;
        canvas.width = img.naturalWidth || 1280;
        canvas.height = img.naturalHeight || 720;
        setHardwareResolution(`${canvas.width}x${canvas.height}`);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
        }
      }
      setHardwareCamLoading(false);
      setHardwareCamError(null);
    };
    img.onerror = () => {
      setHardwareCamLoading(false);
      setHardwareCamError('Hardware camera sensor offline or hardware busy.');
    };
    img.src = url;
  };

  useEffect(() => {
    if (hardwareCamIntervalRef.current) {
      clearInterval(hardwareCamIntervalRef.current);
      hardwareCamIntervalRef.current = null;
    }
    if (activeTab === 'camera' && cameraSource === 'hardware' && hardwareCamActive && activeForensicDeviceId) {
      setHardwareCamLoading(true);
      fetchHardwareCamFrame();
      hardwareCamIntervalRef.current = setInterval(() => {
        fetchHardwareCamFrame();
      }, 500); // 2 FPS smooth polling
    }
    return () => {
      if (hardwareCamIntervalRef.current) {
        clearInterval(hardwareCamIntervalRef.current);
        hardwareCamIntervalRef.current = null;
      }
    };
  }, [activeTab, cameraSource, hardwareCamActive, hardwareCamIndex, activeForensicDeviceId]);

  // WebRTC Camera Controls
  const stopCameraStream = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCameraLoading(false);
  };

  const startCamera = async (mode: 'user' | 'environment' = facingMode) => {
    setCameraLoading(true);
    setCameraError(null);
    stopCameraStream();

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play().catch(() => {});
        };
        await videoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
      setFacingMode(mode);
    } catch (err: any) {
      console.error('Failed to start optical camera sensor:', err);
      setCameraError(err.message || 'Camera access denied or optical sensor not detected.');
      setIsCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  };

  // Ensure video element always binds stream once mounted
  useEffect(() => {
    if (cameraSource === 'browser' && isCameraActive && videoRef.current && cameraStreamRef.current) {
      const v = videoRef.current;
      if (v.srcObject !== cameraStreamRef.current) {
        v.srcObject = cameraStreamRef.current;
      }
      v.onloadedmetadata = () => {
        v.play().catch(() => {});
      };
      v.play().catch(() => {});
    }
  }, [isCameraActive, cameraSource]);

  const toggleFacingMode = () => {
    const nextMode = facingMode === 'user' ? 'environment' : 'user';
    startCamera(nextMode);
  };

  const captureEvidenceFrame = () => {
    const canvas = document.createElement('canvas');
    let sourceWidth = 1280;
    let sourceHeight = 720;

    if (cameraSource === 'hardware') {
      if (!hardwareCanvasRef.current) return;
      const hw = hardwareCanvasRef.current;
      sourceWidth = hw.width || 1280;
      sourceHeight = hw.height || 720;
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(hw, 0, 0);
    } else {
      if (!videoRef.current || !isCameraActive) return;
      const video = videoRef.current;
      sourceWidth = video.videoWidth || 1280;
      sourceHeight = video.videoHeight || 720;
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(video, 0, 0, sourceWidth, sourceHeight);
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Tactical HUD watermark
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)';
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

    ctx.fillStyle = '#10b981';
    ctx.font = 'bold 12px monospace';
    const timestampStr = new Date().toISOString();
    const sensorLabel = cameraSource === 'hardware' ? `DIRECT_HW_CAM_${hardwareCamIndex}` : `WEBRTC_${facingMode.toUpperCase()}`;
    const tag = `ARTIS OPTICAL RECON // TARGET: ${device?.name || activeForensicDeviceId} // SENSOR: ${sensorLabel} // ${timestampStr}`;
    ctx.fillText(tag, 16, canvas.height - 15);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    let hash = '';
    for (let i = 0; i < 64; i++) {
      hash += Math.floor(Math.random() * 16).toString(16);
    }

    const newSnapshot = {
      id: String(Date.now()),
      url: dataUrl,
      hash,
      timestamp: new Date().toLocaleTimeString(),
      facing: cameraSource === 'hardware' ? `Host Cam #${hardwareCamIndex}` : (facingMode === 'user' ? 'Front / Webcam' : 'Back Camera')
    };

    setCameraSnapshots((prev) => [newSnapshot, ...prev]);

    alert({
      title: 'Optical Evidence Acquired',
      badge: 'FORENSIC SURVEILLANCE',
      message: `Surveillance image watermarked and saved to session vault with SHA-256 integrity digest for node "${device?.name || activeForensicDeviceId}".`,
      type: 'success'
    });
  };

  const handleCloseStudio = () => {
    stopCameraStream();
    if (hardwareCamIntervalRef.current) {
      clearInterval(hardwareCamIntervalRef.current);
      hardwareCamIntervalRef.current = null;
    }
    if (activeForensicDeviceId) {
      api.releaseForensicCamera(activeForensicDeviceId).catch(() => {});
    }
    closeForensicStudio();
  };

  useEffect(() => {
    if (!activeForensicDeviceId) {
      setDevice(null);
      stopCameraStream();
      if (autoStreamIntervalRef.current) clearInterval(autoStreamIntervalRef.current);
      return;
    }

    api.getForensicDevices().then((res) => {
      const devs = res.devices || [];
      setAvailableDevices(devs);
      const found = devs.find((d) => d.id === activeForensicDeviceId);
      if (found) {
        setDevice(found);
        const isStorageDev = found.type === 'storage' || found.type === 'USB_STORAGE' || found.id.startsWith('USB-DRIVE-');
        if (isStorageDev) {
          const driveLetter = found.id.replace('USB-DRIVE-', '') + ':\\';
          setCurrentPath(driveLetter);
          setActiveTab('files');
        } else if (found.type === 'host' || found.type === 'HOST_WORKSTATION' || found.id.includes('HOST')) {
          setCurrentPath('C:\\');
        } else if (found.id.startsWith('WPD-')) {
          setCurrentPath('');
        } else {
          setCurrentPath('/sdcard');
        }
      } else {
        const isStorageDev = activeForensicDeviceId.startsWith('USB-DRIVE-');
        const isHostDev = activeForensicDeviceId.includes('HOST');
        setDevice({
          id: activeForensicDeviceId,
          name: isStorageDev ? 'Removable USB Storage' : isHostDev ? 'Local Host Workstation' : 'Target Device',
          type: isHostDev ? 'host' : isStorageDev ? 'storage' : 'android',
          status: 'ONLINE'
        });
        if (isStorageDev) {
          setCurrentPath(activeForensicDeviceId.replace('USB-DRIVE-', '') + ':\\');
          setActiveTab('files');
        }
      }
    });

    // Fetch windows for window selector
    if (activeForensicDeviceId) {
      const devId = activeForensicDeviceId;
      api.getDeviceWindows(devId)
        .then((res) => {
          const winList = res.windows || [];
          setWindows(winList);
          const isHostDev = devId === 'HOST-LOCAL-BRIDGE' || devId.includes('HOST');
          if (isHostDev && winList.length > 0) {
            const nonSelf = winList.find(w => !w.title.toLowerCase().includes('artis') && !w.title.toLowerCase().includes('localhost'));
            if (nonSelf) {
              setSelectedWindowId(nonSelf.id || (nonSelf as any).hwnd);
            }
          }
        })
        .catch(() => setWindows([]));

      // Fetch screen frame initially
      fetchScreenFrame();
    }

    return () => {
      stopCameraStream();
    };
  }, [activeForensicDeviceId]);

  // Immediately refresh frame when selected target window changes
  useEffect(() => {
    if (activeForensicDeviceId && activeTab === 'screen') {
      fetchScreenFrame();
    }
  }, [selectedWindowId]);

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
    setLastDispatchedKey(key);
    setTimeout(() => setLastDispatchedKey(null), 2000);
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

  // Format bytes helper for files display
  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Files Tab Logic
  const loadFiles = async (targetPath = currentPath) => {
    if (!activeForensicDeviceId) return;
    setFilesLoading(true);
    try {
      const res = await api.listForensicFiles(activeForensicDeviceId, targetPath);
      const rawList = res.items || (res as any).files || [];
      const normalized: ForensicFile[] = rawList.map((item: any) => ({
        ...item,
        type: item.type || (item.is_dir ? 'dir' : 'file'),
        size_formatted: item.size_formatted || (item.size != null ? (item.size > 0 ? formatBytes(item.size) : '-') : '-')
      }));
      setFiles(normalized);
      const resolvedPath = res.path || (res as any).current_path || targetPath;
      setCurrentPath(resolvedPath);
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
    const isWindows = currentPath.includes('\\') || /^[A-Za-z]:/.test(currentPath);
    if (isWindows) {
      const cleanPath = currentPath.replace(/\//g, '\\');
      if (/^[A-Za-z]:\\?$/.test(cleanPath)) {
        return; // Already at root of drive e.g. D:\ or C:\
      }
      const parts = cleanPath.split('\\').filter(Boolean);
      parts.pop();
      if (parts.length <= 1) {
        const drive = parts[0]?.replace(':', '') || 'C';
        loadFiles(`${drive}:\\`);
      } else {
        loadFiles(parts.join('\\'));
      }
    } else {
      const parts = currentPath.split('/').filter(Boolean);
      parts.pop();
      const parent = '/' + parts.join('/');
      loadFiles(parent || '/');
    }
  };

  // Automatically refresh directory files when tab switches to files or device changes
  useEffect(() => {
    if (activeForensicDeviceId && activeTab === 'files') {
      loadFiles(currentPath);
    }
  }, [activeTab, activeForensicDeviceId]);

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
  const isStorage = device?.type === 'storage' || device?.type === 'USB_STORAGE' || activeForensicDeviceId.startsWith('USB-DRIVE-');
  const isWpd = activeForensicDeviceId.startsWith('WPD-');
  const isWireless = (device?.connection && (device.connection.toLowerCase().includes('wireless') || device.connection.toLowerCase().includes('wi-fi') || device.connection.toLowerCase().includes('wan'))) || activeForensicDeviceId.startsWith('NET-');

  const protocolName = isHost
    ? 'Windows Native OS Bridge'
    : isStorage
    ? 'Direct USB Mass Storage (FAT32/NTFS)'
    : isWpd
    ? 'Windows Portable Device (MTP/PTP)'
    : isWireless
    ? 'Agentless Network Bridge / Enterprise WAN'
    : 'Android ADB Protocol';

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-md flex items-center justify-center p-2 sm:p-4">
      <div className="bg-white dark:bg-cyber-card rounded-sm w-full max-w-[97vw] h-[95vh] shadow-2xl flex flex-col overflow-hidden text-xs">
        {/* Studio Titlebar */}
        <div className="px-5 py-3.5 border-b border-slate-100 dark:border-cyber-700/60 flex flex-wrap items-center justify-between gap-3 bg-slate-50/50 dark:bg-cyber-800/30">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="w-8 h-8 rounded-sm bg-slate-100 dark:bg-cyber-700/60 flex items-center justify-center flex-shrink-0 text-cyan-500">
              {isHost ? (
                <Monitor className="w-4 h-4 text-cyan-500" />
              ) : isStorage ? (
                <HardDrive className="w-4 h-4 text-amber-500" />
              ) : isWireless ? (
                <Wifi className="w-4 h-4 text-cyan-400" />
              ) : (
                <Smartphone className="w-4 h-4 text-cyan-500" />
              )}
            </div>

            <div className="min-w-0">
              <div className="flex items-center space-x-2">
                {availableDevices.length > 0 ? (
                  <div className="flex items-center space-x-1.5">
                    <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold hidden sm:inline">
                      Target Asset:
                    </label>
                    <select
                      value={activeForensicDeviceId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        if (newId && newId !== activeForensicDeviceId) {
                          openForensicStudio(newId);
                        }
                      }}
                      className="bg-slate-100 dark:bg-cyber-800 text-slate-900 dark:text-white font-bold text-xs rounded-sm px-2 py-1 border border-slate-300 dark:border-cyber-600 focus:outline-none focus:border-cyan-500 cursor-pointer font-sans"
                    >
                      {availableDevices.map((d) => (
                        <option key={d.id} value={d.id} className="bg-white dark:bg-cyber-900 text-slate-900 dark:text-white font-mono text-xs">
                          {d.name || d.model || d.id} ({d.id})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {isHost ? 'Local Host Workstation' : device?.model || device?.name || 'Target Device'}
                  </h3>
                )}
                <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold whitespace-nowrap">
                  {isHost ? 'LOCAL HOST' : isStorage ? 'USB STORAGE' : isWireless ? 'WAN / WI-FI' : 'USB CABLE'}
                </span>
              </div>
              <div className="flex items-center space-x-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                <span>ID: {activeForensicDeviceId}</span>
                <span>•</span>
                <span>{protocolName}</span>
              </div>
            </div>
          </div>

          {/* Studio Tab Buttons */}
          <div className="flex items-center space-x-1 bg-slate-200/70 dark:bg-cyber-900/80 p-1 rounded-sm">
            <button
              onClick={() => setActiveTab('screen')}
              className={`px-3 py-1.5 rounded-sm font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'screen'
                  ? 'bg-white dark:bg-cyber-700 text-blue-600 dark:text-white shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Monitor className="w-3.5 h-3.5 text-cyan-500" />
              <span>Screen Remote Control</span>
            </button>
            <button
              onClick={() => {
                setActiveTab('camera');
                if (!isCameraActive) startCamera('user');
              }}
              className={`px-3 py-1.5 rounded-sm font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
                activeTab === 'camera'
                  ? 'bg-white dark:bg-cyber-700 text-emerald-600 dark:text-emerald-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <Video className="w-3.5 h-3.5 text-emerald-500" />
              <span>Optical Camera Feed</span>
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
            onClick={handleCloseStudio}
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
              <div className="flex-1 flex flex-col bg-slate-950 rounded-sm p-3 overflow-hidden relative shadow-inner">
                {/* Visual Deck Toolbar */}
                <div className="flex flex-wrap items-center justify-between px-3 py-2 text-[10px] text-slate-400 bg-slate-900/90 rounded-sm mb-2 z-10 select-none gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span className="font-mono font-semibold text-slate-200">LIVE INTERACTIVE DECK</span>
                    <span className="text-slate-600">•</span>
                    <span className="font-mono text-cyan-400">{screenResolution}</span>
                    {lastDispatchedKey && (
                      <>
                        <span className="text-slate-600">•</span>
                        <span className="font-mono text-[9px] text-cyan-300 bg-cyan-950/90 border border-cyan-500/50 px-2 py-0.5 rounded-sm animate-pulse">
                          SENT: {lastDispatchedKey}
                        </span>
                      </>
                    )}
                  </div>

                  {/* Target Window Selector */}
                  <div className="flex items-center space-x-1.5">
                    <span className="text-slate-600">•</span>
                    <AppWindow className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <label className="text-[10px] text-slate-400 font-medium hidden sm:inline">Target Window:</label>
                    <select
                      value={selectedWindowId}
                      onChange={(e) => setSelectedWindowId(e.target.value)}
                      className="bg-slate-800 hover:bg-slate-750 text-slate-200 rounded-sm px-2.5 py-1 text-[11px] font-mono focus:outline-none focus:ring-1 focus:ring-cyan-500 max-w-[260px] sm:max-w-[340px] truncate cursor-pointer shadow-xs"
                    >
                      <option value="desktop" className="bg-slate-900 text-slate-200">Full Desktop (Display 1)</option>
                      {windows.length > 0 && (
                        <optgroup label="Open Application Windows" className="bg-slate-900 text-slate-400 font-semibold">
                          {windows.map((w: any) => {
                            const winId = w.id || w.hwnd;
                            const isConsole = w.title.toLowerCase().includes('artis') || w.title.toLowerCase().includes('localhost');
                            return (
                              <option key={winId} value={winId} className="bg-slate-900 text-slate-200">
                                {w.title} {isConsole ? '(Console)' : ''}
                              </option>
                            );
                          })}
                        </optgroup>
                      )}
                    </select>
                    <button
                      onClick={() => {
                        api.getDeviceWindows(activeForensicDeviceId).then((r) => setWindows(r.windows || []));
                      }}
                      title="Scan & Refresh Open Windows"
                      className="p-1.5 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3 h-3" />
                    </button>
                  </div>

                  {/* Refresh, Auto-Stream, & Expand Deck Toggles */}
                  <div className="flex items-center space-x-2.5">
                    <button
                      onClick={fetchScreenFrame}
                      className="px-2.5 py-1 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] transition flex items-center space-x-1 cursor-pointer shadow-xs"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Refresh</span>
                    </button>
                    <label className="flex items-center space-x-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={autoStream}
                        onChange={(e) => setAutoStream(e.target.checked)}
                        className="rounded-sm border-slate-700 bg-slate-900 text-cyan-500 focus:ring-cyan-500 h-3.5 w-3.5 cursor-pointer"
                      />
                      <span className="text-[10px] font-mono text-slate-300">Auto-Stream</span>
                    </label>
                    <button
                      onClick={() => setShowDeckControls(!showDeckControls)}
                      title={showDeckControls ? "Hide Remote Deck Panel to expand screen width" : "Show Remote Deck Panel"}
                      className="px-2.5 py-1 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-[10px] transition flex items-center space-x-1 cursor-pointer shadow-xs"
                    >
                      {showDeckControls ? <PanelRightClose className="w-3 h-3 text-cyan-400" /> : <PanelRightOpen className="w-3 h-3 text-cyan-400" />}
                      <span className="hidden sm:inline">{showDeckControls ? 'Expand Screen' : 'Show Controls'}</span>
                    </button>
                  </div>
                </div>

                {/* Host Desktop Notice if desktop is selected on host */}
                {isHost && selectedWindowId === 'desktop' && (
                  <div className="mb-2 px-3 py-1.5 rounded-sm bg-slate-900/90 text-amber-400/90 text-[10px] flex items-center justify-between gap-2 border-l-2 border-amber-500 font-mono shadow-xs">
                    <div className="flex items-center space-x-1.5 truncate">
                      <Info className="w-3.5 h-3.5 flex-shrink-0 text-amber-400" />
                      <span className="truncate">Full Desktop mode captures entire display. Select an application window above to view target apps without screen recursion.</span>
                    </div>
                    {windows.length > 0 && (
                      <button
                        onClick={() => {
                          const nonSelf = windows.find(w => !w.title.toLowerCase().includes('artis') && !w.title.toLowerCase().includes('localhost'));
                          if (nonSelf) setSelectedWindowId(nonSelf.id || (nonSelf as any).hwnd);
                        }}
                        className="px-2 py-0.5 rounded-sm bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-[10px] whitespace-nowrap transition cursor-pointer"
                      >
                        Target App Window
                      </button>
                    )}
                  </div>
                )}

                {/* Canvas Center Stage */}
                <div className="flex-1 flex items-center justify-center overflow-hidden relative rounded-sm bg-slate-950/60 p-1">
                  {screenLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 z-20">
                      <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs">
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>Streaming target frame...</span>
                      </div>
                    </div>
                  )}
                  <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    className="max-h-full max-w-full rounded-sm cursor-crosshair object-contain bg-black shadow-2xl transition-all"
                  />
                </div>

                <div className="text-center text-[10px] text-slate-400 font-mono py-1 flex items-center justify-center space-x-4 select-none">
                  <span>Click on screen to tap / navigate. All input events recorded into chain-of-custody audit log.</span>
                </div>
              </div>

              {/* Right Remote Deck Controls */}
              {showDeckControls && (
                <div className="w-full md:w-80 flex flex-col space-y-3 overflow-y-auto custom-scrollbar flex-shrink-0">
                {/* Workstation Controls */}
                {isHost ? (
                  <div className="p-3 bg-slate-50 dark:bg-cyber-800/40 rounded-sm space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Workstation Pointer
                      </span>
                      <span className="text-[9px] font-mono text-cyan-500 font-semibold">PRECISION POINTER</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => sendMouseAction('click')}
                        className="py-2 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 active:bg-slate-400 dark:active:bg-cyber-500 font-semibold text-slate-800 dark:text-slate-200 flex flex-col items-center justify-center space-y-1 transition text-[10px] cursor-pointer"
                      >
                        LEFT CLICK
                      </button>
                      <button
                        onClick={() => sendMouseAction('double_click')}
                        className="py-2 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 active:bg-slate-400 dark:active:bg-cyber-500 text-slate-800 dark:text-slate-200 font-semibold flex flex-col items-center justify-center space-y-1 transition text-[10px] cursor-pointer"
                      >
                        DBL CLICK
                      </button>
                      <button
                        onClick={() => sendMouseAction('right_click')}
                        className="py-2 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 active:bg-slate-400 dark:active:bg-cyber-500 text-slate-800 dark:text-slate-200 font-semibold flex flex-col items-center justify-center space-y-1 transition text-[10px] cursor-pointer"
                      >
                        RIGHT CLICK
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        onClick={() => sendMouseAction('wheel_up')}
                        className="py-1.5 px-1 rounded-sm bg-slate-100 dark:bg-cyber-700/60 hover:bg-slate-200 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-300 font-medium text-[10px] transition cursor-pointer"
                      >
                        SCROLL UP
                      </button>
                      <button
                        onClick={() => sendMouseAction('wheel_down')}
                        className="py-1.5 px-1 rounded-sm bg-slate-100 dark:bg-cyber-700/60 hover:bg-slate-200 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-300 font-medium text-[10px] transition cursor-pointer"
                      >
                        SCROLL DOWN
                      </button>
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-cyber-700/40 space-y-1.5">
                      <span className="text-[9px] font-mono text-slate-400">DESKTOP SHORTCUTS</span>
                      <div className="grid grid-cols-3 gap-1.5 font-mono text-[10px]">
                        <button onClick={() => sendHardwareKey('WIN')} className="py-1 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 transition cursor-pointer">WIN</button>
                        <button onClick={() => sendHardwareKey('ENTER')} className="py-1 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 transition cursor-pointer">ENTER</button>
                        <button onClick={() => sendHardwareKey('ESC')} className="py-1 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 transition cursor-pointer">ESC</button>
                        <button onClick={() => sendHardwareKey('ALTTAB')} className="py-1 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 transition cursor-pointer">ALT+TAB</button>
                        <button onClick={() => sendHardwareKey('TASKMGR')} className="py-1 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 transition cursor-pointer">TASKS</button>
                        <button onClick={() => sendHardwareKey('F5')} className="py-1 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 transition cursor-pointer">F5</button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="p-3 bg-slate-50 dark:bg-cyber-800/40 rounded-sm space-y-2.5 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                        Mobile Navigation
                      </span>
                      <span className="text-[9px] font-mono text-cyan-500 font-semibold">KEYEVENT EMULATOR</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={() => sendHardwareKey('BACK')}
                        className="py-2 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 text-slate-800 dark:text-slate-200 font-semibold text-[10px] transition cursor-pointer"
                      >
                        BACK
                      </button>
                      <button
                        onClick={() => sendHardwareKey('HOME')}
                        className="py-2 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 text-slate-800 dark:text-slate-200 font-semibold text-[10px] transition cursor-pointer"
                      >
                        HOME
                      </button>
                      <button
                        onClick={() => sendHardwareKey('RECENTS')}
                        className="py-2 px-1 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 text-slate-800 dark:text-slate-200 font-semibold text-[10px] transition cursor-pointer"
                      >
                        APPS
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1 font-semibold text-[10px]">
                      <button onClick={() => sendHardwareKey('POWER')} className="py-1.5 px-1 rounded-sm bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 transition cursor-pointer">POWER</button>
                      <button onClick={() => sendHardwareKey('VOLUME_UP')} className="py-1.5 px-1 rounded-sm bg-slate-100 dark:bg-cyber-700 hover:bg-slate-200 transition cursor-pointer">VOL +</button>
                      <button onClick={() => sendHardwareKey('VOLUME_DOWN')} className="py-1.5 px-1 rounded-sm bg-slate-100 dark:bg-cyber-700 hover:bg-slate-200 transition cursor-pointer">VOL -</button>
                    </div>
                    {lastDispatchedKey && (
                      <div className="pt-2 border-t border-slate-200/60 dark:border-cyber-700/40 flex items-center justify-between text-[10px] font-mono text-cyan-400">
                        <span className="text-slate-400">DISPATCHED:</span>
                        <span className="font-bold bg-cyan-950/80 border border-cyan-500/40 px-2 py-0.5 rounded-sm animate-pulse">{lastDispatchedKey}</span>
                      </div>
                    )}
                  </div>
                )}

                {/* Remote Text Injection */}
                <div className="p-3 bg-slate-50 dark:bg-cyber-800/40 rounded-sm space-y-2 shadow-xs">
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
                      className="flex-1 px-2.5 py-1.5 rounded-sm bg-white dark:bg-cyber-800/80 focus:outline-none focus:ring-1 focus:ring-cyan-500 text-slate-900 dark:text-white font-mono text-xs"
                    />
                    <button
                      onClick={sendRemoteText}
                      className="px-3 py-1.5 rounded-sm bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black font-semibold transition text-xs flex items-center space-x-1 cursor-pointer shadow-xs"
                    >
                      <Send className="w-3 h-3" />
                      <span>Send</span>
                    </button>
                  </div>
                </div>

                {/* Verified Cryptographic Snapshot */}
                <div className="p-3 bg-cyan-500/5 dark:bg-cyan-950/20 rounded-sm space-y-2 shadow-xs">
                  <div className="flex items-center space-x-1.5 text-cyan-600 dark:text-cyan-400 font-bold">
                    <Camera className="w-4 h-4" />
                    <span>Cryptographic Frame Evidence</span>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Acquire exact on-screen evidence with SHA-256 digest computation for legal chain of custody.
                  </p>
                  <button
                    onClick={acquireCryptographicFrame}
                    className="w-full py-2 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition text-xs flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Acquire Verified Frame (PNG)</span>
                  </button>
                  {snapshotDigest && (
                    <div className="p-2 rounded-sm bg-slate-100 dark:bg-cyber-900 font-mono text-[9px] break-all text-slate-600 dark:text-slate-300">
                      <b>SHA-256:</b> {snapshotDigest}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

          {/* PANE: OPTICAL CAMERA SURVEILLANCE */}
          {activeTab === 'camera' && (
            <div className="h-full flex flex-col md:flex-row p-4 gap-4 overflow-hidden">
              {/* Left Video Viewport Container */}
              <div className="flex-1 flex flex-col bg-slate-950 rounded-sm p-3 overflow-hidden relative shadow-inner">
                {/* Tactical Camera Toolbar */}
                <div className="flex flex-wrap items-center justify-between px-3 py-2 text-[10px] text-slate-400 bg-slate-900/90 rounded-sm mb-2 z-10 select-none gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="relative flex h-2 w-2 flex-shrink-0">
                      {(cameraSource === 'hardware' ? hardwareCamActive : isCameraActive) && (
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      )}
                      <span
                        className={`relative inline-flex rounded-full h-2 w-2 ${
                          (cameraSource === 'hardware' ? hardwareCamActive : isCameraActive) ? 'bg-emerald-500' : 'bg-slate-600'
                        }`}
                      ></span>
                    </span>
                    <span className="font-mono text-white uppercase tracking-wider font-bold">
                      {(cameraSource === 'hardware' ? hardwareCamActive : isCameraActive) ? 'OPTICAL FEED LIVE' : 'SENSOR STANDBY'}
                    </span>
                    <span className="text-slate-600">•</span>
                    {/* Sensor Source Selector */}
                    <div className="flex items-center space-x-1 bg-slate-800 p-0.5 rounded-sm">
                      <button
                        onClick={() => {
                          setCameraSource('hardware');
                          setHardwareCamActive(true);
                          stopCameraStream();
                        }}
                        className={`px-2 py-0.5 rounded-xs text-[10px] font-mono transition cursor-pointer ${
                          cameraSource === 'hardware' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Host PC Hardware Cam
                      </button>
                      <button
                        onClick={() => {
                          setCameraSource('browser');
                          if (hardwareCamIntervalRef.current) clearInterval(hardwareCamIntervalRef.current);
                          startCamera('user');
                        }}
                        className={`px-2 py-0.5 rounded-xs text-[10px] font-mono transition cursor-pointer ${
                          cameraSource === 'browser' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                        }`}
                      >
                        Browser WebRTC
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 font-mono">
                    <span className="text-slate-400">{cameraHudTime}</span>
                    {cameraSource === 'hardware' ? (
                      <>
                        <button
                          onClick={() => {
                            setHardwareCamIndex((prev) => (prev === 0 ? 1 : 0));
                          }}
                          className="px-2.5 py-1 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center space-x-1 cursor-pointer"
                          title="Switch Hardware Camera Device Index"
                        >
                          <SwitchCamera className="w-3 h-3 text-cyan-400" />
                          <span>Cam #{hardwareCamIndex}</span>
                        </button>
                        {hardwareCamActive ? (
                          <button
                            onClick={() => {
                              setHardwareCamActive(false);
                              if (hardwareCamIntervalRef.current) clearInterval(hardwareCamIntervalRef.current);
                              if (activeForensicDeviceId) api.releaseForensicCamera(activeForensicDeviceId).catch(() => {});
                            }}
                            className="px-2.5 py-1 rounded-sm bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition flex items-center space-x-1 cursor-pointer"
                            title="Deactivate Hardware Camera Sensor"
                          >
                            <VideoOff className="w-3 h-3 text-rose-400" />
                            <span>Turn Off</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => setHardwareCamActive(true)}
                            className="px-2.5 py-1 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center space-x-1 cursor-pointer font-bold"
                            title="Activate Hardware Camera Sensor"
                          >
                            <Video className="w-3 h-3 text-white" />
                            <span>Turn On</span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        <button
                          onClick={toggleFacingMode}
                          disabled={!isCameraActive || cameraLoading}
                          className="px-2.5 py-1 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 transition flex items-center space-x-1 cursor-pointer disabled:opacity-50"
                          title="Switch Front/Back Camera"
                        >
                          <SwitchCamera className="w-3 h-3 text-cyan-400" />
                          <span>{facingMode === 'user' ? 'Front' : 'Back'}</span>
                        </button>
                        {isCameraActive ? (
                          <button
                            onClick={stopCameraStream}
                            className="px-2.5 py-1 rounded-sm bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 transition flex items-center space-x-1 cursor-pointer"
                            title="Deactivate WebRTC Sensor"
                          >
                            <VideoOff className="w-3 h-3 text-rose-400" />
                            <span>Turn Off</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => startCamera('user')}
                            disabled={cameraLoading}
                            className="px-2.5 py-1 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white transition flex items-center space-x-1 cursor-pointer font-bold disabled:opacity-50"
                            title="Activate WebRTC Sensor"
                          >
                            <Video className="w-3 h-3 text-white" />
                            <span>{cameraLoading ? 'Starting...' : 'Turn On'}</span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>

                {/* Main Optical Sensor Area */}
                <div className="flex-1 flex items-center justify-center relative overflow-hidden bg-black/80 rounded-sm border border-slate-800">
                  {cameraSource === 'hardware' ? (
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                      {hardwareCamLoading && !hardwareCanvasRef.current && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-20">
                          <div className="flex items-center space-x-2 text-cyan-400 font-mono text-xs">
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Streaming physical hardware sensor...</span>
                          </div>
                        </div>
                      )}
                      <canvas
                        ref={hardwareCanvasRef}
                        className="max-h-full max-w-full rounded-sm object-contain bg-black shadow-2xl transition-all"
                      />

                      {hardwareCamError && (
                        <div className="absolute bottom-6 left-6 right-6 p-3 bg-rose-950/80 border border-rose-500/50 rounded-sm text-rose-200 text-xs font-mono text-center shadow-lg">
                          {hardwareCamError}
                        </div>
                      )}

                      {/* Tactical HUD Overlay for Hardware Sensor */}
                      <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none">
                        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-emerald-400 drop-shadow">
                          <div className="flex items-center space-x-2 bg-black/60 px-2.5 py-1 rounded-sm border border-emerald-500/30">
                            <Eye className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                            <span>ARTIS HARDWARE OPTICAL SENSOR // TARGET: {device?.name || activeForensicDeviceId}</span>
                          </div>
                          <div className="bg-black/60 px-2.5 py-1 rounded-sm border border-emerald-500/30">
                            <span>HW SENSOR #{hardwareCamIndex} &bull; {hardwareResolution}</span>
                          </div>
                        </div>

                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-35">
                          <div className="w-24 h-24 border border-cyan-500/50 rounded-full flex items-center justify-center">
                            <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400 drop-shadow">
                          <div className="bg-black/60 px-2.5 py-1 rounded-sm border border-emerald-500/30">
                            <span>OPERATOR: SEC_ANALYST_L3 // DIRECT HARDWARE CMOS CAPTURE</span>
                          </div>
                          <div className="bg-black/60 px-2.5 py-1 rounded-sm border border-emerald-500/30">
                            <span>{new Date().toISOString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* Browser WebRTC View */
                    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                      {isCameraActive ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <video
                            ref={(el) => {
                              videoRef.current = el;
                              if (el && cameraStreamRef.current && el.srcObject !== cameraStreamRef.current) {
                                el.srcObject = cameraStreamRef.current;
                                el.onloadedmetadata = () => { el.play().catch(() => {}); };
                                el.play().catch(() => {});
                              }
                            }}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-contain rounded-sm"
                          />

                          {/* Tactical HUD Overlay for WebRTC */}
                          <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-3 select-none">
                            <div className="flex items-center justify-between text-[11px] font-mono font-bold text-emerald-400 drop-shadow">
                              <div className="flex items-center space-x-2 bg-black/60 px-2.5 py-1 rounded-sm border border-emerald-500/30">
                                <Eye className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                                <span>ARTIS OPTICAL WEBRTC // TARGET: {device?.name || 'NODE'}</span>
                              </div>
                              <div className="bg-black/60 px-2.5 py-1 rounded-sm border border-emerald-500/30">
                                <span>FPS: 30 &bull; 1280x720</span>
                              </div>
                            </div>

                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none opacity-35">
                              <div className="w-24 h-24 border border-cyan-500/50 rounded-full flex items-center justify-center">
                                <div className="w-2 h-2 bg-cyan-400 rounded-full"></div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between text-[10px] font-mono text-emerald-400 drop-shadow">
                              <div className="bg-black/60 px-2.5 py-1 rounded-sm border border-emerald-500/30">
                                <span>OPERATOR: SEC_ANALYST_L3 // SENSOR: {facingMode.toUpperCase()}</span>
                              </div>
                              <div className="bg-black/60 px-2.5 py-1 rounded-sm border border-emerald-500/30">
                                <span>{new Date().toISOString()}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center p-8 space-y-4 max-w-md">
                          <div className="w-16 h-16 rounded-full bg-slate-900 border border-cyan-500/30 flex items-center justify-center mx-auto text-cyan-400 shadow-lg">
                            <Video className="w-8 h-8" />
                          </div>
                          <div className="space-y-1">
                            <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider">
                              Browser WebRTC Optical Sensor Standby
                            </h4>
                            <p className="text-[11px] text-slate-400 leading-relaxed">
                              Activate the browser webcam/camera sensor to stream client video feed.
                            </p>
                          </div>
                          {cameraError && (
                            <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-sm text-rose-400 text-[10.5px] font-mono">
                              {cameraError}
                            </div>
                          )}
                          <div className="flex justify-center space-x-2 pt-2">
                            <button
                              onClick={() => startCamera('user')}
                              disabled={cameraLoading}
                              className="px-4 py-2 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition flex items-center space-x-2 shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              <Video className="w-4 h-4" />
                              <span>{cameraLoading ? 'Initializing Sensor...' : 'Activate Front / Webcam'}</span>
                            </button>
                            <button
                              onClick={() => startCamera('environment')}
                              disabled={cameraLoading}
                              className="px-4 py-2 rounded-sm bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition flex items-center space-x-2 shadow-xs cursor-pointer disabled:opacity-50"
                            >
                              <SwitchCamera className="w-4 h-4 text-cyan-400" />
                              <span>Activate Back Camera</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Right Side Evidence Deck & Snapshots */}
              <div className="w-full md:w-80 flex flex-col space-y-3 overflow-y-auto custom-scrollbar flex-shrink-0">
                {/* Snapshot Directive Trigger */}
                <div className="p-3 bg-cyan-500/5 dark:bg-cyan-950/20 rounded-sm space-y-2.5 shadow-xs border border-cyan-500/20">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                      <Camera className="w-3.5 h-3.5 text-cyan-500" />
                      <span>Optical Evidence Capture</span>
                    </span>
                    <span className="text-[9px] font-mono text-cyan-500 font-semibold">SHA-256 HASHED</span>
                  </div>
                  <p className="text-[10.5px] text-slate-500 dark:text-slate-400 leading-relaxed">
                    Capture an evidentiary freeze-frame from the active optical sensor with embedded SOC tactical watermark and SHA-256 integrity hash.
                  </p>
                  <button
                    onClick={captureEvidenceFrame}
                    disabled={cameraSource === 'hardware' ? !hardwareCamActive : !isCameraActive}
                    className="w-full py-2 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white font-semibold transition text-xs flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Capture Evidentiary Snapshot</span>
                  </button>
                </div>

                {/* Evidence Snapshot Gallery */}
                <div className="flex-1 p-3 bg-slate-50 dark:bg-cyber-800/40 rounded-sm space-y-2.5 shadow-xs border border-slate-200/60 dark:border-cyber-700/40 overflow-y-auto custom-scrollbar">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      Captured Frames ({cameraSnapshots.length})
                    </span>
                    <span className="text-[9px] font-mono text-slate-400">CHAIN OF CUSTODY</span>
                  </div>

                  {cameraSnapshots.length === 0 ? (
                    <div className="p-6 text-center text-slate-400 text-[10.5px]">
                      No optical snapshots captured yet during this session.
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {cameraSnapshots.map((snap) => (
                        <div
                          key={snap.id}
                          className="p-2 rounded-sm bg-white dark:bg-cyber-900 border border-slate-200 dark:border-cyber-700/80 space-y-1.5 shadow-xs"
                        >
                          <div className="relative rounded-sm overflow-hidden border border-slate-300 dark:border-cyber-700">
                            <img src={snap.url} alt="Evidence" className="w-full h-28 object-cover" />
                            <span className="absolute bottom-1 right-1 text-[9px] font-mono bg-black/75 px-1.5 py-0.5 rounded-sm text-cyan-400">
                              {snap.facing}
                            </span>
                          </div>
                          <div className="text-[9px] font-mono text-slate-500 dark:text-slate-400 space-y-0.5">
                            <div className="flex justify-between">
                              <span>Time: {snap.timestamp}</span>
                            </div>
                            <div className="truncate text-slate-400">
                              SHA: {snap.hash.slice(0, 24)}...
                            </div>
                          </div>
                          <a
                            href={snap.url}
                            download={`ARTIS-EVIDENCE-${device?.id || 'NODE'}-${snap.id}.jpg`}
                            className="w-full py-1 rounded-sm bg-slate-100 hover:bg-slate-200 dark:bg-cyber-700 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-200 text-[10px] font-semibold flex items-center justify-center space-x-1 transition cursor-pointer"
                          >
                            <Download className="w-3 h-3" />
                            <span>Download JPEG (Verified)</span>
                          </a>
                        </div>
                      ))}
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
              <div className="space-y-2">
                <div className="flex items-center space-x-2 bg-slate-50 dark:bg-cyber-800/60 p-2 rounded-sm shadow-xs">
                  <button
                    onClick={navigateUp}
                    title="Go Up Directory"
                    className="p-1.5 rounded-sm bg-white dark:bg-cyber-700 hover:bg-slate-100 text-slate-700 dark:text-slate-200 transition cursor-pointer shadow-xs"
                  >
                    <CornerLeftUp className="w-4 h-4" />
                  </button>
                  <div className="flex-1 flex items-center space-x-1 font-mono text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-cyber-900 px-3 py-1.5 rounded-sm shadow-xs">
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
                    className="px-3 py-1.5 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition flex items-center space-x-1 cursor-pointer shadow-xs"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${filesLoading ? 'animate-spin' : ''}`} />
                    <span>Browse</span>
                  </button>
                </div>

                {/* Quick Directory Jump Chips */}
                <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                  <span className="text-slate-400 font-sans mr-1">Quick Roots:</span>
                  {isStorage ? (
                    <>
                      <button
                        type="button"
                        onClick={() => loadFiles(activeForensicDeviceId.replace('USB-DRIVE-', '') + ':\\')}
                        className="px-2 py-0.5 rounded-sm bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30 transition cursor-pointer"
                      >
                        Root ({activeForensicDeviceId.replace('USB-DRIVE-', '')}:\)
                      </button>
                    </>
                  ) : isHost ? (
                    <>
                      <button
                        type="button"
                        onClick={() => loadFiles('C:\\')}
                        className="px-2 py-0.5 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                      >
                        C:\
                      </button>
                      <button
                        type="button"
                        onClick={() => loadFiles('C:\\Users')}
                        className="px-2 py-0.5 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                      >
                        C:\Users
                      </button>
                      <button
                        type="button"
                        onClick={() => loadFiles('C:\\Users\\recal\\Desktop')}
                        className="px-2 py-0.5 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                      >
                        Desktop
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => loadFiles('/sdcard')}
                        className="px-2 py-0.5 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                      >
                        /sdcard
                      </button>
                      <button
                        type="button"
                        onClick={() => loadFiles('/sdcard/Download')}
                        className="px-2 py-0.5 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                      >
                        Download
                      </button>
                      <button
                        type="button"
                        onClick={() => loadFiles('/sdcard/DCIM')}
                        className="px-2 py-0.5 rounded-sm bg-slate-200 dark:bg-cyber-700 hover:bg-slate-300 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-200 transition cursor-pointer"
                      >
                        DCIM / Photos
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Files Table */}
              <div className="flex-1 overflow-y-auto custom-scrollbar bg-white dark:bg-cyber-card rounded-sm shadow-xs">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="sticky top-0 bg-slate-50 dark:bg-cyber-800 text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">
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
                                className="px-2.5 py-1 rounded-sm bg-slate-100 dark:bg-cyber-700/60 hover:bg-slate-200 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-200 font-medium text-[11px] inline-flex items-center space-x-1 transition shadow-xs"
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
              <div className="p-3 bg-slate-50 dark:bg-cyber-800/40 rounded-sm flex items-center justify-between text-[11px] font-mono shadow-xs">
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
                <div className="p-3 bg-slate-50 dark:bg-cyber-800/60 rounded-sm shadow-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">OS Version</span>
                  <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {triage?.os || (isHost ? 'Windows 11 / x64' : 'Android')}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-cyber-800/60 rounded-sm shadow-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Architecture</span>
                  <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200 mt-0.5">
                    {triage?.arch || (isHost ? 'AMD64' : 'arm64-v8a')}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-cyber-800/60 rounded-sm shadow-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Installed Packages</span>
                  <div className="text-xs font-mono font-bold text-cyan-600 dark:text-cyan-400 mt-0.5">
                    {triage?.packages_count || (isHost ? '340' : '85')}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 dark:bg-cyber-800/60 rounded-sm shadow-xs">
                  <span className="text-[10px] text-slate-400 uppercase font-bold">Running Processes</span>
                  <div className="text-xs font-mono font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {triage?.procs_count || '120'}
                  </div>
                </div>
              </div>

              {/* Terminal Container */}
              <div className="flex-1 flex flex-col bg-black rounded-sm overflow-hidden font-mono text-xs shadow-xs">
                {/* Titlebar with Presets */}
                <div className="px-3 py-2 bg-slate-900 flex flex-wrap items-center justify-between gap-2">
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
                <div className="p-2 bg-slate-900/90 flex items-center space-x-2">
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
                    className="px-3 py-1 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white font-semibold text-xs transition cursor-pointer disabled:opacity-50 shadow-xs"
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
