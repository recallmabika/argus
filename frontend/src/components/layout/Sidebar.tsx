import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Radio,
  Laptop,
  MapPin,
  FileText,
  ShieldCheck,
  ClipboardList,
  Search,
  Bell,
  Smartphone,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Monitor
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { useArgusWebSocket } from '../../services/websocket';

interface SidebarProps {
  isOpen: boolean;
  isCollapsed: boolean;
  onClose: () => void;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  isOpen,
  isCollapsed,
  onClose,
  onToggleCollapse
}) => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const { openReport, openVerify, toggleAudit, openHunting, openWebhooks } = useModals();

  const [activeThreatCount, setActiveThreatCount] = useState<number>(0);
  const [endpointCount, setEndpointCount] = useState<number>(0);
  const [auditCount, setAuditCount] = useState<number>(0);

  const loadMetrics = () => {
    api.getAlertStats().then(s => setActiveThreatCount(s.open || 0)).catch(() => {});
    api.getDevices().then(d => setEndpointCount(d.length || 0)).catch(() => {});
    api.getAuditLogs(10).then(a => setAuditCount(a.length || 0)).catch(() => {});
  };

  useEffect(() => {
    loadMetrics();
    const interval = setInterval(loadMetrics, 10000);
    return () => clearInterval(interval);
  }, []);

  useArgusWebSocket((data) => {
    if (data.type === 'NEW_ALERT' || data.type === 'DEVICE_UPDATE') {
      loadMetrics();
    }
  });

  const isActive = (path: string) => {
    if (path === '/dashboard' && (location.pathname === '/dashboard' || location.pathname === '/')) return true;
    return location.pathname === path;
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 lg:hidden transition-opacity"
        />
      )}

      <aside
        className={`fixed lg:static top-0 bottom-0 left-0 z-50 flex flex-col bg-white dark:bg-cyber-card border-r border-slate-200 dark:border-cyber-700/60 transition-all duration-300 ${
          isCollapsed ? 'w-20' : 'w-64'
        } ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}
      >
        {/* Header & Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200 dark:border-cyber-700/60 flex-shrink-0">
          <Link to="/dashboard" className="flex items-center space-x-3 overflow-hidden group">
            <div className="w-8 h-8 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center font-bold font-mono text-sm flex-shrink-0 shadow-sm">
              A
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="font-extrabold text-sm tracking-wider text-slate-900 dark:text-white uppercase">
                  ARTIS
                </span>
                <span className="text-[9px] font-mono text-slate-400 dark:text-slate-500 uppercase tracking-widest truncate">
                  CyberSecOps
                </span>
              </div>
            )}
          </Link>

          {/* Collapse toggle on desktop */}
          <button
            onClick={onToggleCollapse}
            className="hidden lg:flex p-1 rounded-sm text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/50 transition focus:outline-none"
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        </div>

        {/* Scrollable Navigation Items */}
        <nav className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-6">
          {/* Main Section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Operations
              </div>
            )}

            {/* SOC Overview */}
            <Link
              to="/dashboard"
              className={`flex items-center justify-between px-3 py-2 rounded-sm text-xs font-medium transition ${
                isActive('/dashboard')
                  ? 'bg-slate-100 dark:bg-cyber-700/80 text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="SOC Operations Command"
            >
              <div className="flex items-center space-x-3">
                <LayoutDashboard className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span>SOC Overview</span>}
              </div>
            </Link>

            {/* Threat Stream (Dedicated Route) */}
            <Link
              to="/threats"
              className={`flex items-center justify-between px-3 py-2 rounded-sm text-xs font-medium transition ${
                isActive('/threats')
                  ? 'bg-slate-100 dark:bg-cyber-700/80 text-slate-900 dark:text-white font-semibold'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-slate-900 dark:hover:text-white'
              }`}
              title="Real-Time Threat Stream"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <Radio className="w-4 h-4 flex-shrink-0 text-rose-500" />
                {!isCollapsed && <span className="truncate">Threat Stream</span>}
              </div>
              {!isCollapsed && (
                <span className="px-1.5 py-0.5 rounded-sm font-mono text-[10px] bg-slate-200 dark:bg-cyber-700 text-slate-700 dark:text-slate-300 font-bold">
                  {activeThreatCount}
                </span>
              )}
            </Link>

            {/* Org Devices */}
            <Link
              to="/dashboard#devices"
              className="flex items-center justify-between px-3 py-2 rounded-sm text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-slate-900 dark:hover:text-white transition"
              title="Monitored Endpoint Fleet"
            >
              <div className="flex items-center space-x-3 min-w-0">
                <Laptop className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span className="truncate">Org Devices</span>}
              </div>
              {!isCollapsed && (
                <span className="px-1.5 py-0.5 rounded-sm font-mono text-[10px] bg-slate-200 dark:bg-cyber-700 text-slate-600 dark:text-slate-400">
                  {endpointCount}
                </span>
              )}
            </Link>

            {/* Geolocation Map */}
            <Link
              to="/dashboard#branches"
              className="flex items-center space-x-3 px-3 py-2 rounded-sm text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-slate-900 dark:hover:text-white transition"
              title="Branch Geolocation"
            >
              <MapPin className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>Geolocation Map</span>}
            </Link>
          </div>

          {/* Forensics & Directives Section */}
          <div className="space-y-1">
            {!isCollapsed && (
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Forensics &amp; Response
              </div>
            )}

            {/* Threat Hunting */}
            <button
              onClick={openHunting}
              className="w-full flex items-center justify-between px-3 py-2 rounded-sm text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-slate-900 dark:hover:text-white transition"
              title="Threat Hunting Engine"
            >
              <div className="flex items-center space-x-3">
                <Search className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span>Threat Hunting</span>}
              </div>
              {!isCollapsed && (
                <span className="px-1.5 py-0.5 rounded-sm font-mono text-[9px] bg-slate-200 dark:bg-cyber-700 font-semibold">
                  HUNT
                </span>
              )}
            </button>

            {/* Export Incident PDF */}
            <button
              onClick={openReport}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-sm text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-slate-900 dark:hover:text-white transition"
              title="Export Incident Report"
            >
              <FileText className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>Export Signed PDF</span>}
            </button>

            {/* Verify PDF Signature */}
            <button
              onClick={openVerify}
              className="w-full flex items-center space-x-3 px-3 py-2 rounded-sm text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-slate-900 dark:hover:text-white transition"
              title="Verify Ed25519 Report Signature"
            >
              <ShieldCheck className="w-4 h-4 flex-shrink-0" />
              {!isCollapsed && <span>Verify Signature</span>}
            </button>

            {/* Audit Trail */}
            <button
              onClick={toggleAudit}
              className="w-full flex items-center justify-between px-3 py-2 rounded-sm text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-slate-900 dark:hover:text-white transition"
              title="Access Audit Log"
            >
              <div className="flex items-center space-x-3">
                <ClipboardList className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span>Audit Trail</span>}
              </div>
              {!isCollapsed && (
                <span className="font-mono text-[10px] text-slate-400">
                  {auditCount}
                </span>
              )}
            </button>

            {/* Alert Webhooks */}
            <button
              onClick={openWebhooks}
              className="w-full flex items-center justify-between px-3 py-2 rounded-sm text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-slate-900 dark:hover:text-white transition"
              title="SIEM & Webhooks Forwarding"
            >
              <div className="flex items-center space-x-3">
                <Bell className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && <span>Alert Webhooks</span>}
              </div>
              {!isCollapsed && (
                <span className="px-1.5 py-0.5 rounded-sm font-mono text-[9px] bg-slate-200 dark:bg-cyber-700 font-semibold">
                  SIEM
                </span>
              )}
            </button>
          </div>
        </nav>

        {/* Sidebar Footer & Theme Toggles */}
        <div className="p-3 border-t border-slate-200 dark:border-cyber-700/60 bg-slate-50 dark:bg-cyber-900/40 flex-shrink-0">
          {!isCollapsed ? (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                Theme
              </div>
              <div className="grid grid-cols-3 gap-1 bg-slate-200 dark:bg-cyber-700/60 p-1 rounded-sm text-[11px] font-medium text-slate-600 dark:text-slate-300">
                <button
                  onClick={() => setTheme('light')}
                  className={`py-1 rounded-sm flex items-center justify-center space-x-1 transition ${
                    theme === 'light'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`py-1 rounded-sm flex items-center justify-center space-x-1 transition ${
                    theme === 'dark'
                      ? 'bg-cyber-600 text-white shadow-xs font-bold'
                      : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={`py-1 rounded-sm flex items-center justify-center space-x-1 transition ${
                    theme === 'system'
                      ? 'bg-white dark:bg-cyber-600 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Auto</span>
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="w-full py-2 flex items-center justify-center text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition"
              title="Toggle Theme"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}
        </div>
      </aside>
    </>
  );
};
