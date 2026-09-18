import React, { useState } from 'react';
import {
  X,
  Monitor,
  Cpu,
  Copy,
  Check,
  PlusCircle,
  Terminal,
  User,
  MapPin,
  Globe,
  ShieldCheck
} from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { Button } from '../common/Button';

export const EnrollDeviceModal: React.FC = () => {
  const { isEnrollDeviceOpen, closeEnrollDevice, alert } = useModals();

  const [hostname, setHostname] = useState('');
  const [osType, setOsType] = useState('windows');
  const [currentUser, setCurrentUser] = useState('analyst');
  const [ipAddress, setIpAddress] = useState('127.0.0.1');
  const [branchName, setBranchName] = useState('Headquarters');
  const [initialStatus, setInitialStatus] = useState('ONLINE');

  const [isDetecting, setIsDetecting] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedCmd, setCopiedCmd] = useState(false);

  if (!isEnrollDeviceOpen) return null;

  const deviceIdPreview = hostname.trim()
    ? `ARGUS-${hostname.trim().toUpperCase().replace(/\s+/g, '-')}`
    : 'ARGUS-HOST';

  const agentCommand = `python agent/agent.py --server http://localhost:8000 --device-id ${deviceIdPreview}`;

  const handleDetectLocal = async () => {
    setIsDetecting(true);
    try {
      const data = await api.detectLocalHost();
      if (data.hostname) setHostname(data.hostname);
      if (data.username) setCurrentUser(data.username);
      if (data.os_type) setOsType(data.os_type);
      if (data.ip_address) setIpAddress(data.ip_address);
    } catch (err: any) {
      console.error('Failed to detect local host:', err);
    } finally {
      setIsDetecting(false);
    }
  };

  const handleCopyCmd = () => {
    navigator.clipboard.writeText(agentCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hostname.trim()) {
      alert({ title: 'Validation Error', message: 'Hostname is required to enroll an endpoint.', type: 'danger' });
      return;
    }

    setIsSubmitting(true);
    try {
      await api.enrollDevice({
        hostname: hostname.trim(),
        os_type: osType,
        current_user: currentUser.trim() || 'analyst',
        ip_address: ipAddress.trim() || '127.0.0.1',
        branch_name: branchName.trim() || 'Headquarters',
        status: initialStatus
      });

      alert({
        title: 'Endpoint Enrolled',
        message: `Successfully provisioned ${hostname.trim()} into fleet monitoring.`,
        type: 'success'
      });

      // Reset form & close
      setHostname('');
      closeEnrollDevice();
    } catch (err: any) {
      alert({
        title: 'Enrollment Failed',
        message: err.message || 'Failed to enroll endpoint device.',
        type: 'danger'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card rounded-sm w-full max-w-xl flex flex-col shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between bg-slate-50/50 dark:bg-cyber-800/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black shadow-xs">
              <Monitor className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Enroll Endpoint Device
              </h3>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Provision a workstation or server node for real-time telemetry ingestion
              </p>
            </div>
          </div>
          <button
            onClick={closeEnrollDevice}
            className="text-slate-400 hover:text-slate-600 dark:hover:text-white p-1.5 rounded-sm hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Quick Auto-Detect Strip */}
        <div className="px-6 py-2.5 bg-slate-50 dark:bg-cyber-800/50 flex items-center justify-between shadow-xs">
          <span className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
            Enroll your current workstation:
          </span>
          <button
            type="button"
            onClick={handleDetectLocal}
            disabled={isDetecting}
            className="px-2.5 py-1 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black hover:bg-slate-800 dark:hover:bg-slate-100 font-medium text-[11px] flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
          >
            <Cpu className={`w-3.5 h-3.5 ${isDetecting ? 'animate-spin' : ''}`} />
            <span>{isDetecting ? 'Detecting...' : 'Auto-Detect Local Host'}</span>
          </button>
        </div>

        {/* Enrollment Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Hostname */}
            <div>
              <label className="block text-[10.5px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 mb-1">
                Hostname *
              </label>
              <input
                type="text"
                required
                value={hostname}
                onChange={(e) => setHostname(e.target.value)}
                placeholder="e.g. DESKTOP-SEC-01"
                className="w-full bg-slate-50 dark:bg-cyber-800/60 py-2 px-3 text-xs rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white font-mono shadow-xs"
              />
              <span className="text-[10px] text-slate-400 font-mono mt-0.5 block">
                ID: {deviceIdPreview}
              </span>
            </div>

            {/* Operating System */}
            <div>
              <label className="block text-[10.5px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 mb-1">
                Operating System
              </label>
              <select
                value={osType}
                onChange={(e) => setOsType(e.target.value)}
                className="w-full bg-slate-50 dark:bg-cyber-800/60 py-2 px-3 text-xs rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white font-mono shadow-xs cursor-pointer"
              >
                <option value="windows">Windows (NT Kernel)</option>
                <option value="linux">Linux (Debian / RHEL / Arch)</option>
                <option value="darwin">macOS (Darwin)</option>
                <option value="android">Android (AOSP)</option>
              </select>
            </div>

            {/* Assigned User */}
            <div>
              <label className="block text-[10.5px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 mb-1">
                Assigned User
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={currentUser}
                  onChange={(e) => setCurrentUser(e.target.value)}
                  placeholder="e.g. alex.mercer"
                  className="w-full bg-slate-50 dark:bg-cyber-800/60 py-2 pl-8 pr-3 text-xs rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white font-mono shadow-xs"
                />
                <User className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* IP Address */}
            <div>
              <label className="block text-[10.5px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 mb-1">
                IP Address
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={ipAddress}
                  onChange={(e) => setIpAddress(e.target.value)}
                  placeholder="e.g. 192.168.1.100"
                  className="w-full bg-slate-50 dark:bg-cyber-800/60 py-2 pl-8 pr-3 text-xs rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white font-mono shadow-xs"
                />
                <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Branch Location */}
            <div>
              <label className="block text-[10.5px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 mb-1">
                Branch Location
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={branchName}
                  onChange={(e) => setBranchName(e.target.value)}
                  placeholder="e.g. Headquarters"
                  className="w-full bg-slate-50 dark:bg-cyber-800/60 py-2 pl-8 pr-3 text-xs rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white font-mono shadow-xs"
                />
                <MapPin className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>
            </div>

            {/* Initial State */}
            <div>
              <label className="block text-[10.5px] uppercase font-mono font-bold text-slate-500 dark:text-slate-400 mb-1">
                Initial Posture
              </label>
              <select
                value={initialStatus}
                onChange={(e) => setInitialStatus(e.target.value)}
                className="w-full bg-slate-50 dark:bg-cyber-800/60 py-2 px-3 text-xs rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white font-mono shadow-xs cursor-pointer"
              >
                <option value="ONLINE">ONLINE (Active Telemetry)</option>
                <option value="QUARANTINED">QUARANTINED (Network Isolated)</option>
                <option value="OFFLINE">OFFLINE (Pending Connection)</option>
              </select>
            </div>
          </div>

          {/* Agent Command Box */}
          <div className="bg-slate-50 dark:bg-cyber-800/40 p-3 rounded-sm shadow-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase font-bold text-slate-400 flex items-center space-x-1">
                <Terminal className="w-3 h-3 text-blue-500" />
                <span>Endpoint Agent Pairing Command</span>
              </span>
              <button
                type="button"
                onClick={handleCopyCmd}
                className="text-[10px] text-slate-400 hover:text-slate-900 dark:hover:text-white flex items-center space-x-1 transition cursor-pointer font-mono"
              >
                {copiedCmd ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-500" />
                    <span className="text-emerald-500 font-bold">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="text-[11px] font-mono text-slate-700 dark:text-slate-300 overflow-x-auto whitespace-pre-wrap select-all py-1">
              {agentCommand}
            </pre>
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end space-x-2 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={closeEnrollDevice}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={isSubmitting}
            >
              <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
              <span>Enroll Endpoint Node</span>
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
