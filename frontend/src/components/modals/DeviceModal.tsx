import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Ban,
  RefreshCw,
  Camera,
  CameraOff,
  Monitor,
  Terminal,
  Globe,
  Paperclip,
  Printer,
  History,
  CheckCircle2,
  Clock,
  AlertCircle,
  SwitchCamera,
  Aperture,
  Download,
  User,
  ShieldCheck,
  Video,
  Microscope
} from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { DeviceDetailResponse, DeviceCommand } from '../../types';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/Badge';
import { DeviceForensicBadge } from '../common/DeviceForensicBadge';

type TabType = 'all' | 'camera' | 'processes' | 'browser' | 'clipboard' | 'print' | 'commands';

interface CapturedFrame {
  id: string;
  url: string;
  timestamp: string;
  facingMode: string;
  deviceHostname: string;
}

export const DeviceModal: React.FC = () => {
  const { activeDeviceId, closeDeviceDetail, openKillProcess, openForensicStudio, alert } = useModals();
  const [data, setData] = useState<DeviceDetailResponse | null>(null);
  const [commands, setCommands] = useState<DeviceCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isActionPending, setIsActionPending] = useState(false);
  const [isCameraPending, setIsCameraPending] = useState(false);

  // Live Optical Feed State
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState<CapturedFrame[]>([]);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [hudTime, setHudTime] = useState(new Date().toLocaleTimeString());

  // HUD clock timer
  useEffect(() => {
    const timer = setInterval(() => {
      setHudTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const fetchDeviceData = async (deviceId: string) => {
    setLoading(true);
    try {
      const detail = await api.getDeviceDetail(deviceId);
      setData(detail);
    } catch (err: any) {
      console.error('Failed to load device details:', err);
      alert({ title: 'Error', message: 'Failed to fetch telemetry details for target node.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const fetchCommandsData = async (deviceId: string) => {
    setCommandsLoading(true);
    try {
      const cmds = await api.getDeviceCommands(deviceId, 30);
      setCommands(cmds);
    } catch (err: any) {
      console.error('Failed to load device commands:', err);
    } finally {
      setCommandsLoading(false);
    }
  };

  // Stop camera tracks cleanly
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
    setCameraLoading(false);
  };

  // Start front or back camera
  const startCamera = async (mode: 'user' | 'environment') => {
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
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
      }

      setIsCameraActive(true);
      setFacingMode(mode);
    } catch (err: any) {
      console.error('Failed to start optical camera sensor:', err);
      setCameraError(err.message || 'Camera access denied or device not found.');
      setIsCameraActive(false);
    } finally {
      setCameraLoading(false);
    }
  };

  // Take verification snapshot from active feed
  const captureVerificationFrame = () => {
    if (!videoRef.current || !isCameraActive) return;

    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw video frame
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Tactical HUD watermark
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, canvas.height - 40, canvas.width, 40);

    ctx.fillStyle = '#00FF66';
    ctx.font = '14px monospace';
    const timestampStr = new Date().toISOString();
    const tag = `ARGUS SOC VERIFICATION | NODE: ${device?.hostname || 'UNKNOWN'} | USER: ${device?.current_user || 'SYSTEM'} | ${timestampStr}`;
    ctx.fillText(tag, 16, canvas.height - 15);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
    const newFrame: CapturedFrame = {
      id: String(Date.now()),
      url: dataUrl,
      timestamp: new Date().toLocaleTimeString(),
      facingMode: facingMode === 'user' ? 'Front / Webcam' : 'Back Camera',
      deviceHostname: device?.hostname || 'Node'
    };

    setCapturedFrames((prev) => [newFrame, ...prev]);

    // Upload to backend snapshot archive if possible
    try {
      canvas.toBlob((blob) => {
        if (blob && device) {
          const formData = new FormData();
          formData.append('device_id', device.id);
          formData.append('reason', `Analyst Live Verification Snapshot (${newFrame.facingMode})`);
          formData.append('file', blob, `live_capture_${Date.now()}.jpg`);
          fetch('/api/v1/telemetry/snapshot', { method: 'POST', body: formData }).catch(() => {});
        }
      }, 'image/jpeg', 0.88);
    } catch {}

    alert({
      title: 'Optical Evidence Archived',
      message: `Verification snapshot captured from ${newFrame.facingMode}.`,
      type: 'success'
    });
  };

  useEffect(() => {
    if (!activeDeviceId) {
      setData(null);
      setCommands([]);
      setCapturedFrames([]);
      stopCameraStream();
      return;
    }
    fetchDeviceData(activeDeviceId);
    fetchCommandsData(activeDeviceId);

    return () => {
      stopCameraStream();
    };
  }, [activeDeviceId]);

  if (!activeDeviceId) return null;

  const device = data?.device;
  const isQuarantined = device?.status === 'QUARANTINED';

  const handleQuarantineToggle = async () => {
    if (!device) return;
    setIsActionPending(true);
    try {
      const action = isQuarantined ? 'RESTORE_NETWORK' : 'ISOLATE_NETWORK';
      await api.dispatchDeviceCommand(device.id, action);
      await fetchDeviceData(device.id);
      await fetchCommandsData(device.id);
      alert({
        title: isQuarantined ? 'Network Restored' : 'Host Quarantined',
        message: isQuarantined ? 'Endpoint network connectivity has been restored.' : 'Host isolated from corporate network.',
        type: isQuarantined ? 'success' : 'warning'
      });
    } catch (e: any) {
      alert({ title: 'Directive Error', message: e.message || 'Failed to dispatch quarantine directive.', type: 'danger' });
    } finally {
      setIsActionPending(false);
    }
  };

  const handleCameraSnapshot = async () => {
    if (!device) return;
    setIsCameraPending(true);
    try {
      await api.dispatchDeviceCommand(device.id, 'CAPTURE_CAMERA_SNAPSHOT', { quality: 'high', reason: 'Analyst SOC live inspection' });
      await fetchCommandsData(device.id);
      alert({
        title: 'Directive Dispatched',
        message: 'Camera evidence capture directive sent to endpoint agent.',
        type: 'success'
      });
    } catch (e: any) {
      alert({ title: 'Directive Error', message: e.message || 'Failed to dispatch camera capture directive.', type: 'danger' });
    } finally {
      setIsCameraPending(false);
    }
  };

  const handleRefresh = async () => {
    if (!device) return;
    await Promise.all([fetchDeviceData(device.id), fetchCommandsData(device.id)]);
  };

  const allEvents = data?.recent_events || [];

  const filteredEvents = allEvents.filter((evt) => {
    if (activeTab === 'all') return true;
    const type = evt.event_type.toUpperCase();
    if (activeTab === 'processes') return type.includes('PROCESS');
    if (activeTab === 'browser') return type.includes('BROWSER') || type.includes('URL') || type.includes('WEB');
    if (activeTab === 'clipboard') return type.includes('CLIPBOARD');
    if (activeTab === 'print') return type.includes('PRINT');
    return true;
  });

  const getCommandStatusBadge = (status: string) => {
    const s = status.toUpperCase();
    if (s === 'COMPLETED') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm bg-emerald-500/10 text-emerald-500 font-mono text-[10px] font-semibold">
          <CheckCircle2 className="w-3 h-3" />
          <span>COMPLETED</span>
        </span>
      );
    }
    if (s === 'FAILED') {
      return (
        <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm bg-rose-500/10 text-rose-500 font-mono text-[10px] font-semibold">
          <AlertCircle className="w-3 h-3" />
          <span>FAILED</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm bg-amber-500/10 text-amber-500 font-mono text-[10px] font-semibold">
        <Clock className="w-3 h-3" />
        <span>PENDING</span>
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card rounded-sm w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-xs">
        {/* Hidden Canvas for Frame Capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-cyber-800/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black shadow-xs">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                  {device ? `${device.hostname} — Telemetry Inspector` : 'Connecting Node...'}
                </h3>
                {device && (
                  <span className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold ${
                    device.risk_score >= 80
                      ? 'bg-rose-500/10 text-rose-500'
                      : device.risk_score >= 50
                      ? 'bg-amber-500/10 text-amber-500'
                      : 'bg-emerald-500/10 text-emerald-500'
                  }`}>
                    Risk: {device.risk_score}/100
                  </span>
                )}
                <DeviceForensicBadge variant="ready" deviceId={device?.id} />
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {device
                  ? `IP: ${device.ip_address || '127.0.0.1'} | OS: ${device.os_type} | User: ${device.current_user || 'system'} | Branch: ${device.branch_name}`
                  : 'Querying real-time device posture...'}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-sm hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition cursor-pointer"
              title="Refresh Telemetry & Directives"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            </button>
            <button
              onClick={() => {
                stopCameraStream();
                closeDeviceDetail();
              }}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-sm hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* SOC Remediation Directives Strip */}
        {device && (
          <div className="px-6 py-2.5 bg-slate-50 dark:bg-cyber-800/50 flex flex-wrap items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400">Node State:</span>
              <StatusBadge status={device.status} />
              <span className="text-[10px] font-mono text-slate-400 ml-2">
                Last seen: {new Date(device.last_seen).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Quick Jump to Optical Feed */}
              <Button
                size="sm"
                variant={activeTab === 'camera' ? 'primary' : 'secondary'}
                onClick={() => {
                  setActiveTab('camera');
                  if (!isCameraActive) startCamera('user');
                }}
              >
                <Camera className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                <span>Live Optical Feed</span>
              </Button>
              <Button
                size="sm"
                variant={isQuarantined ? 'secondary' : 'primary'}
                isLoading={isActionPending}
                onClick={handleQuarantineToggle}
              >
                <Ban className="w-3.5 h-3.5 mr-1.5" />
                <span>{isQuarantined ? 'Restore Network' : 'Quarantine Host'}</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => openKillProcess(device.id)}
              >
                <Terminal className="w-3.5 h-3.5 mr-1.5 text-rose-500" />
                <span>Kill Process</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  stopCameraStream();
                  closeDeviceDetail();
                  openForensicStudio(device.id);
                }}
                title="Open Digital Forensics Studio & Visual Bridge"
              >
                <Microscope className="w-3.5 h-3.5 mr-1.5 text-cyan-500" />
                <span>Forensics Bridge</span>
              </Button>
              <Button
                size="sm"
                variant="secondary"
                isLoading={isCameraPending}
                onClick={handleCameraSnapshot}
              >
                <Aperture className="w-3.5 h-3.5 mr-1.5 text-amber-500" />
                <span>Agent Hardware Snapshot</span>
              </Button>
            </div>
          </div>
        )}

        {/* Telemetry & Directives Tabs */}
        <div className="px-6 pt-3 flex flex-wrap gap-1.5 text-xs font-semibold bg-slate-50/30 dark:bg-cyber-800/20">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-sm transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'all'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/40'
            }`}
          >
            <span>All Events</span>
            <span className="text-[10px] font-mono opacity-80">({allEvents.length})</span>
          </button>

          {/* Live Optical Feed Tab */}
          <button
            onClick={() => {
              setActiveTab('camera');
              if (!isCameraActive) startCamera('user');
            }}
            className={`px-3 py-1.5 rounded-sm transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'camera'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/40'
            }`}
          >
            <Camera className="w-3.5 h-3.5 text-blue-500" />
            <span>Live Optical Feed</span>
            {isCameraActive && (
              <span className="h-2 w-2 rounded-full bg-rose-500 animate-pulse"></span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('processes')}
            className={`px-3 py-1.5 rounded-sm transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'processes'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/40'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Processes</span>
          </button>
          <button
            onClick={() => setActiveTab('browser')}
            className={`px-3 py-1.5 rounded-sm transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'browser'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/40'
            }`}
          >
            <Globe className="w-3.5 h-3.5" />
            <span>Web History</span>
          </button>
          <button
            onClick={() => setActiveTab('clipboard')}
            className={`px-3 py-1.5 rounded-sm transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'clipboard'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/40'
            }`}
          >
            <Paperclip className="w-3.5 h-3.5" />
            <span>Clipboard Sync</span>
          </button>
          <button
            onClick={() => setActiveTab('print')}
            className={`px-3 py-1.5 rounded-sm transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'print'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/40'
            }`}
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Logs</span>
          </button>
          <button
            onClick={() => setActiveTab('commands')}
            className={`px-3 py-1.5 rounded-sm transition cursor-pointer flex items-center space-x-1.5 ${
              activeTab === 'commands'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                : 'text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/40'
            }`}
          >
            <History className="w-3.5 h-3.5" />
            <span>Directives Audit</span>
            <span className="text-[10px] font-mono opacity-80">({commands.length})</span>
          </button>
        </div>

        {/* Tab Content */}
        <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-3 bg-slate-100 dark:bg-cyber-800/40 rounded-sm animate-pulse space-y-2">
                  <div className="h-4 w-1/3 bg-slate-200 dark:bg-cyber-700/60 rounded-sm"></div>
                  <div className="h-3 w-3/4 bg-slate-200 dark:bg-cyber-700/40 rounded-sm"></div>
                </div>
              ))}
            </div>
          ) : activeTab === 'camera' ? (
            /* Live Optical Feed & Verification Deck */
            <div className="space-y-4">
              {/* Optical Controls Toolbar */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-3 bg-slate-50 dark:bg-cyber-800/50 rounded-sm shadow-xs">
                <div className="flex items-center space-x-2">
                  <span className="text-[11px] font-mono uppercase font-bold text-slate-400">Sensor Control:</span>
                  {isCameraActive ? (
                    <span className="inline-flex items-center space-x-1.5 px-2 py-0.5 rounded-sm bg-rose-500/10 text-rose-500 text-[10px] font-mono font-bold">
                      <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
                      <span>LIVE FEED ACTIVE</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm bg-slate-200 dark:bg-cyber-700 text-slate-500 text-[10px] font-mono">
                      <span>STANDBY</span>
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {/* Front / PC Webcam Sensor Switch */}
                  <button
                    onClick={() => startCamera('user')}
                    disabled={cameraLoading}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-xs ${
                      isCameraActive && facingMode === 'user'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-xs font-bold'
                        : 'bg-white dark:bg-cyber-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-600'
                    }`}
                    title="Activate Front Camera / PC Webcam to inspect operator"
                  >
                    <User className="w-3.5 h-3.5" />
                    <span>Front / Webcam</span>
                  </button>

                  {/* Back Camera Sensor Switch */}
                  <button
                    onClick={() => startCamera('environment')}
                    disabled={cameraLoading}
                    className={`px-3 py-1.5 rounded-sm text-xs font-semibold flex items-center space-x-1.5 transition cursor-pointer shadow-xs ${
                      isCameraActive && facingMode === 'environment'
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-xs font-bold'
                        : 'bg-white dark:bg-cyber-700/60 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-600'
                    }`}
                    title="Activate Back / External Environment Camera"
                  >
                    <SwitchCamera className="w-3.5 h-3.5" />
                    <span>Back Camera</span>
                  </button>

                  {/* Capture Frame */}
                  {isCameraActive && (
                    <button
                      onClick={captureVerificationFrame}
                      className="px-3 py-1.5 rounded-sm bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                      title="Capture timestamped verification frame"
                    >
                      <Aperture className="w-3.5 h-3.5" />
                      <span>Capture Frame</span>
                    </button>
                  )}

                  {/* Stop Sensor */}
                  {isCameraActive && (
                    <button
                      onClick={stopCameraStream}
                      className="px-3 py-1.5 rounded-sm bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 font-semibold text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                      title="Deactivate camera stream"
                    >
                      <CameraOff className="w-3.5 h-3.5" />
                      <span>Stop Stream</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Video Viewport Stage */}
              <div className="relative aspect-video max-h-[380px] w-full bg-slate-950 rounded-sm overflow-hidden flex items-center justify-center shadow-lg border border-slate-900">
                {/* Real Video Element */}
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className={`w-full h-full object-cover transition-opacity duration-300 ${
                    isCameraActive ? 'opacity-100' : 'opacity-0 absolute'
                  }`}
                />

                {/* Standby Placeholder Screen */}
                {!isCameraActive && (
                  <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 z-10">
                    <div className="p-4 rounded-sm bg-slate-900/80 border border-slate-800 text-slate-400">
                      <Camera className="w-10 h-10" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-white tracking-wide uppercase font-mono">
                        Optical Verification Sensor Standby
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm mt-1">
                        Activate the front webcam or back camera feed to verify who is physically operating endpoint node{' '}
                        <strong className="text-white">{device?.hostname}</strong>.
                      </p>
                    </div>
                    {cameraError && (
                      <div className="p-2.5 rounded-sm bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-mono max-w-md">
                        {cameraError}
                      </div>
                    )}
                    <div className="flex items-center space-x-3 pt-1">
                      <Button
                        variant="primary"
                        size="sm"
                        isLoading={cameraLoading}
                        onClick={() => startCamera('user')}
                      >
                        <User className="w-3.5 h-3.5 mr-1.5" />
                        <span>Activate Front / Webcam</span>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        isLoading={cameraLoading}
                        onClick={() => startCamera('environment')}
                      >
                        <SwitchCamera className="w-3.5 h-3.5 mr-1.5" />
                        <span>Activate Back Camera</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* Tactical HUD Overlay (Visible when camera is active) */}
                {isCameraActive && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 font-mono">
                    {/* Top HUD */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2 bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-sm border border-emerald-500/30">
                        <span className="h-2 w-2 rounded-full bg-rose-500 animate-ping"></span>
                        <span className="text-[10px] text-emerald-400 font-bold tracking-wider">OPTICAL LINK ESTABLISHED</span>
                      </div>
                      <div className="bg-black/60 backdrop-blur-xs px-2.5 py-1 rounded-sm border border-slate-700 text-[10px] text-slate-300">
                        SENSOR: <span className="text-white font-bold">{facingMode === 'user' ? 'FRONT / WEBCAM' : 'BACK CAMERA'}</span>
                      </div>
                    </div>

                    {/* Center Targeting Reticle */}
                    <div className="self-center flex items-center justify-center">
                      <div className="w-20 h-20 border border-emerald-500/40 rounded-sm flex items-center justify-center relative">
                        <div className="w-2 h-2 rounded-full bg-emerald-500/70"></div>
                        {/* Reticle ticks */}
                        <div className="absolute -top-2 left-1/2 -translate-x-1/2 w-0.5 h-1.5 bg-emerald-500/50"></div>
                        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-0.5 h-1.5 bg-emerald-500/50"></div>
                        <div className="absolute -left-2 top-1/2 -translate-y-1/2 w-1.5 h-0.5 bg-emerald-500/50"></div>
                        <div className="absolute -right-2 top-1/2 -translate-y-1/2 w-1.5 h-0.5 bg-emerald-500/50"></div>
                      </div>
                    </div>

                    {/* Bottom HUD */}
                    <div className="flex items-center justify-between bg-black/70 backdrop-blur-xs px-3 py-1.5 rounded-sm border border-slate-800 text-[10px]">
                      <div className="flex items-center space-x-3 text-slate-300">
                        <span>NODE: <strong className="text-white">{device?.hostname}</strong></span>
                        <span>OPERATOR: <strong className="text-emerald-400">{device?.current_user || 'analyst'}</strong></span>
                      </div>
                      <div className="text-slate-400">
                        UTC: {hudTime}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Captured Verification Frames Gallery */}
              {capturedFrames.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="flex items-center justify-between">
                    <h5 className="text-xs font-mono font-bold uppercase tracking-wider text-slate-900 dark:text-white flex items-center space-x-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Physical Identity Evidence Log ({capturedFrames.length})</span>
                    </h5>
                    <span className="text-[10px] font-mono text-slate-400">Cryptographically watermarked frames</span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {capturedFrames.map((frame) => (
                      <div
                        key={frame.id}
                        className="bg-slate-50 dark:bg-cyber-800/60 p-2 rounded-sm shadow-xs space-y-1.5 group"
                      >
                        <div className="aspect-video bg-black rounded-sm overflow-hidden relative">
                          <img
                            src={frame.url}
                            alt="Verification Snapshot"
                            className="w-full h-full object-cover"
                          />
                          <a
                            href={frame.url}
                            download={`verification_${frame.deviceHostname}_${frame.id}.jpg`}
                            className="absolute bottom-1.5 right-1.5 p-1 rounded-sm bg-black/70 hover:bg-black text-white transition opacity-0 group-hover:opacity-100 cursor-pointer"
                            title="Download Evidence Frame"
                          >
                            <Download className="w-3 h-3" />
                          </a>
                        </div>
                        <div className="flex items-center justify-between text-[9.5px] font-mono text-slate-400">
                          <span>{frame.facingMode}</span>
                          <span>{frame.timestamp}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'commands' ? (
            commandsLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="p-3 bg-slate-100 dark:bg-cyber-800/40 rounded-sm animate-pulse space-y-2">
                    <div className="h-4 w-1/4 bg-slate-200 dark:bg-cyber-700/60 rounded-sm"></div>
                  </div>
                ))}
              </div>
            ) : commands.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-sans">
                No remediation directives have been dispatched to this endpoint yet.
              </div>
            ) : (
              <div className="space-y-2.5">
                {commands.map((cmd) => (
                  <div
                    key={cmd.id}
                    className="p-3.5 bg-slate-50 dark:bg-cyber-800/50 rounded-sm shadow-xs flex flex-col space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2.5">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-xs">
                          {cmd.command_type}
                        </span>
                        {getCommandStatusBadge(cmd.status)}
                      </div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {new Date(cmd.created_at).toLocaleString()}
                      </div>
                    </div>
                    {cmd.parameters && Object.keys(cmd.parameters).length > 0 && (
                      <div className="text-[11px] font-mono bg-slate-100/70 dark:bg-cyber-900/60 p-2 rounded-sm text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400 font-bold block mb-0.5">Parameters:</span>
                        <pre className="whitespace-pre-wrap break-all text-[10.5px]">
                          {JSON.stringify(cmd.parameters, null, 2)}
                        </pre>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 pt-1">
                      <span>Issued by: <strong className="text-slate-600 dark:text-slate-300">{cmd.issued_by}</strong></span>
                      {cmd.result_summary && (
                        <span>Summary: <strong className="text-slate-600 dark:text-slate-300">{cmd.result_summary}</strong></span>
                      )}
                      {cmd.executed_at && (
                        <span>Executed: {new Date(cmd.executed_at).toLocaleTimeString()}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="space-y-2">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-12 text-slate-400 font-sans">
                  No telemetry logged for this category yet.
                </div>
              ) : (
                filteredEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 bg-slate-50 dark:bg-cyber-800/50 rounded-sm flex items-start justify-between shadow-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                          {evt.event_type}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
                        {evt.severity && (
                          <span className={`text-[9px] font-mono font-bold px-1.5 py-0.2 rounded-sm ${
                            evt.severity === 'CRITICAL' ? 'bg-rose-500/10 text-rose-500' : 'bg-slate-200 dark:bg-cyber-700 text-slate-500'
                          }`}>
                            {evt.severity}
                          </span>
                        )}
                      </div>
                      <pre className="text-[11px] font-mono text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-wrap break-all">
                        {JSON.stringify(evt.payload, null, 2)}
                      </pre>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
