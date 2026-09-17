import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, Ban, RefreshCw, Camera, Terminal, Laptop } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { DeviceDetailResponse } from '../../types';
import { Button } from '../common/Button';
import { StatusBadge } from '../common/Badge';

export const DeviceModal: React.FC = () => {
  const { activeDeviceId, closeDeviceDetail, openKillProcess, alert } = useModals();
  const [data, setData] = useState<DeviceDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'processes' | 'browser' | 'clipboard' | 'print'>('processes');
  const [isActionPending, setIsActionPending] = useState(false);

  useEffect(() => {
    if (!activeDeviceId) {
      setData(null);
      return;
    }
    setLoading(true);
    api.getDeviceDetail(activeDeviceId)
      .then(setData)
      .catch((err) => {
        console.error('Failed to load device details:', err);
        alert({ title: 'Error', message: 'Failed to fetch telemetry details for target node.', type: 'danger' });
      })
      .finally(() => setLoading(false));
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
      const updated = await api.getDeviceDetail(device.id);
      setData(updated);
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

  const recentEvents = data?.recent_events || [];

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700 rounded-sm w-full max-w-4xl max-h-[88vh] flex flex-col shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-cyber-700/60 flex items-center justify-between bg-slate-50/50 dark:bg-cyber-800/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black">
              <Laptop className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {device ? `${device.hostname} — Telemetry Inspector` : 'Connecting Node...'}
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5">
                {device ? `OS: ${device.os_type} | User: ${device.current_user || 'system'} | Branch: ${device.branch_name}` : 'Querying real-time device posture...'}
              </p>
            </div>
          </div>
          <button
            onClick={closeDeviceDetail}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1 rounded-sm transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* SOC Remediation Directives Strip */}
        {device && (
          <div className="px-6 py-2.5 bg-slate-50 dark:bg-cyber-800/50 border-b border-slate-200 dark:border-cyber-700/60 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-slate-400">Node State:</span>
              <StatusBadge status={device.status} />
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
                <X className="w-3.5 h-3.5 mr-1.5" />
                <span>Kill Process</span>
              </Button>
            </div>
          </div>
        )}

        {/* Telemetry Tabs */}
        <div className="px-6 pt-3 border-b border-slate-200 dark:border-cyber-700/60 flex space-x-4 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('processes')}
            className={`pb-2 border-b-2 transition ${
              activeTab === 'processes'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Processes
          </button>
          <button
            onClick={() => setActiveTab('browser')}
            className={`pb-2 border-b-2 transition ${
              activeTab === 'browser'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Web History
          </button>
          <button
            onClick={() => setActiveTab('clipboard')}
            className={`pb-2 border-b-2 transition ${
              activeTab === 'clipboard'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Clipboard Sync
          </button>
          <button
            onClick={() => setActiveTab('print')}
            className={`pb-2 border-b-2 transition ${
              activeTab === 'print'
                ? 'border-slate-900 dark:border-white text-slate-900 dark:text-white font-bold'
                : 'border-transparent text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            Print Logs
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
          ) : (
            <div className="space-y-2">
              {recentEvents.length === 0 ? (
                <div className="text-center py-12 text-slate-400">
                  No telemetry logged for this event type yet.
                </div>
              ) : (
                recentEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="p-3 bg-slate-50 dark:bg-cyber-800/50 border border-slate-200 dark:border-cyber-700/50 rounded-sm flex items-center justify-between"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-mono font-bold text-slate-900 dark:text-white text-[11px]">
                          {evt.event_type}
                        </span>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(evt.timestamp).toLocaleString()}
                        </span>
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
