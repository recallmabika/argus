import React, { useState, useEffect } from 'react';
import { X, ClipboardList, RefreshCw, Shield } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { AuditEntry } from '../../types';

export const AuditDrawer: React.FC = () => {
  const { isAuditOpen, closeAudit } = useModals();
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLogs = () => {
    setLoading(true);
    api.getAuditLogs(50)
      .then(setLogs)
      .catch((err) => console.error('Failed to load audit logs:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (isAuditOpen) {
      fetchLogs();
    }
  }, [isAuditOpen]);

  if (!isAuditOpen) return null;

  return (
    <div className="fixed inset-0 z-[85] overflow-hidden">
      {/* Backdrop */}
      <div onClick={closeAudit} className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity" />

      {/* Drawer Panel */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
        <div className="w-screen max-w-md bg-white dark:bg-cyber-card border-l border-slate-200 dark:border-cyber-700 shadow-2xl flex flex-col text-xs">
          {/* Header */}
          <div className="px-5 py-4 border-b border-slate-200 dark:border-cyber-700/60 flex items-center justify-between bg-slate-50/50 dark:bg-cyber-800/30">
            <div className="flex items-center space-x-2.5">
              <ClipboardList className="w-4 h-4 text-slate-500" />
              <div>
                <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Access &amp; Action Audit Trail
                </h3>
                <p className="text-[10px] text-slate-400">Cryptographic non-repudiation log</p>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={fetchLogs}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
                title="Refresh logs"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={closeAudit}
                className="p-1 rounded text-slate-400 hover:text-slate-600 dark:hover:text-white transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Entries List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-2.5">
            {loading && logs.length === 0 ? (
              <div className="space-y-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="p-3 bg-slate-100 dark:bg-cyber-800/40 rounded-sm animate-pulse space-y-1.5">
                    <div className="h-3 w-1/3 bg-slate-200 dark:bg-cyber-700/60 rounded"></div>
                    <div className="h-2.5 w-3/4 bg-slate-200 dark:bg-cyber-700/40 rounded"></div>
                  </div>
                ))}
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-16 text-slate-400">No audit events recorded yet.</div>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className="p-3 rounded-sm border border-slate-200 dark:border-cyber-700/50 bg-slate-50 dark:bg-cyber-800/40 space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-[11px] text-slate-900 dark:text-white">
                      {log.action}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400">
                      {new Date(log.timestamp).toLocaleTimeString()}
                    </span>
                  </div>

                  <div className="flex items-center space-x-2 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
                    <span>Actor: <b className="text-slate-700 dark:text-slate-200">{log.actor}</b></span>
                    <span>•</span>
                    <span>Target: <b className="text-slate-700 dark:text-slate-200">{log.resource_type}</b></span>
                  </div>

                  {log.sha256_hash && (
                    <div className="text-[9px] font-mono text-slate-400 dark:text-slate-500 break-all pt-1 border-t border-slate-200 dark:border-cyber-700/40">
                      SHA: {log.sha256_hash}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
