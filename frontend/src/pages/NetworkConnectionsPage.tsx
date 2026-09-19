import React, { useState, useEffect } from 'react';
import { Network, Globe, ArrowLeftRight, Filter, Activity, Search } from 'lucide-react';
import { api } from '../services/api';
import { NetworkConnection } from '../types';

export const NetworkConnectionsPage: React.FC = () => {
  const [connections, setConnections] = useState<NetworkConnection[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [protocolFilter, setProtocolFilter] = useState('ALL');
  const [search, setSearch] = useState('');

  const [sortField, setSortField] = useState<keyof NetworkConnection>('status');
  const [sortDesc, setSortDesc] = useState(false);

  const fetchData = async () => {
    try {
      const statusParam = statusFilter !== 'ALL' ? statusFilter : undefined;
      const protoParam = protocolFilter !== 'ALL' ? protocolFilter.toLowerCase() : undefined;
      const res = await api.getNetworkConnections(statusParam, protoParam);
      setConnections(res.connections);
      setTotal(res.total);
    } catch (err) {
      console.error('Failed to fetch connections', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [statusFilter, protocolFilter]);

  const filtered = connections.filter(c => {
    if (search) {
      const q = search.toLowerCase();
      return (c.process_name?.toLowerCase().includes(q) || c.remote_address?.toLowerCase().includes(q));
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (valA < valB) return sortDesc ? 1 : -1;
    if (valA > valB) return sortDesc ? -1 : 1;
    return 0;
  });

  const handleSort = (field: keyof NetworkConnection) => {
    if (sortField === field) setSortDesc(!sortDesc);
    else {
      setSortField(field);
      setSortDesc(false);
    }
  };

  const counts = {
    total: total || connections.length,
    established: connections.filter(c => c.status === 'ESTABLISHED').length,
    listen: connections.filter(c => c.status === 'LISTEN').length,
    timeWait: connections.filter(c => c.status === 'TIME_WAIT').length,
  };

  const getStatusColor = (status: string) => {
    switch(status) {
      case 'ESTABLISHED': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'LISTEN': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'TIME_WAIT': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'CLOSE_WAIT': return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Network className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>Network Connections</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Live sockets and ports</p>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Connections', value: counts.total, icon: Network },
          { label: 'Established', value: counts.established, icon: Globe },
          { label: 'Listening', value: counts.listen, icon: Activity },
          { label: 'Time Wait', value: counts.timeWait, icon: ArrowLeftRight }
        ].map((kpi, idx) => (
          <div key={idx} className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-wider">{kpi.label}</span>
              <kpi.icon className="w-4 h-4" />
            </div>
            <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
              {kpi.value}
            </div>
          </div>
        ))}
      </div>

      {/* Filter Bar */}
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-3 shadow-xs flex flex-wrap items-center gap-3">
        <Filter className="w-4 h-4 text-slate-400" />
        <select 
          className="bg-slate-50 dark:bg-cyber-900/40 border border-slate-200 dark:border-cyber-700 rounded-sm text-xs font-semibold px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 dark:text-slate-300"
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
        >
          <option value="ALL">All Statuses</option>
          <option value="ESTABLISHED">ESTABLISHED</option>
          <option value="LISTEN">LISTEN</option>
          <option value="TIME_WAIT">TIME_WAIT</option>
          <option value="CLOSE_WAIT">CLOSE_WAIT</option>
        </select>
        <select 
          className="bg-slate-50 dark:bg-cyber-900/40 border border-slate-200 dark:border-cyber-700 rounded-sm text-xs font-semibold px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-700 dark:text-slate-300"
          value={protocolFilter}
          onChange={e => setProtocolFilter(e.target.value)}
        >
          <option value="ALL">All Protocols</option>
          <option value="TCP">TCP</option>
          <option value="UDP">UDP</option>
        </select>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-2" />
          <input
            type="text"
            placeholder="Search process or remote address..."
            className="w-full bg-slate-50 dark:bg-cyber-900/40 border border-slate-200 dark:border-cyber-700 rounded-sm text-xs px-3 py-1.5 pl-8 focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm shadow-xs overflow-hidden flex flex-col">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-cyber-900/40 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-cyber-700/60">
                <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => handleSort('protocol')}>Protocol</th>
                <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => handleSort('local_address')}>Local Address</th>
                <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => handleSort('remote_address')}>Remote Address</th>
                <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => handleSort('status')}>Status</th>
                <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => handleSort('pid')}>PID</th>
                <th className="px-4 py-3 font-medium cursor-pointer" onClick={() => handleSort('process_name')}>Process Name</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-cyber-700/50">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500"><Activity className="w-6 h-6 animate-spin mx-auto text-blue-500" /></td>
                </tr>
              ) : sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500 text-sm">No connections found.</td>
                </tr>
              ) : (
                sorted.map((conn, i) => (
                  <tr key={i} className="text-xs font-mono text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-cyber-800/50 transition-colors">
                    <td className="px-4 py-2 font-bold">{conn.protocol.toUpperCase()}</td>
                    <td className="px-4 py-2">{conn.local_address}:{conn.local_port}</td>
                    <td className="px-4 py-2">{conn.remote_address === '0.0.0.0' || conn.remote_address === '*' || !conn.remote_address ? '-' : `${conn.remote_address}:${conn.remote_port}`}</td>
                    <td className="px-4 py-2">
                      {conn.status ? (
                        <span className={`px-2 py-0.5 rounded-sm border text-[10px] font-bold ${getStatusColor(conn.status)}`}>
                          {conn.status}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-2">{conn.pid || '-'}</td>
                    <td className="px-4 py-2 text-slate-900 dark:text-white font-sans font-medium">{conn.process_name || '-'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
