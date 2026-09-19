import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Microscope, Monitor, Wifi, HardDrive, Smartphone, ShieldCheck, Activity } from 'lucide-react';
import { useModals } from '../../context/ModalContext';

export type ForensicBadgeVariant =
  | 'host'
  | 'wireless'
  | 'storage'
  | 'usb'
  | 'listener'
  | 'count'
  | 'ready'
  | 'active';

interface DeviceForensicBadgeProps {
  variant: ForensicBadgeVariant;
  count?: number;
  label?: string;
  className?: string;
  pulse?: boolean;
  to?: string;
  deviceId?: string;
  onClick?: (e: React.MouseEvent) => void;
  interactive?: boolean;
}

export const DeviceForensicBadge: React.FC<DeviceForensicBadgeProps> = ({
  variant,
  count = 0,
  label,
  className = '',
  pulse = false,
  to,
  deviceId,
  onClick,
  interactive = true
}) => {
  const navigate = useNavigate();
  const { openForensicStudio } = useModals();

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) {
      onClick(e);
      return;
    }
    if (deviceId) {
      e.stopPropagation();
      openForensicStudio(deviceId);
      return;
    }
    if (to) {
      e.stopPropagation();
      navigate(to);
      return;
    }
    if (interactive) {
      e.stopPropagation();
      navigate('/forensics');
    }
  };

  const interactiveClass = interactive ? 'cursor-pointer hover:brightness-110 active:scale-95 transition-all' : '';

  switch (variant) {
    case 'host':
      return (
        <span
          onClick={handleClick}
          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider font-bold border border-indigo-500/30 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 ${interactiveClass} ${className}`}
          title="Local Host Forensic Workstation — Click to inspect"
        >
          <Monitor className="w-3 h-3 text-indigo-500 flex-shrink-0" />
          <span>{label || 'LOCAL HOST'}</span>
        </span>
      );

    case 'wireless':
      return (
        <span
          onClick={handleClick}
          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider font-semibold border border-sky-500/30 bg-sky-500/10 text-sky-600 dark:text-sky-400 ${interactiveClass} ${className}`}
          title="Wi-Fi Wireless Forensic Bridge — Click to open forensics"
        >
          <Wifi className="w-3 h-3 text-sky-500 flex-shrink-0" />
          <span>{label || 'WI-FI FORENSICS'}</span>
        </span>
      );

    case 'storage':
      return (
        <span
          onClick={handleClick}
          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider font-semibold border border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400 ${interactiveClass} ${className}`}
          title="Attached Mass Storage Device — Click to inspect files"
        >
          <HardDrive className="w-3 h-3 text-amber-500 flex-shrink-0" />
          <span>{label || 'MASS STORAGE'}</span>
        </span>
      );

    case 'usb':
      return (
        <span
          onClick={handleClick}
          className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase tracking-wider font-semibold border border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 ${interactiveClass} ${className}`}
          title="USB Bus Attached Target — Click to mirror display"
        >
          <Smartphone className="w-3 h-3 text-emerald-500 flex-shrink-0" />
          <span>{label || 'USB CABLE'}</span>
        </span>
      );

    case 'listener':
      return (
        <span
          onClick={handleClick}
          className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-sm border border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300 text-[10px] font-mono font-bold shadow-xs ${interactiveClass} ${className}`}
          title="Live Forensic Hardware Bus — Click to open Forensics Bridge"
        >
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
          </span>
          <Microscope className="w-3 h-3 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
          <span>{label || 'LIVE BUS & WIRELESS LISTENER'}</span>
        </span>
      );

    case 'ready':
      return (
        <span
          onClick={handleClick}
          className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-sm text-[9.5px] font-mono uppercase tracking-wider font-semibold border border-cyan-500/30 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 ${interactiveClass} ${className}`}
          title="Endpoint is ready for live forensic acquisition and screen streaming — Click to launch Forensic Studio"
        >
          <ShieldCheck className="w-3 h-3 text-cyan-500 flex-shrink-0" />
          <span>{label || 'FORENSIC READY'}</span>
        </span>
      );

    case 'active':
      return (
        <span
          onClick={handleClick}
          className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-sm text-[9.5px] font-mono uppercase tracking-wider font-bold border border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400 ${interactiveClass} ${className}`}
          title="Active forensic investigation session in progress — Click to resume"
        >
          <Activity className="w-3 h-3 text-rose-500 animate-pulse flex-shrink-0" />
          <span>{label || 'INVESTIGATION ACTIVE'}</span>
        </span>
      );

    case 'count':
    default:
      if (count > 0) {
        return (
          <span
            onClick={handleClick}
            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border border-cyan-500/30 bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 shadow-xs ${interactiveClass} ${className}`}
            title="Connected forensic endpoints — Click to inspect"
          >
            {pulse && (
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse mr-1 flex-shrink-0"></span>
            )}
            <span>{count}</span>
          </span>
        );
      }
      return (
        <span
          onClick={handleClick}
          className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono text-slate-400 bg-slate-100 dark:bg-cyber-700/50 ${interactiveClass} ${className}`}
          title="Forensic Bridge Idle"
        >
          0
        </span>
      );
  }
};

