import React, { useState, useEffect } from 'react';
import { ThreatStreamFeed } from '../components/threats/ThreatStreamFeed';
import { AlertStats } from '../types';
import { api } from '../services/api';
import { useArgusWebSocket } from '../services/websocket';
import { Monitor, ClipboardCheck, Flame } from 'lucide-react';

export const ThreatStreamPage: React.FC = () => {
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [fleetCount, setFleetCount] = useState<number>(0);
  const [auditCount, setAuditCount] = useState<number>(0);

  const loadData = () => {
    api.getAlertStats().then(setStats).catch(() => {});
    api.getDevices().then((d) => setFleetCount(d.length)).catch(() => {});
    api.getAuditLogs(10).then((a) => setAuditCount(a.length)).catch(() => {});
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  useArgusWebSocket((data) => {
    if (data.type === 'NEW_ALERT' || data.type === 'DEVICE_UPDATE') {
      loadData();
    }
  });

  return (
    <div className="space-y-5">
      {/* Dedicated Threat KPI Summary Cards Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

        {/* Monitored Endpoints */}
        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Monitored Fleet
            </span>
            <Monitor className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {fleetCount}
            </h3>
            <span className="text-[10px] font-mono text-emerald-500 font-semibold">ONLINE</span>
          </div>
        </div>

        {/* Audit Logged */}
        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
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

      {/* Full-Width Dedicated Threat Stream Panel */}
      <ThreatStreamFeed />
    </div>
  );
};
