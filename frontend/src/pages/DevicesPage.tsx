import React, { useState, useEffect, useMemo } from 'react';
import {
  Monitor,
  Search,
  RefreshCw,
  Ban,
  Terminal,
  Activity,
  ChevronDown,
  User,
  ArrowUpDown,
  Plus,
  Cpu,
  Trash2,
  Copy,
  Check
} from 'lucide-react';
import { Device, DeviceStatus } from '../types';
import { api } from '../services/api';
import { useArgusWebSocket } from '../services/websocket';
import { useModals } from '../context/ModalContext';
import { StatusBadge } from '../components/common/Badge';
import { Button } from '../components/common/Button';

type SortOption = 'risk-desc' | 'risk-asc' | 'hostname-asc' | 'last-seen';

export const DevicesPage: React.FC = () => {
  const { openDeviceDetail, openKillProcess, openEnrollDevice, alert, confirm } = useModals();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | DeviceStatus>('ALL');
  const [branchFilter, setBranchFilter] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<SortOption>('risk-desc');
  const [actionPendingId, setActionPendingId] = useState<string | null>(null);
  const [isQuickEnrolling, setIsQuickEnrolling] = useState<boolean>(false);
  const [copiedCmd, setCopiedCmd] = useState<boolean>(false);

  const fetchDevices = async () => {
    try {
      const data = await api.getDevices();
      setDevices(data);
    } catch (err: any) {
      console.error('Failed to load devices:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 10000);
    return () => clearInterval(interval);
  }, []);

  useArgusWebSocket((data) => {
    if (data.type === 'DEVICE_UPDATE' || data.type === 'NEW_ALERT') {
      fetchDevices();
    }
  });

  // Unique branches for filtering
  const branches = useMemo(() => {
    const set = new Set<string>();
    devices.forEach((d) => {
      if (d.branch_name) set.add(d.branch_name);
    });
    return Array.from(set).sort();
  }, [devices]);

  // Metrics
  const totalFleet = devices.length;
  const onlineCount = devices.filter((d) => d.status === 'ONLINE').length;
  const quarantinedCount = devices.filter((d) => d.status === 'QUARANTINED').length;
  const avgRiskScore = totalFleet > 0
    ? Math.round(devices.reduce((acc, d) => acc + (d.risk_score || 0), 0) / totalFleet)
    : 0;

  // Filter & Sort
  const filteredDevices = useMemo(() => {
    return devices
      .filter((d) => {
        // Status filter
        if (statusFilter !== 'ALL' && d.status !== statusFilter) return false;
        // Branch filter
        if (branchFilter !== 'ALL' && d.branch_name !== branchFilter) return false;
        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchHost = d.hostname?.toLowerCase().includes(q);
          const matchUser = d.current_user?.toLowerCase().includes(q);
          const matchIp = d.ip_address?.toLowerCase().includes(q);
          const matchBranch = d.branch_name?.toLowerCase().includes(q);
          const matchOs = d.os_type?.toLowerCase().includes(q);
          if (!matchHost && !matchUser && !matchIp && !matchBranch && !matchOs) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'risk-desc') return (b.risk_score || 0) - (a.risk_score || 0);
        if (sortBy === 'risk-asc') return (a.risk_score || 0) - (b.risk_score || 0);
        if (sortBy === 'hostname-asc') return a.hostname.localeCompare(b.hostname);
        if (sortBy === 'last-seen') return new Date(b.last_seen).getTime() - new Date(a.last_seen).getTime();
        return 0;
      });
  }, [devices, statusFilter, branchFilter, searchQuery, sortBy]);

  const handleQuickEnrollLocal = async () => {
    setIsQuickEnrolling(true);
    try {
      const local = await api.detectLocalHost();
      await api.enrollDevice({
        hostname: local.hostname,
        os_type: local.os_type,
        ip_address: local.ip_address,
        current_user: local.username,
        branch_name: 'Headquarters',
        status: 'ONLINE'
      });
      await fetchDevices();
      alert({
        title: 'Local Workstation Enrolled',
        message: `Node ${local.hostname} (${local.os_type}) successfully registered into Argus fleet.`,
        type: 'success'
      });
    } catch (err: any) {
      alert({
        title: 'Enrollment Notice',
        message: err.message || 'Could not auto-enroll local host.',
        type: 'warning'
      });
    } finally {
      setIsQuickEnrolling(false);
    }
  };

  const handleQuarantineToggle = async (device: Device) => {
    setActionPendingId(device.id);
    const isQuarantined = device.status === 'QUARANTINED';
    const action = isQuarantined ? 'RESTORE_NETWORK' : 'ISOLATE_NETWORK';
    try {
      await api.dispatchDeviceCommand(device.id, action);
      await fetchDevices();
      alert({
        title: isQuarantined ? 'Network Restored' : 'Host Quarantined',
        message: isQuarantined
          ? `Host ${device.hostname} network connectivity has been restored.`
          : `Host ${device.hostname} isolated from corporate network.`,
        type: isQuarantined ? 'success' : 'warning'
      });
    } catch (err: any) {
      alert({
        title: 'Directive Error',
        message: err.message || 'Failed to dispatch quarantine directive.',
        type: 'danger'
      });
    } finally {
      setActionPendingId(null);
    }
  };

  const handleUnenrollDevice = async (device: Device) => {
    const ok = await confirm({
      title: 'Unenroll Endpoint',
      message: `Are you sure you want to remove ${device.hostname} from Argus fleet monitoring? Associated telemetry directives will be archived.`,
      confirmText: 'Unenroll Device',
      badge: 'UNENROLL',
      type: 'warning'
    });

    if (!ok) return;

    try {
      await api.unenrollDevice(device.id);
      await fetchDevices();
      alert({
        title: 'Device Removed',
        message: `Endpoint ${device.hostname} has been unenrolled from monitoring.`,
        type: 'info'
      });
    } catch (err: any) {
      alert({
        title: 'Unenroll Error',
        message: err.message || 'Failed to unenroll endpoint device.',
        type: 'danger'
      });
    }
  };

  const handleCopyAgentCmd = () => {
    navigator.clipboard.writeText('python agent/agent.py --server http://localhost:8000');
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-rose-600 dark:text-rose-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-emerald-600 dark:text-emerald-400';
  };

  const getRiskBarColor = (score: number) => {
    if (score >= 80) return 'bg-rose-500';
    if (score >= 50) return 'bg-amber-500';
    return 'bg-emerald-500';
  };

  return (
    <div className="space-y-5">
      {/* Fleet KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Enrolled */}
        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Enrolled Fleet
            </span>
            <Monitor className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {totalFleet}
            </h3>
            <span className="text-[10px] font-mono text-slate-400 font-semibold">TOTAL NODES</span>
          </div>
        </div>

        {/* Online Endpoints */}
        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Online Endpoints
            </span>
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {onlineCount}
            </h3>
            <span className="text-[10px] font-mono text-emerald-500 font-semibold">ACTIVE</span>
          </div>
        </div>

        {/* Quarantined Nodes */}
        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Quarantined Hosts
            </span>
            <Ban className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {quarantinedCount}
            </h3>
            <span className="text-[10px] font-mono text-rose-500 font-semibold">CONTAINED</span>
          </div>
        </div>

        {/* Fleet Average Risk */}
        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Fleet Avg Risk
            </span>
            <Activity className={`w-4 h-4 ${avgRiskScore >= 50 ? 'text-amber-500' : 'text-emerald-500'}`} />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {avgRiskScore} <span className="text-xs text-slate-400 font-normal">/ 100</span>
            </h3>
            <span className={`text-[10px] font-mono font-semibold ${getRiskColor(avgRiskScore)}`}>
              {avgRiskScore >= 80 ? 'CRITICAL' : avgRiskScore >= 50 ? 'ELEVATED' : 'NOMINAL'}
            </span>
          </div>
        </div>
      </div>

      {/* Main Devices Panel */}
      <div className="bg-white dark:bg-cyber-card rounded-sm p-5 shadow-xs space-y-4">
        {/* Controls Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search hostname, IP, user, branch, OS..."
              className="w-full bg-slate-50 dark:bg-cyber-800/60 pl-9 pr-4 py-2 text-xs rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white placeholder-slate-400 transition shadow-xs font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Filter, Sort & Action Controls */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Branch Filter Dropdown */}
            {branches.length > 0 && (
              <div className="relative">
                <select
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  aria-label="Filter endpoints by branch location"
                  className="appearance-none bg-slate-50 dark:bg-cyber-800/60 text-slate-700 dark:text-slate-300 text-xs py-2 pl-3 pr-8 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono cursor-pointer transition shadow-xs"
                >
                  <option value="ALL">All Branches ({branches.length})</option>
                  {branches.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}

            {/* Sort Dropdown */}
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
                aria-label="Sort endpoints by attribute"
                className="appearance-none bg-slate-50 dark:bg-cyber-800/60 text-slate-700 dark:text-slate-300 text-xs py-2 pl-3 pr-8 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono cursor-pointer transition shadow-xs"
              >
                <option value="risk-desc">Sort: Highest Risk</option>
                <option value="risk-asc">Sort: Lowest Risk</option>
                <option value="hostname-asc">Sort: Hostname (A-Z)</option>
                <option value="last-seen">Sort: Last Seen</option>
              </select>
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Refresh Button */}
            <button
              onClick={fetchDevices}
              disabled={loading}
              className="p-2 rounded-sm bg-slate-50 dark:bg-cyber-800/60 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700 transition cursor-pointer shadow-xs"
              title="Refresh Fleet Telemetry"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-blue-500' : ''}`} />
            </button>

            {/* Quick Auto-Detect & Enroll Local Machine */}
            <button
              type="button"
              onClick={handleQuickEnrollLocal}
              disabled={isQuickEnrolling}
              className="px-3 py-2 rounded-sm bg-slate-50 dark:bg-cyber-800/60 hover:bg-slate-100 dark:hover:bg-cyber-700 text-slate-700 dark:text-slate-200 text-xs font-medium flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
              title="Auto-detect and enroll this local PC into fleet monitoring"
            >
              <Cpu className={`w-3.5 h-3.5 text-blue-500 ${isQuickEnrolling ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Enroll This Host</span>
            </button>

            {/* Enroll Device Primary Button */}
            <Button
              type="button"
              variant="primary"
              size="sm"
              onClick={openEnrollDevice}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              <span>Enroll Device</span>
            </Button>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <button
            onClick={() => setStatusFilter('ALL')}
            className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              statusFilter === 'ALL'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                : 'bg-slate-50 dark:bg-cyber-800/40 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-cyber-700/60'
            }`}
          >
            <span>All Devices</span>
            <span className="text-[10px] font-mono opacity-75">({totalFleet})</span>
          </button>

          <button
            onClick={() => setStatusFilter('ONLINE')}
            className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              statusFilter === 'ONLINE'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                : 'bg-slate-50 dark:bg-cyber-800/40 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-cyber-700/60'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
            <span>Online</span>
            <span className="text-[10px] font-mono opacity-75">({onlineCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('QUARANTINED')}
            className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              statusFilter === 'QUARANTINED'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                : 'bg-slate-50 dark:bg-cyber-800/40 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-cyber-700/60'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
            <span>Quarantined</span>
            <span className="text-[10px] font-mono opacity-75">({quarantinedCount})</span>
          </button>

          <button
            onClick={() => setStatusFilter('OFFLINE')}
            className={`px-3 py-1.5 rounded-sm text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
              statusFilter === 'OFFLINE'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                : 'bg-slate-50 dark:bg-cyber-800/40 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-cyber-700/60'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400"></span>
            <span>Offline</span>
            <span className="text-[10px] font-mono opacity-75">({Math.max(0, totalFleet - onlineCount - quarantinedCount)})</span>
          </button>
        </div>

        {/* Devices Table or Onboarding Empty State */}
        {devices.length === 0 && !loading ? (
          <div className="py-12 px-6 flex flex-col items-center justify-center text-center max-w-xl mx-auto space-y-4">
            <div className="p-4 rounded-sm bg-slate-100 dark:bg-cyber-800/60 text-slate-700 dark:text-slate-200 shadow-xs">
              <Monitor className="w-8 h-8" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                No Monitored Endpoints Enrolled
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-md">
                Enroll a workstation or server node to begin ingesting real-time process execution, web navigation, and behavioral telemetry into the Argus SOC engine.
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
              <Button
                variant="primary"
                size="sm"
                onClick={openEnrollDevice}
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                <span>Enroll Endpoint Node</span>
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={handleQuickEnrollLocal}
                isLoading={isQuickEnrolling}
              >
                <Cpu className="w-3.5 h-3.5 mr-1.5 text-blue-500" />
                <span>Auto-Detect &amp; Enroll This PC</span>
              </Button>
            </div>

            {/* Quick Terminal Command */}
            <div className="w-full bg-slate-50 dark:bg-cyber-800/40 p-3 rounded-sm shadow-xs text-left mt-4 space-y-1">
              <div className="flex items-center justify-between text-[10.5px] font-mono text-slate-400 font-bold">
                <span className="flex items-center space-x-1.5">
                  <Terminal className="w-3 h-3 text-blue-500" />
                  <span>Terminal Agent Launch</span>
                </span>
                <button
                  onClick={handleCopyAgentCmd}
                  className="hover:text-slate-900 dark:hover:text-white flex items-center space-x-1 transition cursor-pointer"
                >
                  {copiedCmd ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-500" />
                      <span className="text-emerald-500">Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
              <pre className="text-[11px] font-mono text-slate-700 dark:text-slate-300 select-all overflow-x-auto whitespace-pre-wrap py-1">
                python agent/agent.py --server http://localhost:8000
              </pre>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto custom-scrollbar pt-2">
            <table className="w-full text-left font-mono text-xs">
              <thead className="bg-slate-50/80 dark:bg-cyber-800/40 text-[10px] uppercase text-slate-400 tracking-wider rounded-sm">
                <tr>
                  <th className="py-3 px-3.5 rounded-l-sm">Endpoint Node</th>
                  <th className="py-3 px-3.5">Assigned User</th>
                  <th className="py-3 px-3.5">Branch Location</th>
                  <th className="py-3 px-3.5">Threat Risk</th>
                  <th className="py-3 px-3.5">Status</th>
                  <th className="py-3 px-3.5">Last Seen</th>
                  <th className="py-3 px-3.5 text-right rounded-r-sm">Directives</th>
                </tr>
              </thead>
              <tbody className="font-mono text-xs divide-y-0">
                {loading ? (
                  [1, 2, 3, 4].map((i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={7} className="py-3.5 px-3.5">
                        <div className="h-5 bg-slate-200 dark:bg-cyber-700/50 rounded-sm"></div>
                      </td>
                    </tr>
                  ))
                ) : filteredDevices.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-slate-400 font-sans">
                      No endpoint devices match the specified query filters.
                    </td>
                  </tr>
                ) : (
                  filteredDevices.map((d) => {
                    const isQuarantined = d.status === 'QUARANTINED';
                    const isPending = actionPendingId === d.id;

                    return (
                      <tr
                        key={d.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-cyber-800/40 transition group"
                      >
                        {/* Hostname & OS */}
                        <td className="py-3 px-3.5 rounded-l-sm">
                          <div className="flex items-center space-x-2.5">
                            <div className="p-1.5 rounded-sm bg-slate-100 dark:bg-cyber-800 text-slate-700 dark:text-slate-300 shadow-xs">
                              <Monitor className="w-4 h-4" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-900 dark:text-white flex items-center space-x-1.5">
                                <span>{d.hostname}</span>
                                <span className="text-[10px] font-normal px-1.5 py-0.2 rounded-sm bg-slate-100 dark:bg-cyber-800 text-slate-500 uppercase">
                                  {d.os_type}
                                </span>
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                IP: {d.ip_address || '127.0.0.1'}
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Current User */}
                        <td className="py-3 px-3.5 text-slate-700 dark:text-slate-300">
                          <div className="flex items-center space-x-1.5">
                            <User className="w-3.5 h-3.5 text-slate-400" />
                            <span>{d.current_user || 'system'}</span>
                          </div>
                        </td>

                        {/* Branch Name */}
                        <td className="py-3 px-3.5 text-slate-500 dark:text-slate-400">
                          <span className="px-2 py-0.5 rounded-sm bg-slate-100/80 dark:bg-cyber-800/60 text-slate-600 dark:text-slate-300 text-[11px]">
                            {d.branch_name}
                          </span>
                        </td>

                        {/* Risk Score */}
                        <td className="py-3 px-3.5">
                          <div className="space-y-1 w-24">
                            <div className="flex items-center justify-between text-[11px]">
                              <span className={`font-bold ${getRiskColor(d.risk_score)}`}>
                                {d.risk_score}
                              </span>
                              <span className="text-[10px] text-slate-400">/ 100</span>
                            </div>
                            <div className="h-1.5 w-full bg-slate-100 dark:bg-cyber-800 rounded-sm overflow-hidden">
                              <div
                                className={`h-full ${getRiskBarColor(d.risk_score)} transition-all duration-300`}
                                style={{ width: `${Math.min(100, d.risk_score)}%` }}
                              />
                            </div>
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3 px-3.5">
                          <StatusBadge status={d.status} />
                        </td>

                        {/* Last Seen */}
                        <td className="py-3 px-3.5 text-slate-400 text-[11px]">
                          {new Date(d.last_seen).toLocaleTimeString()}
                        </td>

                        {/* Actions Strip */}
                        <td className="py-3 px-3.5 text-right rounded-r-sm">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* Instant Quarantine / Restore Toggle */}
                            <button
                              onClick={() => handleQuarantineToggle(d)}
                              disabled={isPending}
                              className={`px-2.5 py-1 rounded-sm text-[11px] font-medium transition cursor-pointer flex items-center space-x-1 shadow-xs ${
                                isQuarantined
                                  ? 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                                  : 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400'
                              }`}
                              title={isQuarantined ? 'Restore Network Connectivity' : 'Isolate Node from Corporate Network'}
                            >
                              <Ban className={`w-3 h-3 ${isPending ? 'animate-spin' : ''}`} />
                              <span>{isQuarantined ? 'Restore' : 'Quarantine'}</span>
                            </button>

                            {/* Kill Process Trigger */}
                            <button
                              onClick={() => openKillProcess(d.id)}
                              className="px-2.5 py-1 rounded-sm bg-slate-100 dark:bg-cyber-800 hover:bg-slate-200 dark:hover:bg-cyber-700 text-slate-700 dark:text-slate-300 font-medium text-[11px] transition cursor-pointer shadow-xs"
                              title="Terminate Hostile Process"
                            >
                              <Terminal className="w-3 h-3 text-rose-500 inline mr-1" />
                              <span>Kill</span>
                            </button>

                            {/* Inspect Modal Trigger */}
                            <button
                              onClick={() => openDeviceDetail(d.id)}
                              className="px-2.5 py-1 rounded-sm bg-slate-900 dark:bg-white hover:bg-slate-800 dark:hover:bg-slate-100 text-white dark:text-black font-semibold text-[11px] transition cursor-pointer shadow-xs"
                              title="Open Deep Telemetry & Directives Inspector"
                            >
                              Inspect
                            </button>

                            {/* Unenroll Device */}
                            <button
                              onClick={() => handleUnenrollDevice(d)}
                              className="p-1 rounded-sm text-slate-400 hover:text-rose-500 hover:bg-rose-500/10 transition cursor-pointer"
                              title="Unenroll Endpoint Device"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
