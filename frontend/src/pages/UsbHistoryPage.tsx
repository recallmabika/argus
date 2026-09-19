import React, { useState, useEffect } from 'react';
import { Usb, HardDrive, Clock, Download, Search, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { api } from '../services/api';
import { UsbHistoryEntry } from '../types';

export const UsbHistoryPage: React.FC = () => {
  const [devices, setDevices] = useState<UsbHistoryEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const fetchData = async () => {
    try {
      const res = await api.getUsbHistory();
      setDevices(res.devices);
      setTotal(res.count);
    } catch (err) {
      console.error('Failed to fetch USB history', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filtered = devices.filter(d => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (d.friendly_name?.toLowerCase().includes(q) || d.serial?.toLowerCase().includes(q) || `${d.vid}:${d.pid}`.toLowerCase().includes(q));
  });

  const storageCount = devices.filter(d => d.device_class?.toLowerCase().includes('storage') || d.device_class === 'DiskDrive').length;
  const inputCount = devices.filter(d => d.device_class?.toLowerCase().includes('hid') || d.device_class?.toLowerCase().includes('keyboard') || d.device_class?.toLowerCase().includes('mouse')).length;
  const unknownCount = total - storageCount - inputCount;

  const exportCsv = () => {
    const headers = ['VID', 'PID', 'Serial', 'Friendly Name', 'Device Class', 'First Installed', 'Last Connected'];
    const rows = filtered.map(d => [
      d.vid, d.pid, d.serial, `"${d.friendly_name || ''}"`, d.device_class, d.first_installed || '', d.last_connected || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'usb_history.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const isKnown = (d: UsbHistoryEntry) => {
    // Simple heuristic: if it has a proper name and it's not totally blank, it's known, else unknown/suspicious
    if (!d.friendly_name || d.friendly_name.toLowerCase().includes('unknown')) return false;
    return true;
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center space-x-2">
            <Usb className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            <span>USB Device History</span>
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Audit log of connected peripherals</p>
        </div>
        <button
          onClick={exportCsv}
          className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:bg-slate-800 dark:hover:bg-slate-200 px-4 py-2 rounded-sm text-sm font-bold flex items-center space-x-2 transition focus:outline-none"
        >
          <Download className="w-4 h-4" />
          <span>Export CSV</span>
        </button>
      </div>

      {/* KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Total Devices</span>
            <Usb className="w-4 h-4" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{total}</div>
        </div>
        <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Storage Media</span>
            <HardDrive className="w-4 h-4" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{storageCount}</div>
        </div>
        <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Input Devices (HID)</span>
            <Clock className="w-4 h-4" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{inputCount}</div>
        </div>
        <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-[10px] font-bold uppercase tracking-wider">Unknown / Other</span>
            <AlertTriangle className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl font-mono font-bold text-slate-900 dark:text-white">{unknownCount}</div>
        </div>
      </div>

      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-3 shadow-xs flex items-center">
        <Search className="w-4 h-4 text-slate-400 mr-2 ml-1" />
        <input
          type="text"
          placeholder="Search by friendly name, serial, or VID:PID..."
          className="flex-1 bg-transparent border-none focus:outline-none focus:ring-0 text-sm text-slate-900 dark:text-white font-mono"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      <div className="space-y-4">
        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading USB history...</div>
        ) : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-500">No USB devices match your search.</div>
        ) : (
          filtered.map((d, idx) => {
            const known = isKnown(d);
            return (
              <div key={idx} className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs flex flex-col md:flex-row md:items-center gap-4">
                <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 bg-slate-50 dark:bg-cyber-900/40 border border-slate-100 dark:border-cyber-800 rounded-sm">
                  <Usb className={`w-6 h-6 ${known ? 'text-blue-500' : 'text-amber-500'}`} />
                </div>
                
                <div className="flex-1 min-w-0 grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <h3 className="font-bold text-slate-900 dark:text-white truncate" title={d.friendly_name || `${d.vid}:${d.pid}`}>
                      {d.friendly_name || 'Unknown Device'}
                    </h3>
                    <div className="flex items-center space-x-2 mt-1">
                      <span className="text-xs font-mono bg-slate-100 dark:bg-cyber-800 px-1.5 py-0.5 rounded-sm text-slate-600 dark:text-slate-300">
                        {d.vid}:{d.pid}
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {d.device_class || 'Unknown Class'}
                      </span>
                    </div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Serial Number</div>
                    <div className="text-xs font-mono text-slate-700 dark:text-slate-300 break-all">{d.serial || 'N/A'}</div>
                  </div>

                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Timestamps</div>
                    <div className="text-[11px] font-mono text-slate-600 dark:text-slate-400 flex flex-col space-y-0.5">
                      <span title="First Installed">1st: {d.first_installed || 'Unknown'}</span>
                      <span title="Last Connected">Last: {d.last_connected || 'Unknown'}</span>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0 self-start md:self-center flex items-center">
                  {known ? (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-sm border border-emerald-500/20 bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase">
                      <CheckCircle2 className="w-3 h-3" />
                      <span>Known</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-sm border border-amber-500/20 bg-amber-500/10 text-amber-500 text-[10px] font-bold uppercase">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Unverified</span>
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
