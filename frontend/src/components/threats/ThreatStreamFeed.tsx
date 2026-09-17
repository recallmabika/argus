import React, { useState, useEffect, useMemo } from 'react';
import { Search, Pause, Play, Radio, Filter } from 'lucide-react';
import { Alert, SeverityLevel } from '../../types';
import { api } from '../../services/api';
import { useArgusWebSocket } from '../../services/websocket';
import { AlertCard } from './AlertCard';

export const ThreatStreamFeed: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [sevFilter, setSevFilter] = useState<'ALL' | SeverityLevel>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isPaused, setIsPaused] = useState(false);

  const loadAlerts = () => {
    api.getAlerts(50)
      .then(setAlerts)
      .catch((err) => console.error('Failed to load alerts:', err))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadAlerts();
  }, []);

  // Ingest real-time WebSocket alerts
  useArgusWebSocket((data) => {
    if (data.type === 'NEW_ALERT' && data.alert) {
      if (!isPaused) {
        setAlerts((prev) => [data.alert as Alert, ...prev]);
      }
    }
  });

  const filteredAlerts = useMemo(() => {
    return alerts.filter((a) => {
      if (sevFilter !== 'ALL' && a.severity !== sevFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const text = `${a.title} ${a.description} ${a.hostname || ''} ${a.raw_command || ''} ${a.mitre_tactic || ''} ${a.mitre_technique_id || ''}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [alerts, sevFilter, searchQuery]);

  return (
    <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-5 shadow-xs space-y-4">
      {/* Stream Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-cyber-700/50 flex-wrap gap-2">
        <div className="flex items-center space-x-2.5">
          <span className="relative flex h-2.5 w-2.5 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
          </span>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            Live Telemetry Incident &amp; Threat Ingestion Feed
          </h2>
        </div>
        <div className="flex items-center space-x-2 text-[11px] font-mono text-slate-400">
          <span>WebSocket Event Bus</span>
          <span className="h-1 w-1 rounded-full bg-slate-300 dark:bg-cyber-600"></span>
          <span>MITRE ATT&amp;CK Correlated</span>
        </div>
      </div>

      {/* Stream Filtering Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-3 py-2 border-b border-slate-100 dark:border-cyber-700/40">
        {/* Severity Filter Tabs: Border-divided, no solid background */}
        <div className="flex items-center space-x-1.5">
          <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400 font-semibold mr-1">
            Filter:
          </span>
          <div className="flex items-center border border-slate-200 dark:border-cyber-700/70 rounded-sm divide-x divide-slate-200 dark:divide-cyber-700/70 overflow-hidden text-xs">
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((sev) => (
              <button
                key={sev}
                onClick={() => setSevFilter(sev)}
                className={`px-3 py-1 font-mono font-medium transition ${
                  sevFilter === sev
                    ? 'bg-slate-200 dark:bg-cyber-700 text-slate-900 dark:text-white font-bold'
                    : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/60'
                }`}
              >
                {sev.charAt(0) + sev.slice(1).toLowerCase()}
              </button>
            ))}
          </div>
        </div>

        {/* Search Input & Stream Pause Button */}
        <div className="flex items-center space-x-2.5">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter host, command, tactic..."
              className="pl-8 pr-3 py-1.5 rounded-sm text-xs font-mono w-60 bg-white dark:bg-cyber-900/60 border border-slate-200 dark:border-cyber-700/60 text-slate-700 dark:text-slate-200 placeholder-slate-400 focus:border-slate-400 dark:focus:border-cyber-500 focus:outline-none transition"
            />
          </div>
          <button
            onClick={() => setIsPaused(!isPaused)}
            className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-sm text-xs font-mono border transition ${
              isPaused
                ? 'border-amber-400 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 font-bold'
                : 'border-slate-200 dark:border-cyber-700/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700/60'
            }`}
            title="Pause or Resume incoming live threat stream"
          >
            {isPaused ? <Play className="w-3.5 h-3.5" /> : <Pause className="w-3.5 h-3.5" />}
            <span>{isPaused ? 'Resume' : 'Pause'}</span>
          </button>
        </div>
      </div>

      {/* Feed Container */}
      <div className="space-y-3 pt-1 min-h-[400px]">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-4 rounded-sm border border-slate-200 dark:border-cyber-700/50 bg-white dark:bg-cyber-card space-y-2.5 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-1/4 bg-slate-200 dark:bg-cyber-700/70 rounded-sm"></div>
                  <div className="h-3 w-16 bg-slate-200 dark:bg-cyber-700/50 rounded-sm"></div>
                </div>
                <div className="h-3 w-3/4 bg-slate-200 dark:bg-cyber-700/50 rounded-sm"></div>
                <div className="h-2.5 w-1/2 bg-slate-200 dark:bg-cyber-700/40 rounded-sm"></div>
              </div>
            ))}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="text-center py-20 text-slate-400 text-xs">
            {searchQuery || sevFilter !== 'ALL'
              ? 'No incidents matched the selected filter criteria.'
              : 'Listening for live telemetry events... No active threats detected.'}
          </div>
        ) : (
          filteredAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} onResolved={loadAlerts} />
          ))
        )}
      </div>
    </div>
  );
};
