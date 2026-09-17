import React from 'react';
import { SeverityLevel, DeviceStatus } from '../../types';

export const SeverityBadge: React.FC<{ severity: SeverityLevel; className?: string }> = ({
  severity,
  className = ''
}) => {
  const styles = {
    CRITICAL: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
    HIGH: 'bg-orange-500/10 text-orange-600 dark:text-orange-400',
    MEDIUM: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    LOW: 'bg-slate-500/10 text-slate-600 dark:text-slate-300'
  };

  return (
    <span
      className={`px-1.5 py-0.5 rounded-sm font-mono font-bold text-[10px] uppercase flex-shrink-0 ${
        styles[severity] || styles.LOW
      } ${className}`}
    >
      {severity}
    </span>
  );
};

export const StatusBadge: React.FC<{ status: DeviceStatus; className?: string }> = ({
  status,
  className = ''
}) => {
  if (status === 'ONLINE') {
    return (
      <span
        className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 inline-flex items-center space-x-1.5 ${className}`}
      >
        <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
        </span>
        <span>ONLINE</span>
      </span>
    );
  }

  if (status === 'QUARANTINED') {
    return (
      <span
        className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 inline-flex items-center space-x-1.5 ${className}`}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
        <span>QUARANTINED</span>
      </span>
    );
  }

  return (
    <span
      className={`px-2 py-0.5 rounded-sm text-[10px] font-mono font-bold bg-slate-200 dark:bg-cyber-700 text-slate-600 dark:text-slate-400 inline-flex items-center space-x-1.5 ${className}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-slate-400"></span>
      <span>OFFLINE</span>
    </span>
  );
};
