import React, { useState, useEffect } from 'react';
import { X, Ban, RefreshCw, Camera, Monitor, Terminal, Globe, Paperclip, Printer, History, CheckCircle2, Clock, AlertCircle } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { DeviceDetailResponse, DeviceCommand } from '../../types';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/Badge';

type TabType = 'all' | 'processes' | 'browser' | 'clipboard' | 'print' | 'commands';

export const DeviceModal: React.FC = () => {
  const { activeDeviceId, closeDeviceDetail, openKillProcess, alert } = useModals();
  const [data, setData] = useState<DeviceDetailResponse | null>(null);
  const [commands, setCommands] = useState<DeviceCommand[]>([]);
  const [loading, setLoading] = useState(false);
  const [commandsLoading, setCommandsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isActionPending, setIsActionPending] = useState(false);
  const [isCameraPending, setIsCameraPending] = useState(false);

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

  useEffect(() => {
    if (!activeDeviceId) {
      setData(null);
      setCommands([]);
      return;
    }
    fetchDeviceData(activeDeviceId);
    fetchCommandsData(activeDeviceId);
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
      <div className="bg-white dark:bg-cyber-card rounded-sm w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-xs">
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
              onClick={closeDeviceDetail}
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
                isLoading={isCameraPending}
                onClick={handleCameraSnapshot}
              >
                <Camera className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                <span>Camera Evidence</span>
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
