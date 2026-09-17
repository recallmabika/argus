import React, { useState } from 'react';
import { X, Search, Download, Filter } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { HuntResultItem } from '../../types';
import { Button } from '../common/Button';
import { CustomSelect } from '../common/CustomSelect';
import { SeverityBadge } from '../common/Badge';

export const ThreatHuntingModal: React.FC = () => {
  const { isHuntingOpen, closeHunting } = useModals();
  const [query, setQuery] = useState('');
  const [eventType, setEventType] = useState('');
  const [severity, setSeverity] = useState('');
  const [timeRange, setTimeRange] = useState('24');
  const [results, setResults] = useState<HuntResultItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  if (!isHuntingOpen) return null;

  const handleSearch = async () => {
    setLoading(true);
    setHasSearched(true);
    try {
      const res = await api.searchHunt(query, eventType, severity, timeRange);
      setResults(res.events || []);
    } catch (e) {
      console.error('Hunt failed:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleExport = (format: 'csv' | 'json') => {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (eventType) params.set('event_type', eventType);
    if (severity) params.set('severity', severity);
    if (timeRange) params.set('hours', timeRange);
    params.set('format', format);
    window.open(`/api/v1/hunting/export?${params.toString()}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700 rounded-sm w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-cyber-700/60 flex items-center justify-between bg-slate-50/50 dark:bg-cyber-800/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black">
              <Search className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Threat Hunting &amp; Telemetry Search
              </h3>
              <p className="text-[10px] text-slate-400">Deep raw event investigation across endpoints</p>
            </div>
          </div>
          <button onClick={closeHunting} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search Bar & Filters */}
        <div className="p-5 bg-slate-50 dark:bg-cyber-800/50 border-b border-slate-200 dark:border-cyber-700/60 space-y-3">
          <div className="flex items-center space-x-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search command-lines, processes, payloads, users, domains (e.g. powershell, mimikatz)..."
                className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-cyber-900 border border-slate-300 dark:border-cyber-700 rounded-sm text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-white"
              />
            </div>
            <Button variant="primary" isLoading={loading} onClick={handleSearch}>
              Execute Hunt
            </Button>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-3">
              <CustomSelect
                value={eventType}
                onChange={setEventType}
                minWidth="w-44"
                placeholder="ALL EVENTS"
                options={[
                  { value: '', label: 'ALL EVENTS' },
                  { value: 'PROCESS_START', label: 'PROCESS_START' },
                  { value: 'BROWSER_VISIT', label: 'BROWSER_VISIT' },
                  { value: 'CLIPBOARD_CHANGE', label: 'CLIPBOARD_CHANGE' },
                  { value: 'PRINT_JOB', label: 'PRINT_JOB' },
                  { value: 'AUTH_FAILURE', label: 'AUTH_FAILURE' },
                  { value: 'CAMERA_ALERT', label: 'CAMERA_ALERT' },
                  { value: 'FORENSIC_TRIAGE', label: 'FORENSIC_TRIAGE' }
                ]}
              />

              <CustomSelect
                value={severity}
                onChange={setSeverity}
                minWidth="w-40"
                placeholder="ALL SEVERITIES"
                options={[
                  { value: '', label: 'ALL SEVERITIES' },
                  { value: 'CRITICAL', label: 'CRITICAL' },
                  { value: 'HIGH', label: 'HIGH' },
                  { value: 'MEDIUM', label: 'MEDIUM' },
                  { value: 'LOW', label: 'LOW' }
                ]}
              />

              <div className="flex items-center border border-slate-200 dark:border-cyber-700/70 rounded-sm divide-x divide-slate-200 dark:divide-cyber-700/70 overflow-hidden text-[11px] font-mono">
                {['1', '6', '24', '168'].map((hr) => (
                  <button
                    key={hr}
                    onClick={() => setTimeRange(hr)}
                    className={`px-3 py-1.5 transition ${
                      timeRange === hr
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-cyber-700/60'
                    }`}
                  >
                    {hr === '168' ? '7d' : `${hr}h`}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-400">Export Stream:</span>
              <button
                onClick={() => handleExport('csv')}
                className="px-3 py-1.5 rounded-sm border border-slate-300 dark:border-cyber-700 text-[11px] font-mono text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700 transition"
              >
                CSV
              </button>
              <button
                onClick={() => handleExport('json')}
                className="px-3 py-1.5 rounded-sm border border-slate-300 dark:border-cyber-700 text-[11px] font-mono text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700 transition"
              >
                JSON
              </button>
            </div>
          </div>
        </div>

        {/* Table of Results */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-5">
          <div className="flex items-center justify-between pb-2 text-[11px] font-mono text-slate-400">
            <span>Showing {results.length} matching events</span>
            <span>Window: Last {timeRange} Hours</span>
          </div>

          <div className="border border-slate-200 dark:border-cyber-700/60 rounded-sm overflow-x-auto">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-50 dark:bg-cyber-800 border-b border-slate-200 dark:border-cyber-700/60 text-[10px] uppercase text-slate-400">
                <tr>
                  <th className="py-2.5 px-3">Timestamp</th>
                  <th className="py-2.5 px-3">Event Type</th>
                  <th className="py-2.5 px-3">Host / User</th>
                  <th className="py-2.5 px-3">Severity</th>
                  <th className="py-2.5 px-3">Payload Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-cyber-800/60">
                {results.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-12 text-center text-slate-400">
                      {hasSearched ? 'No events matched your query criteria.' : 'Enter a query term or select filters to hunt across raw telemetry events.'}
                    </td>
                  </tr>
                ) : (
                  results.map((r, i) => (
                    <tr key={i} className="hover:bg-slate-50/50 dark:hover:bg-cyber-800/30">
                      <td className="py-2.5 px-3 text-slate-400 text-[11px]">
                        {new Date(r.timestamp).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {r.event_type}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300">
                        {r.hostname} {r.user ? `(${r.user})` : ''}
                      </td>
                      <td className="py-2.5 px-3">
                        <SeverityBadge severity={r.severity} />
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 dark:text-slate-300 max-w-xs truncate">
                        {r.payload}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
