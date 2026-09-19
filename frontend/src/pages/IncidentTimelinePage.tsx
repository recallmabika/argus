import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle, Terminal, ClipboardList, Filter, RefreshCw, ChevronDown, ChevronUp, Server } from 'lucide-react';
import { api } from '../services/api';
import { TimelineEvent, Device } from '../types';

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  return `${Math.floor(diffInSeconds / 86400)}d ago`;
}

export const IncidentTimelinePage: React.FC = () => {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [timeRange, setTimeRange] = useState('24h');
  const [deviceId, setDeviceId] = useState('');
  const [username, setUsername] = useState('');

  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadDevices = async () => {
    try {
      const devs = await api.getDevices();
      setDevices(devs);
    } catch (e) {}
  };

  const fetchTimeline = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    try {
      const res = await api.getIncidentTimeline({
        time_range: timeRange,
        device_id: deviceId || undefined,
        username: username || undefined,
        limit: 100
      });
      setEvents(res.events);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to fetch timeline', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadDevices();
  }, []);

  useEffect(() => {
    fetchTimeline();
    const interval = setInterval(fetchTimeline, 10000);
    return () => clearInterval(interval);
  }, [timeRange, deviceId, username]);

  const alertCount = events.filter(e => e.source_type === 'alert').length;
  const commandCount = events.filter(e => e.source_type === 'command').length;
  const auditCount = events.filter(e => e.source_type === 'audit').length;

  const getSourceConfig = (type: string) => {
    switch (type) {
      case 'alert': return { icon: AlertTriangle, color: 'text-rose-500', bg: 'bg-rose-500', badge: 'bg-rose-500/10 text-rose-500 border-rose-500/20' };
      case 'command': return { icon: Terminal, color: 'text-amber-500', bg: 'bg-amber-500', badge: 'bg-amber-500/10 text-amber-500 border-amber-500/20' };
      case 'audit': return { icon: ClipboardList, color: 'text-slate-500', bg: 'bg-slate-500', badge: 'bg-slate-500/10 text-slate-500 border-slate-500/20' };
      case 'telemetry': default: return { icon: Server, color: 'text-blue-500', bg: 'bg-blue-500', badge: 'bg-blue-500/10 text-blue-500 border-blue-500/20' };
    }
  };

  const getSeverityColor = (sev?: string) => {
    if (!sev) return '';
    const s = sev.toUpperCase();
    if (s === 'CRITICAL') return 'bg-rose-500 text-white';
    if (s === 'HIGH') return 'bg-orange-500 text-white';
    if (s === 'MEDIUM') return 'bg-amber-500 text-white';
    if (s === 'LOW') return 'bg-blue-500 text-white';
    return 'bg-slate-500 text-white';
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Clock className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Incident Timeline</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Unified event chronology</p>
        </div>
        <button
          onClick={() => fetchTimeline(true)}
          className="bg-slate-100 dark:bg-cyber-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-cyber-700 px-3 py-1.5 rounded-sm text-sm font-semibold flex items-center space-x-2 transition focus:outline-none"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Events', value: total || events.length, icon: Clock },
          { label: 'Alerts', value: alertCount, icon: AlertTriangle },
          { label: 'Commands Issued', value: commandCount, icon: Terminal },
          { label: 'Audit Actions', value: auditCount, icon: ClipboardList }
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-3 shadow-xs flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <select 
          className="bg-slate-50 dark:bg-cyber-900/40 border border-slate-200 dark:border-cyber-700 rounded-sm text-xs font-semibold px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 dark:text-slate-300"
          value={timeRange}
          onChange={e => setTimeRange(e.target.value)}
        >
          <option value="1h">Last 1 Hour</option>
          <option value="6h">Last 6 Hours</option>
          <option value="24h">Last 24 Hours</option>
          <option value="7d">Last 7 Days</option>
          <option value="30d">Last 30 Days</option>
        </select>
        
        <select 
          className="bg-slate-50 dark:bg-cyber-900/40 border border-slate-200 dark:border-cyber-700 rounded-sm text-xs font-semibold px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 dark:text-slate-300 max-w-[200px]"
          value={deviceId}
          onChange={e => setDeviceId(e.target.value)}
        >
          <option value="">All Devices</option>
          {devices.map(d => (
            <option key={d.id} value={d.id}>{d.hostname} ({d.ip_address})</option>
          ))}
        </select>

        <input
          type="text"
          placeholder="Filter by Username..."
          className="flex-1 bg-slate-50 dark:bg-cyber-900/40 border border-slate-200 dark:border-cyber-700 rounded-sm text-xs px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white min-w-[150px]"
          value={username}
          onChange={e => setUsername(e.target.value)}
        />
      </div>

      {/* Vertical Timeline */}
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-6 shadow-xs relative">
        {loading && events.length === 0 ? (
          <div className="text-center py-12 text-slate-500">Loading timeline...</div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No events found for this timeframe.</div>
        ) : (
          <div className="relative border-l-2 border-slate-200 dark:border-cyber-700 ml-4 space-y-8 pb-4">
            {events.map((event, idx) => {
              const config = getSourceConfig(event.source_type);
              const isExpanded = expandedId === event.id;
              
              return (
                <div key={event.id} className="relative pl-8 group">
                  {/* Timeline Dot */}
                  <span className={`absolute -left-[9px] top-1.5 w-4 h-4 rounded-full border-2 border-white dark:border-cyber-card ${config.bg}`}></span>
                  
                  <div className="bg-slate-50 dark:bg-cyber-900/20 border border-slate-200 dark:border-cyber-700/50 rounded-sm p-4 hover:border-slate-300 dark:hover:border-cyber-600 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 mb-2">
                      <div className="flex items-center space-x-2 flex-wrap gap-y-2">
                        <span className={`px-2 py-0.5 rounded-sm border text-[10px] font-bold uppercase tracking-wider ${config.badge}`}>
                          {event.source_type}
                        </span>
                        {event.severity && (
                          <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold uppercase tracking-wider ${getSeverityColor(event.severity)}`}>
                            {event.severity}
                          </span>
                        )}
                        <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                          {event.title}
                        </h3>
                      </div>
                      <div className="text-xs font-mono text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatRelativeTime(event.timestamp)}
                        <span className="hidden sm:inline mx-1">&bull;</span>
                        <span className="hidden sm:inline">{new Date(event.timestamp).toLocaleTimeString()}</span>
                      </div>
                    </div>
                    
                    <p className="text-sm text-slate-600 dark:text-slate-300 mb-3">
                      {event.description}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs font-mono text-slate-500 dark:text-slate-400">
                      {event.hostname && (
                        <div className="flex items-center space-x-1">
                          <span className="font-sans font-semibold text-[10px] uppercase">Host:</span>
                          <span className="text-slate-700 dark:text-slate-300">{event.hostname}</span>
                        </div>
                      )}
                      {event.username && (
                        <div className="flex items-center space-x-1">
                          <span className="font-sans font-semibold text-[10px] uppercase">User:</span>
                          <span className="text-slate-700 dark:text-slate-300">{event.username}</span>
                        </div>
                      )}
                      {event.device_id && (
                        <div className="flex items-center space-x-1">
                          <span className="font-sans font-semibold text-[10px] uppercase">Device ID:</span>
                          <span className="truncate max-w-[120px]">{event.device_id}</span>
                        </div>
                      )}
                    </div>

                    {event.details && Object.keys(event.details).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200 dark:border-cyber-700/50">
                        <button 
                          onClick={() => setExpandedId(isExpanded ? null : event.id)}
                          className="flex items-center space-x-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline focus:outline-none"
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          <span>{isExpanded ? 'Hide Details' : 'View Raw Details'}</span>
                        </button>
                        {isExpanded && (
                          <pre className="mt-2 p-3 bg-slate-900 rounded-sm overflow-x-auto text-xs font-mono text-green-400 leading-relaxed shadow-inner">
                            {JSON.stringify(event.details, null, 2)}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
