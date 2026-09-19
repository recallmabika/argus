import React, { useState, useEffect } from 'react';
import { Wifi, X, Info, RefreshCw, Cpu, CheckCircle2, Search, Globe } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { NetworkTarget } from '../../types';

const BRANCH_OPTIONS = [
  { id: 'Harare Branch', label: 'Harare Branch (Remote WAN / -17.8249, 31.0530)', code: 'BR-HRE' },
  { id: 'Gweru Midlands HQ', label: 'Gweru Midlands HQ (National SOC / -19.4586, 29.8117)', code: 'HQ-GWR' },
  { id: 'Bulawayo Regional Office', label: 'Bulawayo Regional Office (Western Node / -20.1500, 28.5833)', code: 'BR-BYO' },
  { id: 'Mutare Eastern Node', label: 'Mutare Eastern Node (Eastern Border / -18.9728, 32.6694)', code: 'BR-MTR' },
];

export const WirelessConnectModal: React.FC = () => {
  const { isWirelessConnectOpen, closeWirelessConnect } = useModals();
  const [target, setTarget] = useState('');
  const [alias, setAlias] = useState('');
  const [port, setPort] = useState('5555');
  const [branchName, setBranchName] = useState('Harare Branch');
  const [loading, setLoading] = useState(false);
  const [discoveredTargets, setDiscoveredTargets] = useState<NetworkTarget[]>([]);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ text: string; error?: boolean } | null>(null);

  const fetchTargets = () => {
    setDiscoveryLoading(true);
    api.getNetworkTargets()
      .then((res) => {
        setDiscoveredTargets(res.targets || []);
      })
      .catch((err) => {
        console.error('Failed to query ARP network targets:', err);
      })
      .finally(() => setDiscoveryLoading(false));
  };

  useEffect(() => {
    if (isWirelessConnectOpen) {
      fetchTargets();
      setStatusMsg(null);
    }
  }, [isWirelessConnectOpen]);

  if (!isWirelessConnectOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetVal = target.trim();
    if (!targetVal) {
      setStatusMsg({ text: 'Please enter target IP Address or MAC Address.', error: true });
      return;
    }

    setLoading(true);
    setStatusMsg({ text: `Resolving target ${targetVal} (${branchName}) & establishing cross-network WAN bridge to Gweru HQ...` });

    try {
      const res = await api.connectWireless(
        targetVal,
        parseInt(port) || 5555,
        alias.trim() || undefined,
        branchName
      );
      setStatusMsg({ text: res.message || 'Target paired successfully!' });
      setTimeout(() => {
        closeWirelessConnect();
        setStatusMsg(null);
        setTarget('');
        setAlias('');
        setBranchName('Harare Branch');
      }, 1400);
    } catch (err: any) {
      setStatusMsg({ text: err.message || 'Failed to establish wireless forensic bridge.', error: true });
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDiscovered = (t: NetworkTarget) => {
    setTarget(t.ip);
    setAlias(`${t.vendor} (${t.ip})`);
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700 rounded-sm w-full max-w-lg shadow-2xl overflow-hidden flex flex-col text-xs">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-cyber-700/60 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-sm bg-cyan-500/10 text-cyan-500">
              <Wifi className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider font-mono">
                Pair Wireless & WAN Forensic Target
              </h3>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Cross-Network & Inter-Branch WAN Bridge &bull; Gweru HQ Monitoring
              </p>
            </div>
          </div>
          <button
            onClick={closeWirelessConnect}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition p-1 rounded-sm cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="p-5 space-y-4">
            {/* Cross-Network & Zero-ADB Explanatory Banner */}
            <div className="p-3 bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-500/20 rounded-sm space-y-1.5 text-[11px] text-slate-600 dark:text-slate-400">
              <p className="font-semibold text-cyan-700 dark:text-cyan-400 flex items-center space-x-1.5 font-mono text-[10px] uppercase">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>Inter-Branch Cross-Network Forensic Bridge:</span>
              </p>
              <p className="text-[10.5px] leading-relaxed">
                Connect devices located across <b>separate networks or branches</b> (e.g., target in <b>Harare</b> monitored live by HQ in <b>Gweru</b>) using either an <b>IP Address</b> or <b>MAC Address</b>. Even if ADB or developer options are disabled (e.g., lost or stolen company phone, dead screen, locked device), ARTIS automatically provisions an <b>Agentless Network Forensic Bridge</b> to trace, geolocate, and monitor the device in real-time.
              </p>
            </div>

            {/* Quick-Pick Discovered Local Targets */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5 text-[11px]">
                  <Search className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Discovered Wi-Fi / Local Network Endpoints (ARP Cache)</span>
                </label>
                <button
                  type="button"
                  onClick={fetchTargets}
                  className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 hover:underline flex items-center space-x-1 cursor-pointer"
                >
                  <RefreshCw className={`w-2.5 h-2.5 ${discoveryLoading ? 'animate-spin' : ''}`} />
                  <span>Refresh Bus</span>
                </button>
              </div>

              <div className="max-h-32 overflow-y-auto custom-scrollbar border border-slate-200 dark:border-cyber-700/80 rounded-sm bg-slate-50 dark:bg-cyber-900/60 p-1.5 space-y-1">
                {discoveryLoading && discoveredTargets.length === 0 ? (
                  <div className="p-3 text-center text-slate-400 text-[11px] flex items-center justify-center space-x-1.5">
                    <RefreshCw className="w-3 h-3 animate-spin text-cyan-500" />
                    <span>Querying host ARP table...</span>
                  </div>
                ) : discoveredTargets.length === 0 ? (
                  <div className="p-2 text-center text-slate-400 text-[10px] font-mono">
                    No dynamic ARP targets detected on local subnet
                  </div>
                ) : (
                  discoveredTargets.map((t) => {
                    const isSelected = target === t.ip || target.toLowerCase() === t.mac.toLowerCase();
                    return (
                      <div
                        key={t.ip + t.mac}
                        onClick={() => handleSelectDiscovered(t)}
                        className={`p-1.5 rounded-sm flex items-center justify-between cursor-pointer transition text-[10.5px] border ${
                          isSelected
                            ? 'border-cyan-500 bg-cyan-500/10 text-cyan-600 dark:text-cyan-300'
                            : 'border-transparent hover:bg-slate-200/60 dark:hover:bg-cyber-700/50 text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        <div className="flex items-center space-x-2 min-w-0">
                          <Cpu className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                          <div className="min-w-0 font-mono">
                            <span className="font-bold">{t.ip}</span>
                            <span className="text-slate-400 text-[9.5px] ml-1.5 uppercase">({t.mac})</span>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1.5 flex-shrink-0">
                          <span className="text-[10px] font-sans text-slate-500 dark:text-slate-400 truncate max-w-[130px]">
                            {t.vendor}
                          </span>
                          {isSelected && <CheckCircle2 className="w-3 h-3 text-cyan-500" />}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Target Input (IP or MAC) */}
            <div className="space-y-1.5">
              <label className="block font-semibold text-slate-700 dark:text-slate-300">
                Target IP Address or MAC Address
              </label>
              <input
                type="text"
                placeholder="e.g. 192.168.1.97, 10.20.0.15 (Harare WAN), or D4-0D-AB-1D-DB-08"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="w-full px-3 py-2 rounded-sm bg-slate-50 dark:bg-cyber-800 border border-slate-300 dark:border-cyber-600 focus:outline-none focus:border-cyan-500 text-slate-900 dark:text-white font-mono text-xs"
              />
            </div>

            {/* Target Branch / Remote Subnet Location */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
                  <Globe className="w-3.5 h-3.5 text-cyan-500" />
                  <span>Target Branch & Routing (Cross-Network Geolocation)</span>
                </label>
                <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400">HQ: Gweru National SOC</span>
              </div>
              <select
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                className="w-full px-3 py-2 rounded-sm bg-slate-50 dark:bg-cyber-800 border border-slate-300 dark:border-cyber-600 focus:outline-none focus:border-cyan-500 text-slate-900 dark:text-white font-mono text-xs cursor-pointer"
              >
                {BRANCH_OPTIONS.map((b) => (
                  <option key={b.id} value={b.id} className="bg-white dark:bg-cyber-900 text-slate-900 dark:text-white">
                    {b.label}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-500 dark:text-slate-400">
                Targets in Harare, Bulawayo, or separate subnets are tunneled back to Gweru HQ and plotted on the Geolocation map with authentic coordinates.
              </p>
            </div>

            {/* Optional Device Name / Alias */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Custom Device Alias (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Field Phone #3 (Galaxy)"
                  value={alias}
                  onChange={(e) => setAlias(e.target.value)}
                  className="w-full px-3 py-2 rounded-sm bg-slate-50 dark:bg-cyber-800 border border-slate-300 dark:border-cyber-600 focus:outline-none focus:border-cyan-500 text-slate-900 dark:text-white font-sans text-xs"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-semibold text-slate-700 dark:text-slate-300">
                  Port (Default: 5555)
                </label>
                <input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  className="w-full px-3 py-2 rounded-sm bg-slate-50 dark:bg-cyber-800 border border-slate-300 dark:border-cyber-600 focus:outline-none focus:border-cyan-500 text-slate-900 dark:text-white font-mono text-xs"
                />
              </div>
            </div>

            {/* Status Message */}
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
              <span>{loading ? 'Pairing...' : 'Pair Target'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
