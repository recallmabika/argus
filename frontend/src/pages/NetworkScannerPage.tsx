import React, { useState, useEffect } from 'react';
import {
  Radio,
  Search,
  Play,
  History,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Globe,
  Monitor,
  Filter,
  ArrowRight,
  ShieldAlert,
  Server
} from 'lucide-react';
import { api } from '../services/api';
import { Device, PortScanResult, ScannedPort } from '../types';
import { Button } from '../components/common/Button';
import { CustomSelect } from '../components/common/CustomSelect';

export const NetworkScannerPage: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [history, setHistory] = useState<PortScanResult[]>([]);
  const [targetType, setTargetType] = useState<'device' | 'custom'>('custom');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [customIp, setCustomIp] = useState<string>('127.0.0.1');
  const [scanProfile, setScanProfile] = useState<'top25' | 'db' | 'web' | 'full'>('top25');
  const [scanning, setScanning] = useState<boolean>(false);
  const [currentScan, setCurrentScan] = useState<PortScanResult | null>(null);
  const [riskFilter, setRiskFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const loadData = async () => {
    try {
      const [devs, hist] = await Promise.all([
        api.getDevices().catch(() => []),
        api.getPortScanHistory().catch(() => [])
      ]);
      setDevices(devs);
      setHistory(hist);
      if (hist.length > 0 && !currentScan) {
        setCurrentScan(hist[0]);
      }
      if (devs.length > 0 && !selectedDeviceId) {
        setSelectedDeviceId(devs[0].id);
      }
    } catch (e) {
      console.error('Failed to load scanner context', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const getProfilePorts = (): number[] | undefined => {
    if (scanProfile === 'web') return [80, 443, 8000, 8080, 8443];
    if (scanProfile === 'db') return [1433, 1521, 3306, 5432, 6379, 9200, 27017];
    if (scanProfile === 'top25') return [21, 22, 23, 25, 53, 80, 110, 135, 139, 143, 443, 445, 993, 995, 1433, 1521, 2049, 3306, 3389, 5432, 5900, 6379, 8000, 8080, 8443];
    return undefined; // full scan of all defined ports
  };

  const handleExecuteScan = async () => {
    setScanning(true);
    try {
      let result: PortScanResult;
      const ports = getProfilePorts();
      if (targetType === 'device' && selectedDeviceId) {
        const targetDev = devices.find(d => d.id === selectedDeviceId);
        result = await api.executePortScan(targetDev?.ip_address || undefined, selectedDeviceId, ports);
        result.hostname = targetDev?.hostname;
      } else {
        result = await api.executePortScan(customIp.trim() || '127.0.0.1', undefined, ports);
      }
      setCurrentScan(result);
      setHistory(prev => [result, ...prev.filter(h => h.id !== result.id)].slice(0, 50));
    } catch (e) {
      console.error('Port scan execution failed', e);
    } finally {
      setScanning(false);
    }
  };

  // Metrics across history
  const totalScans = history.length;
  const totalOpenPorts = history.reduce((acc, s) => acc + (s.open_ports_count || 0), 0);
  const criticalFindings = history.reduce((acc, s) => {
    return acc + (s.open_ports?.filter(p => p.risk === 'CRITICAL' || p.risk === 'HIGH').length || 0);
  }, 0);
  const avgSecurityScore = totalScans > 0
    ? Math.round(history.reduce((acc, s) => acc + (s.security_score || 0), 0) / totalScans)
    : 100;

  const filteredPorts = (currentScan?.open_ports || []).filter(p => {
    if (riskFilter !== 'ALL' && p.risk !== riskFilter) return false;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      return (
        p.service.toLowerCase().includes(q) ||
        String(p.port).includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.banner && p.banner.toLowerCase().includes(q))
      );
    }
    return true;
  });

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/30';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30';
      case 'LOW':
        return 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30';
      default:
        return 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border border-slate-500/30';
    }
  };

  return (
    <div className="space-y-5">
      {/* KPI Summary Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs border border-slate-200 dark:border-cyber-700/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Audits Executed
            </span>
            <History className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {totalScans}
            </h3>
            <span className="text-[10px] font-mono text-slate-400 font-semibold">RECORDS</span>
          </div>
        </div>

        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs border border-slate-200 dark:border-cyber-700/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Open Sockets Discovered
            </span>
            <Radio className="w-4 h-4 text-blue-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {totalOpenPorts}
            </h3>
            <span className="text-[10px] font-mono text-blue-500 font-semibold">IDENTIFIED</span>
          </div>
        </div>

        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs border border-slate-200 dark:border-cyber-700/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              High / Critical Exposure
            </span>
            <ShieldAlert className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {criticalFindings}
            </h3>
            <span className="text-[10px] font-mono text-rose-500 font-semibold">ATTENTION REQ</span>
          </div>
        </div>

        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs border border-slate-200 dark:border-cyber-700/60">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Fleet Posture Index
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {avgSecurityScore}%
            </h3>
            <span className="text-[10px] font-mono text-emerald-500 font-semibold">DEFENSE TIER</span>
          </div>
        </div>
      </div>

      {/* Target Configuration & Audit Launcher Deck */}
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-cyber-700/60 pb-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center space-x-2">
              <Radio className="w-4 h-4 text-blue-500" />
              <span>Network Reconnaissance &amp; Port Audit</span>
            </h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
              Live socket probe and service identification on host endpoints and organizational perimeters
            </p>
          </div>
          
          {/* Target Mode Segmented Control */}
          <div className="inline-flex border border-slate-200 dark:border-cyber-700/60 rounded-sm overflow-hidden bg-slate-50 dark:bg-cyber-800/40 p-0.5">
            <button
              onClick={() => setTargetType('custom')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition cursor-pointer ${
                targetType === 'custom'
                  ? 'bg-white dark:bg-cyber-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Custom IP / Subnet
            </button>
            <button
              onClick={() => setTargetType('device')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-sm transition cursor-pointer ${
                targetType === 'device'
                  ? 'bg-white dark:bg-cyber-700 text-blue-600 dark:text-blue-400 shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Enrolled Endpoint Fleet
            </button>
          </div>
        </div>

        {/* Audit Parameters Form */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
          <div className="md:col-span-5">
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Target Address / Host
            </label>
            {targetType === 'custom' ? (
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="text"
                  value={customIp}
                  onChange={(e) => setCustomIp(e.target.value)}
                  placeholder="e.g. 127.0.0.1 (localhost), 8.8.8.8 (dns.google), google.com, 192.168.1.1"
                  className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-cyber-900 border border-slate-300 dark:border-cyber-700 rounded-sm text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            ) : (
              <CustomSelect
                value={selectedDeviceId}
                onChange={setSelectedDeviceId}
                minWidth="w-full"
                options={devices.map(d => ({
                  value: d.id,
                  label: `${d.hostname} (${d.ip_address || '127.0.0.1'}) - ${d.branch_name}`
                }))}
              />
            )}
          </div>

          <div className="md:col-span-4">
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Audit Profile &amp; Port Range
            </label>
            <CustomSelect
              value={scanProfile}
              onChange={(val) => setScanProfile(val as any)}
              minWidth="w-full"
              options={[
                { value: 'top25', label: 'Top 25 Attack Vectors (SSH, SMB, RDP, Web)' },
                { value: 'web', label: 'Web & API Portals (80, 443, 8000, 8080, 8443)' },
                { value: 'db', label: 'Database Instances (MSSQL, MySQL, Postgres, Redis)' },
                { value: 'full', label: 'Full Port Spectrum (All Standard Vectors)' }
              ]}
            />
          </div>

          <div className="md:col-span-3 flex justify-end">
            <Button
              variant="primary"
              className="w-full py-2"
              isLoading={scanning}
              onClick={handleExecuteScan}
            >
              <Play className="w-3.5 h-3.5 mr-1.5 fill-current" />
              <span>Launch Port Audit</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Active Scan Telemetry & Results Matrix */}
      {currentScan ? (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Left Panel: Target Intelligence Summary */}
          <div className="lg:col-span-4 space-y-4">
            <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200 dark:border-cyber-700/60 pb-3">
                <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Target Telemetry
                </span>
                <span className="px-2 py-0.5 rounded-sm font-mono text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/30">
                  {currentScan.status}
                </span>
              </div>

              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-cyber-800">
                  <span className="text-slate-500 dark:text-slate-400">Target Host</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">{currentScan.target}</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-cyber-800">
                  <span className="text-slate-500 dark:text-slate-400">Resolved Domain</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400 truncate max-w-[210px] text-right" title={currentScan.domain_name || currentScan.hostname || 'Unresolved'}>
                    {currentScan.domain_name || currentScan.hostname || (currentScan.target === '127.0.0.1' ? 'localhost' : 'Unresolved')}
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-cyber-800">
                  <span className="text-slate-500 dark:text-slate-400">Resolved IP</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{currentScan.resolved_ip}</span>
                </div>
                {currentScan.hostname && currentScan.hostname !== currentScan.domain_name && (
                  <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-cyber-800">
                    <span className="text-slate-500 dark:text-slate-400">Device Node</span>
                    <span className="font-mono text-blue-600 dark:text-blue-400">{currentScan.hostname}</span>
                  </div>
                )}
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-cyber-800">
                  <span className="text-slate-500 dark:text-slate-400">Ports Probed</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{currentScan.ports_scanned} sockets</span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-cyber-800">
                  <span className="text-slate-500 dark:text-slate-400">Open Services</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white">
                    {currentScan.open_ports_count} active
                  </span>
                </div>
                <div className="flex justify-between items-center py-1 border-b border-slate-100 dark:border-cyber-800">
                  <span className="text-slate-500 dark:text-slate-400">Scan Duration</span>
                  <span className="font-mono text-slate-700 dark:text-slate-300">{currentScan.duration_ms} ms</span>
                </div>
                <div className="flex justify-between items-center py-1">
                  <span className="text-slate-500 dark:text-slate-400">Timestamp</span>
                  <span className="font-mono text-[10px] text-slate-500">{new Date(currentScan.timestamp).toLocaleTimeString()}</span>
                </div>
              </div>

              {/* Security Score Meter */}
              <div className="pt-2 border-t border-slate-200 dark:border-cyber-700/60">
                <div className="flex justify-between items-center mb-1.5">
                  <span className="text-[11px] font-bold text-slate-700 dark:text-slate-300">Posture Rating</span>
                  <span className="font-mono font-bold text-xs text-slate-900 dark:text-white">
                    {currentScan.security_score} / 100
                  </span>
                </div>
                <div className="w-full bg-slate-200 dark:bg-cyber-800 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      currentScan.security_score > 80
                        ? 'bg-emerald-500'
                        : currentScan.security_score > 50
                        ? 'bg-amber-500'
                        : 'bg-rose-500'
                    }`}
                    style={{ width: `${currentScan.security_score}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Past Audits Selector Card */}
            <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 shadow-xs">
              <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider block mb-3">
                Recent Audit History
              </span>
              <div className="space-y-1.5 max-h-56 overflow-y-auto custom-scrollbar">
                {history.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No previous audits recorded.</p>
                ) : (
                  history.map(item => (
                    <button
                      key={item.id}
                      onClick={() => setCurrentScan(item)}
                      className={`w-full text-left p-2 rounded-sm border transition flex items-center justify-between text-xs cursor-pointer ${
                        currentScan.id === item.id
                          ? 'border-blue-500 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                          : 'border-slate-200 dark:border-cyber-700/60 hover:bg-slate-50 dark:hover:bg-cyber-800/40 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="min-w-0 pr-2">
                        <div className="font-mono font-semibold truncate flex items-center space-x-1">
                          <span>{item.target}</span>
                          {(item.domain_name || item.target === '127.0.0.1') && (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-sans truncate max-w-[130px]">
                              ({item.domain_name || 'localhost'})
                            </span>
                          )}
                        </div>
                        <div className="text-[10px] text-slate-400">{new Date(item.timestamp).toLocaleTimeString()}</div>
                      </div>
                      <div className="flex items-center space-x-1.5 flex-shrink-0">
                        <span className="font-mono text-[10px]">{item.open_ports_count} ports</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel: Open Services Matrix */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-5 shadow-xs">
              {/* Filter Strip */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-200 dark:border-cyber-700/60 pb-3 mb-4">
                <div className="flex items-center space-x-2 flex-wrap">
                  <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                    Open Port Vectors ({filteredPorts.length})
                  </span>
                  {(currentScan.domain_name || currentScan.target === '127.0.0.1') && (
                    <span className="text-[11px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-1.5 py-0.5 rounded-sm">
                      {currentScan.domain_name || 'localhost (Local Loopback)'}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search service or port..."
                      className="pl-8 pr-3 py-1 bg-slate-50 dark:bg-cyber-900 border border-slate-300 dark:border-cyber-700 rounded-sm text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                    />
                  </div>

                  <CustomSelect
                    value={riskFilter}
                    onChange={setRiskFilter}
                    minWidth="w-32"
                    options={[
                      { value: 'ALL', label: 'ALL SEVERITY' },
                      { value: 'CRITICAL', label: 'CRITICAL' },
                      { value: 'HIGH', label: 'HIGH' },
                      { value: 'MEDIUM', label: 'MEDIUM' },
                      { value: 'LOW', label: 'LOW' }
                    ]}
                  />
                </div>
              </div>

              {/* Port Table */}
              {filteredPorts.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-slate-200 dark:border-cyber-700/60 rounded-sm">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    No exposed ports matching filter criteria
                  </p>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Target endpoint has no open listening sockets for selected profile
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-cyber-700/60 text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                        <th className="pb-2.5">Port / Proto</th>
                        <th className="pb-2.5">Identified Service</th>
                        <th className="pb-2.5">Risk Tier</th>
                        <th className="pb-2.5">Grabbed Banner / Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-cyber-800/60 font-mono">
                      {filteredPorts.map((port) => (
                        <tr key={port.port} className="hover:bg-slate-50 dark:hover:bg-cyber-800/40 transition">
                          <td className="py-3 pr-3">
                            <span className="font-bold text-slate-900 dark:text-white">{port.port}</span>
                            <span className="text-slate-400 text-[10px] ml-1">/{port.protocol}</span>
                          </td>
                          <td className="py-3 pr-3 font-sans font-semibold text-slate-900 dark:text-white">
                            <div>{port.service}</div>
                            <div className="text-[10px] font-normal text-slate-400">{port.description}</div>
                          </td>
                          <td className="py-3 pr-3">
                            <span className={`px-2 py-0.5 rounded-sm text-[10px] font-bold ${getRiskBadge(port.risk)}`}>
                              {port.risk}
                            </span>
                          </td>
                          <td className="py-3 text-[11px] text-slate-600 dark:text-slate-300">
                            {port.banner ? (
                              <span className="bg-slate-100 dark:bg-cyber-900 px-2 py-1 rounded-sm block max-w-xs truncate border border-slate-200 dark:border-cyber-700 text-[10px]">
                                {port.banner}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[10px]">Standard listener active</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-12 text-center shadow-xs">
          <Radio className="w-10 h-10 text-slate-400 mx-auto mb-3 animate-pulse" />
          <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Ready for Network Reconnaissance
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md mx-auto">
            Select an enrolled workstation or input an organizational IP address above, then launch an audit to inspect open sockets and service banners.
          </p>
        </div>
      )}
    </div>
  );
};
