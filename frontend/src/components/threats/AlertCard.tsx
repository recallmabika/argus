import React, { useState } from 'react';
import { Copy, Check, ShieldAlert, Laptop, CheckCircle2 } from 'lucide-react';
import { Alert } from '../../types';
import { SeverityBadge } from '../common/Badge';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';

interface AlertCardProps {
  alert: Alert;
  onResolved?: (alertId: string) => void;
}

export const AlertCard: React.FC<AlertCardProps> = ({ alert, onResolved }) => {
  const { openAttackChain, openDeviceDetail } = useModals();
  const [copied, setCopied] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [isResolved, setIsResolved] = useState(alert.status === 'RESOLVED');

  const borderStyles = {
    CRITICAL: 'border-l-rose-500',
    HIGH: 'border-l-orange-500',
    MEDIUM: 'border-l-amber-500',
    LOW: 'border-l-slate-400'
  };

  const rawCmd = alert.raw_command || alert.process_command || '';
  const timestamp = new Date(alert.detected_at).toLocaleTimeString();

  const handleCopy = () => {
    if (!rawCmd) return;
    navigator.clipboard.writeText(rawCmd).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const handleResolve = async () => {
    setResolving(true);
    try {
      await api.resolveAlert(alert.id);
      setIsResolved(true);
      if (onResolved) onResolved(alert.id);
    } catch (e) {
      console.error('Failed to resolve alert:', e);
    } finally {
      setResolving(false);
    }
  };

  return (
    <div
      className={`p-4 rounded-sm border border-slate-200 dark:border-cyber-700/60 border-l-[3px] ${
        borderStyles[alert.severity] || borderStyles.LOW
      } bg-white dark:bg-cyber-card transition-all hover:shadow-md hover:border-slate-300 dark:hover:border-cyber-600 text-xs flex flex-col space-y-2`}
    >
      {/* Title & Time Row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 min-w-0">
          <SeverityBadge severity={alert.severity} />
          <span className="font-semibold text-xs text-slate-900 dark:text-slate-100 truncate">
            {alert.title}
          </span>
          {isResolved && (
            <span className="px-1.5 py-0.2 rounded font-mono text-[9px] bg-slate-200 dark:bg-cyber-700 text-slate-500 dark:text-slate-400 font-bold">
              RESOLVED
            </span>
          )}
        </div>
        <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500 flex-shrink-0 ml-2">
          {timestamp}
        </span>
      </div>

      {/* Description */}
      <p className="text-[11px] text-slate-600 dark:text-slate-300 leading-relaxed">
        {alert.description}
      </p>

      {/* Raw Payload / Command */}
      {rawCmd && (
        <div className="border-t border-slate-100 dark:border-cyber-700/40 pt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[9px] font-mono uppercase tracking-wider text-slate-400">
              Payload / Executed Command
            </span>
            <button
              onClick={handleCopy}
              className="px-2 py-0.5 rounded-sm text-[9px] font-mono text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-cyber-700/60 hover:bg-slate-100 dark:hover:bg-cyber-700/60 flex items-center space-x-1 transition"
            >
              {copied ? <Check className="w-2.5 h-2.5 text-emerald-500" /> : <Copy className="w-2.5 h-2.5" />}
              <span>{copied ? 'COPIED' : 'COPY'}</span>
            </button>
          </div>
          <pre className="text-[10px] font-mono text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-cyber-900/40 p-2 rounded-sm border border-slate-200 dark:border-cyber-700/40 overflow-x-auto whitespace-pre-wrap break-all max-h-20 custom-scrollbar">
            {rawCmd}
          </pre>
        </div>
      )}

      {/* MITRE & Endpoint Info */}
      <div className="border-t border-slate-100 dark:border-cyber-700/40 pt-2 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center space-x-1.5 flex-wrap gap-1">
          {alert.mitre_technique_id && (
            <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-mono font-bold bg-slate-100 dark:bg-cyber-700/60 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-cyber-600/50">
              {alert.mitre_technique_id}
            </span>
          )}
          {alert.mitre_technique_name && (
            <span className="text-[10px] text-slate-500 dark:text-slate-400">
              {alert.mitre_technique_name}
            </span>
          )}
          {alert.mitre_tactic && (
            <span className="px-1.5 py-0.5 rounded-sm text-[9px] font-mono bg-slate-50 dark:bg-cyber-800 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-cyber-700/50">
              {alert.mitre_tactic}
            </span>
          )}
        </div>

        <div className="flex items-center space-x-3 text-[10px] text-slate-500 dark:text-slate-400 font-mono">
          <span>Host: <b className="text-slate-700 dark:text-slate-200">{alert.hostname || alert.device_id}</b></span>
          {alert.user && (
            <span>User: <b className="text-slate-700 dark:text-slate-200">{alert.user}</b></span>
          )}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="border-t border-slate-100 dark:border-cyber-700/40 pt-2 flex items-center justify-end space-x-2">
        <button
          onClick={() => openAttackChain(alert.id)}
          className="px-3 py-1 rounded-sm text-[10px] font-semibold min-w-[90px] border border-slate-300 dark:border-cyber-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700/60 hover:text-slate-900 dark:hover:text-white transition"
        >
          Attack Chain
        </button>
        <button
          onClick={() => openDeviceDetail(alert.device_id)}
          className="px-3 py-1 rounded-sm text-[10px] font-semibold min-w-[85px] border border-slate-300 dark:border-cyber-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700/60 hover:text-slate-900 dark:hover:text-white transition"
        >
          Remediate
        </button>
        {!isResolved ? (
          <button
            onClick={handleResolve}
            disabled={resolving}
            className="px-3 py-1 rounded-sm text-[10px] font-semibold min-w-[70px] border border-slate-300 dark:border-cyber-600 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700/60 hover:text-slate-900 dark:hover:text-white transition"
          >
            {resolving ? 'Resolving...' : 'Resolve'}
          </button>
        ) : (
          <span className="text-slate-400 dark:text-slate-500 font-bold px-2 py-1 text-[10px] flex items-center space-x-1">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>Resolved</span>
          </span>
        )}
      </div>
    </div>
  );
};
