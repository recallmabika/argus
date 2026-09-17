import React, { useState } from 'react';
import { Wifi, X, Info } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';

export const WirelessConnectModal: React.FC = () => {
  const { isWirelessConnectOpen, closeWirelessConnect, alert } = useModals();
  const [ip, setIp] = useState('');
  const [port, setPort] = useState('5555');
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  if (!isWirelessConnectOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetIp = ip.trim();
    if (!targetIp) {
      setStatusMsg({ text: 'Please provide target device IP address.', error: true });
      return;
    }

    setLoading(true);
    setStatusMsg({ text: `Attempting ADB handshake with ${targetIp}:${port}...` });

    try {
      const res = await api.connectWireless(targetIp, parseInt(port) || 5555);
      setStatusMsg({ text: res.message || 'Connected successfully!' });
      setTimeout(() => {
        closeWirelessConnect();
        setStatusMsg(null);
        setIp('');
      }, 1200);
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Connection handshake failed.', error: true });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700 rounded-sm w-full max-w-md shadow-2xl overflow-hidden flex flex-col text-xs">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-cyber-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-sm bg-cyan-500/10 text-cyan-500">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Pair Wireless Target (Wi-Fi ADB)
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Attach mobile device or wireless workstation endpoint
              </p>
            </div>
          </div>
          <button
            onClick={closeWirelessConnect}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition p-1 rounded-sm"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            <div className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-500/20 rounded-sm space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
              <p className="font-semibold text-cyan-700 dark:text-cyan-400 flex items-center space-x-1">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Requirement Checklist:</span>
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-[10px] pl-1">
                <li>Device must be on the same local network or reachable subnet.</li>
                <li>
                  <b>Developer Options</b> &rarr; <b>Wireless Debugging</b> or USB debugging with port 5555 opened (<code>adb tcpip 5555</code>).
                </li>
              </ul>
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                Device IP Address
              </label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.150"
                value={ip}
                onChange={(e) => setIp(e.target.value)}
                className="w-full px-3 py-2 rounded-sm bg-slate-50 dark:bg-cyber-800 border border-slate-300 dark:border-cyber-600 focus:outline-none focus:border-cyan-500 text-slate-900 dark:text-white font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                TCP Port (Default: 5555)
              </label>
              <input
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value)}
                className="w-full px-3 py-2 rounded-sm bg-slate-50 dark:bg-cyber-800 border border-slate-300 dark:border-cyber-600 focus:outline-none focus:border-cyan-500 text-slate-900 dark:text-white font-mono text-xs"
              />
            </div>

            {statusMsg && (
              <div
                className={`p-2.5 rounded-sm text-xs font-medium border ${
                  statusMsg.error
                    ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                    : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30'
                }`}
              >
                {statusMsg.text}
              </div>
            )}
          </div>

          <div className="p-4 bg-slate-50 dark:bg-cyber-800/40 border-t border-slate-200 dark:border-cyber-700/60 flex justify-end space-x-2">
            <button
              type="button"
              onClick={closeWirelessConnect}
              className="px-3.5 py-1.5 rounded-sm text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-cyber-700 font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-1.5 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-white font-semibold flex items-center space-x-1.5 transition shadow-sm shadow-cyan-500/20 disabled:opacity-50 cursor-pointer"
            >
              <span>{loading ? 'Connecting...' : 'Connect Target'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
