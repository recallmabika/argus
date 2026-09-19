import React, { useState, useEffect } from 'react';
import { Cpu, HardDrive, Activity, Gauge, MemoryStick, ArrowUpDown, Wifi, ArrowUp, ArrowDown } from 'lucide-react';
import { api } from '../services/api';
import { SystemHealth } from '../types';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / (3600 * 24));
  const h = Math.floor((seconds % (3600 * 24)) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return `${d}d ${h}h ${m}m`;
}

export const SystemHealthPage: React.FC = () => {
  const [data, setData] = useState<SystemHealth | null>(null);
  const [sortField, setSortField] = useState<'cpu_percent' | 'memory_mb'>('cpu_percent');
  const [sortDesc, setSortDesc] = useState(true);

  const fetchData = async () => {
    try {
      const res = await api.getSystemHealth();
      setData(res);
    } catch (err) {
      console.error('Failed to fetch system health', err);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, []);

  if (!data) {
    return (
      <div className="p-4 sm:p-6 lg:p-8 flex items-center justify-center h-full">
        <Activity className="w-8 h-8 text-blue-500 animate-spin" />
      </div>
    );
  }

  const primaryDisk = data.disks.find(d => d.mountpoint === '/' || d.mountpoint === 'C:\\') || data.disks[0];

  const sortedProcesses = [...data.processes].sort((a, b) => {
    const valA = a[sortField];
    const valB = b[sortField];
    if (valA < valB) return sortDesc ? 1 : -1;
    if (valA > valB) return sortDesc ? -1 : 1;
    return 0;
  });

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Activity className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>System Health Monitor</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Real-time system telemetry</p>
        </div>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">CPU Usage</span>
            <Cpu className="w-4 h-4" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
            {data.cpu.overall.toFixed(1)}%
          </div>
        </div>

        <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">RAM Usage</span>
            <MemoryStick className="w-4 h-4" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
            {data.memory.percent.toFixed(1)}%
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
            {formatBytes(data.memory.used)} / {formatBytes(data.memory.total)}
          </div>
        </div>

        <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Disk Usage (Primary)</span>
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
            {primaryDisk ? primaryDisk.percent.toFixed(1) + '%' : 'N/A'}
          </div>
          <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 mt-1">
            {primaryDisk ? `${formatBytes(primaryDisk.used)} / ${formatBytes(primaryDisk.total)}` : ''}
          </div>
        </div>

        <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">System Uptime</span>
            <Gauge className="w-4 h-4" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">
            {formatUptime(data.uptime_seconds)}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* CPU Cores & Network */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm shadow-xs flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-cyber-700/60 flex items-center space-x-2">
              <Cpu className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">CPU Cores</h2>
            </div>
            <div className="p-4 grid grid-cols-2 gap-3">
              {data.cpu.per_core.map((core, idx) => (
                <div key={idx} className="bg-slate-50 dark:bg-cyber-900/40 border border-slate-100 dark:border-cyber-800 rounded-sm p-2 flex flex-col justify-center">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-mono text-slate-600 dark:text-slate-300">Core {idx}</span>
                    <span className="text-xs font-mono font-bold text-slate-900 dark:text-white">{core.toFixed(0)}%</span>
                  </div>
                  <div className="w-full bg-slate-200 dark:bg-cyber-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-1.5 rounded-full ${core >= 80 ? 'bg-red-500' : core >= 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                      style={{ width: `${core}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm shadow-xs flex flex-col">
            <div className="p-4 border-b border-slate-200 dark:border-cyber-700/60 flex items-center space-x-2">
              <Wifi className="w-4 h-4 text-slate-500 dark:text-slate-400" />
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Network I/O</h2>
            </div>
            <div className="p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                  <ArrowUp className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-sans">Sent</span>
                </div>
                <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                  {formatBytes(data.network.bytes_sent)}
                </div>
              </div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 text-slate-600 dark:text-slate-400">
                  <ArrowDown className="w-4 h-4 text-emerald-500" />
                  <span className="text-xs font-sans">Received</span>
                </div>
                <div className="text-sm font-mono font-bold text-slate-900 dark:text-white">
                  {formatBytes(data.network.bytes_recv)}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Process List */}
        <div className="lg:col-span-2 bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm shadow-xs flex flex-col">
          <div className="p-4 border-b border-slate-200 dark:border-cyber-700/60 flex items-center space-x-2">
            <Activity className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Top Processes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-cyber-900/40 text-[10px] uppercase tracking-wider text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-cyber-700/60">
                  <th className="px-4 py-3 font-medium">PID</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th 
                    className="px-4 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                    onClick={() => {
                      if (sortField === 'cpu_percent') setSortDesc(!sortDesc);
                      else { setSortField('cpu_percent'); setSortDesc(true); }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>CPU %</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 font-medium cursor-pointer hover:text-slate-700 dark:hover:text-slate-200"
                    onClick={() => {
                      if (sortField === 'memory_mb') setSortDesc(!sortDesc);
                      else { setSortField('memory_mb'); setSortDesc(true); }
                    }}
                  >
                    <div className="flex items-center space-x-1">
                      <span>RAM (MB)</span>
                      <ArrowUpDown className="w-3 h-3" />
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-cyber-700/50">
                {sortedProcesses.slice(0, 15).map(proc => (
                  <tr key={proc.pid} className="text-xs font-mono text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-cyber-800/50 transition-colors">
                    <td className="px-4 py-2">{proc.pid}</td>
                    <td className="px-4 py-2 font-bold text-slate-900 dark:text-white truncate max-w-[200px]">{proc.name}</td>
                    <td className="px-4 py-2">{proc.username || '-'}</td>
                    <td className="px-4 py-2">{proc.status}</td>
                    <td className={`px-4 py-2 ${proc.cpu_percent > 10 ? 'text-amber-500 font-bold' : ''}`}>
                      {proc.cpu_percent.toFixed(1)}
                    </td>
                    <td className="px-4 py-2">{proc.memory_mb.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
