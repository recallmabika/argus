import React from 'react';
import { ShieldAlert, Laptop, Flame, Building, ClipboardCheck } from 'lucide-react';
import { AlertStats } from '../../types';

interface MetricsRibbonProps {
  stats: AlertStats | null;
  deviceCount: number;
  auditCount: number;
  branchCount?: number;
}

export const MetricsRibbon: React.FC<MetricsRibbonProps> = ({ stats, deviceCount, auditCount, branchCount = 0 }) => {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
      {/* Active Threats */}
      <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Active Threats
          </span>
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500"></span>
          </span>
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
            {stats ? stats.open : 0}
          </h3>
          <span className="text-[10px] font-mono text-slate-400 font-semibold">LIVE FEED</span>
        </div>
      </div>

      {/* Monitored Endpoints */}
      <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Monitored Fleet
          </span>
          <Laptop className="w-4 h-4 text-slate-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
            {deviceCount}
          </h3>
          <span className="text-[10px] font-mono text-emerald-500 font-semibold">ONLINE</span>
        </div>
      </div>

      {/* Critical / High Ratio */}
      <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Critical / High
          </span>
          <Flame className="w-4 h-4 text-orange-500" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
            {stats ? `${stats.critical} / ${stats.high}` : '0 / 0'}
          </h3>
          <span className="text-[10px] font-mono text-slate-400 font-semibold">SEV TIER</span>
        </div>
      </div>

      {/* Protected Branches */}
      <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Protected Sites
          </span>
          <Building className="w-4 h-4 text-slate-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
            {branchCount}
          </h3>
          <span className="text-[10px] font-mono text-slate-400 font-semibold">GEOLOCATED</span>
        </div>
      </div>

      {/* Audit Compliance */}
      <div className="col-span-2 sm:col-span-1 bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
            Audit Logged
          </span>
          <ClipboardCheck className="w-4 h-4 text-slate-400" />
        </div>
        <div className="mt-2 flex items-baseline justify-between">
          <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
            {auditCount}
          </h3>
          <span className="text-[10px] font-mono text-slate-400 font-semibold">COMPLIANT</span>
        </div>
      </div>
    </div>
  );
};
