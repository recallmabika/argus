import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  LayoutDashboard,
  Radio,
  MapPin,
  FileText,
  ShieldCheck,
  ClipboardList,
  Search,
  Bell,
  Microscope,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Monitor,
  Cpu,
  Network,
  Usb,
  Clock,
  Radar
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { useArgusWebSocket } from '../../services/websocket';
import { DeviceForensicBadge } from '../common/DeviceForensicBadge';

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
  const { theme, setTheme, isDark } = useTheme();
  const { openReport, openVerify, toggleAudit, openHunting, openWebhooks } = useModals();

  const [activeThreatCount, setActiveThreatCount] = useState<number>(0);
  const [endpointCount, setEndpointCount] = useState<number>(0);
  const [auditCount, setAuditCount] = useState<number>(0);
  const [forensicCount, setForensicCount] = useState<number>(0);

  const loadMetrics = () => {
    api.getAlertStats().then(s => setActiveThreatCount(s.open || 0)).catch(() => {});
    api.getDevices().then(d => setEndpointCount(d.length || 0)).catch(() => {});
    api.getAuditLogs(10).then(a => setAuditCount(a.length || 0)).catch(() => {});
    api.getForensicDevices().then(f => setForensicCount(f.devices?.length || 0)).catch(() => {});
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

  const isHashActive = (hash: string) => {
    return (location.pathname === '/dashboard' || location.pathname === '/') && location.hash === hash;
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
        <div
          className={`h-16 flex items-center border-b border-slate-200 dark:border-cyber-700/60 flex-shrink-0 transition-all ${
            isCollapsed ? 'justify-center px-1.5' : 'justify-between px-3.5'
          }`}
        >
          {isCollapsed ? (
            <button
              onClick={onToggleCollapse}
              className="flex items-center justify-center p-1.5 rounded-sm hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition group cursor-pointer"
              title="Expand Sidebar (Ctrl+B)"
            >
              <img
                src="/img/logo.jpg"
                alt="ARTIS Logo"
                className="h-10 w-10 object-contain rounded-sm shadow-xs group-hover:scale-105 transition-transform"
                onError={(e) => {
                  const target = e.currentTarget;
                  target.src = '/static/img/logo.jpg';
                }}
              />
            </button>
          ) : (
            <>
              <Link
                to="/dashboard"
                className="flex items-center space-x-2.5 overflow-hidden group"
                title="ARTIS Incident Security"
              >
                <img
                  src="/img/logo.jpg"
                  alt="ARTIS Logo"
                  className="h-10 w-auto rounded-sm object-contain flex-shrink-0 shadow-xs group-hover:scale-105 transition-transform"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.src = '/static/img/logo.jpg';
                  }}
                />
                <div className="flex flex-col min-w-0">
                  <span className="font-black text-base tracking-widest text-slate-900 dark:text-white uppercase leading-none">
                    ARTIS
                  </span>
                  <span className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5 tracking-wider truncate">
                    Incident Security
                  </span>
                </div>
              </Link>
              <button
                onClick={onToggleCollapse}
                className="hidden lg:flex p-1.5 rounded-sm text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-slate-100 dark:hover:bg-cyber-700/50 transition focus:outline-none focus:text-blue-600 dark:focus:text-blue-400"
                title="Collapse Sidebar (Ctrl+B)"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </>
          )}
        </div>

        {/* Scrollable Navigation Items */}
        <nav className={`flex-1 overflow-y-auto custom-scrollbar space-y-5 ${isCollapsed ? 'p-1.5' : 'p-3'}`}>
          {/* Operations Section */}
          <div className="space-y-1.5">
            {!isCollapsed && (
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Operations
              </div>
            )}

            {/* SOC Overview */}
            <Link
              to="/dashboard"
              className={`rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center justify-between px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } ${
                isActive('/dashboard')
                  ? 'bg-slate-100 dark:bg-cyber-700/80 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40'
              }`}
              title="SOC Operations Command"
            >
              <div className={`flex items-center ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <LayoutDashboard className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs'}>
                  {isCollapsed ? 'Overview' : 'SOC Overview'}
                </span>
              </div>
            </Link>

            {/* Threat Stream (Dedicated Route) */}
            <Link
              to="/threats"
              className={`rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center justify-between px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } ${
                isActive('/threats')
                  ? 'bg-slate-100 dark:bg-cyber-700/80 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40'
              }`}
              title="Real-Time Threat Stream"
            >
              <div className={`flex items-center min-w-0 ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <Radio className="w-5 h-5 flex-shrink-0 text-rose-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs truncate'}>
                  {isCollapsed ? 'Threats' : 'Threat Stream'}
                </span>
              </div>
              {!isCollapsed ? (
                <span className="font-sans text-xs font-bold text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {activeThreatCount}
                </span>
              ) : activeThreatCount > 0 ? (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500"></span>
              ) : null}
            </Link>

            {/* Org Devices */}
            <Link
              to="/devices"
              className={`rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center justify-between px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } ${
                isActive('/devices')
                  ? 'bg-slate-100 dark:bg-cyber-700/80 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40'
              }`}
              title="Monitored Endpoint Fleet"
            >
              <div className={`flex items-center min-w-0 ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <Monitor className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs truncate'}>
                  {isCollapsed ? 'Devices' : 'Org Devices'}
                </span>
              </div>
              {!isCollapsed && (
                <span className="font-sans text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {endpointCount}
                </span>
              )}
            </Link>

            {/* Geolocation Map */}
            <Link
              to="/branches"
              className={`rounded-sm transition group focus:outline-none relative ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center space-x-3 px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } ${
                isActive('/branches') || isHashActive('#branches')
                  ? 'bg-slate-100 dark:bg-cyber-700/80 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40'
              }`}
              title="Branch Geolocation Perimeter"
            >
              <div className={`flex items-center ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <MapPin className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs'}>
                  {isCollapsed ? 'GeoMap' : 'Geolocation Map'}
                </span>
              </div>
            </Link>
          </div>

          {/* Forensics & Directives Section */}
          <div className="space-y-1.5">
            {!isCollapsed ? (
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Forensics &amp; Response
              </div>
            ) : (
              <div className="border-t border-slate-200 dark:border-cyber-700/60 my-1 mx-2"></div>
            )}

            {/* Device Forensics Bridge */}
            <Link
              to="/forensics"
              className={`rounded-sm transition group focus:outline-none relative ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center justify-between px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } ${
                isActive('/forensics') || isHashActive('#forensics')
                  ? 'bg-slate-100 dark:bg-cyber-700/80 text-cyan-600 dark:text-cyan-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-cyan-600 dark:hover:text-cyan-400 focus:text-cyan-600 dark:focus:text-cyan-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40'
              }`}
              title="USB Digital Forensics Bridge"
            >
              <div className={`flex items-center min-w-0 ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <Microscope className="w-5 h-5 flex-shrink-0 group-hover:text-cyan-600 dark:group-hover:text-cyan-400 group-focus:text-cyan-600 dark:group-focus:text-cyan-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs truncate'}>
                  {isCollapsed ? 'Forensics' : 'Device Forensics Bridge'}
                </span>
              </div>
              {!isCollapsed ? (
                <DeviceForensicBadge variant="count" count={forensicCount} pulse={forensicCount > 0} />
              ) : forensicCount > 0 ? (
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-cyan-500 animate-pulse"></span>
              ) : null}
            </Link>

            {/* Threat Hunting */}
            <button
              onClick={openHunting}
              className={`w-full rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center space-x-3 px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40`}
              title="Threat Hunting Engine"
            >
              <div className={`flex items-center ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <Search className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs'}>
                  {isCollapsed ? 'Hunt' : 'Threat Hunting'}
                </span>
              </div>
            </button>

            {/* Export Incident PDF */}
            <button
              onClick={openReport}
              className={`w-full rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center space-x-3 px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40`}
              title="Export Incident Report"
            >
              <div className={`flex items-center ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <FileText className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs'}>
                  {isCollapsed ? 'Export' : 'Export Signed PDF'}
                </span>
              </div>
            </button>

            {/* Verify PDF Signature */}
            <button
              onClick={openVerify}
              className={`w-full rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center space-x-3 px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40`}
              title="Verify Ed25519 Report Signature"
            >
              <div className={`flex items-center ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <ShieldCheck className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs'}>
                  {isCollapsed ? 'Verify' : 'Verify Signature'}
                </span>
              </div>
            </button>

            {/* Audit Trail */}
            <button
              onClick={toggleAudit}
              className={`w-full rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center justify-between px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40`}
              title="Access Audit Log"
            >
              <div className={`flex items-center ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <ClipboardList className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs'}>
                  {isCollapsed ? 'Audit' : 'Audit Trail'}
                </span>
              </div>
              {!isCollapsed && (
                <span className="font-sans text-xs font-semibold text-slate-500 dark:text-slate-400 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {auditCount}
                </span>
              )}
            </button>

            {/* Alert Webhooks */}
            <button
              onClick={openWebhooks}
              className={`w-full rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center space-x-3 px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40`}
              title="SIEM & Webhooks Forwarding"
            >
              <div className={`flex items-center ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <Bell className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs'}>
                  {isCollapsed ? 'Webhooks' : 'Alert Webhooks'}
                </span>
              </div>
            </button>
          </div>

          {/* Intelligence & Monitoring Section */}
          <div className="space-y-1.5 mt-5">
            {!isCollapsed ? (
              <div className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Intelligence &amp; Monitoring
              </div>
            ) : (
              <div className="border-t border-slate-200 dark:border-cyber-700/60 my-1 mx-2"></div>
            )}

            {/* System Health */}
            <Link
              to="/system"
              className={`rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center justify-between px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } ${
                isActive('/system')
                  ? 'bg-slate-100 dark:bg-cyber-700/80 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40'
              }`}
              title="System Health"
            >
              <div className={`flex items-center min-w-0 ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <Cpu className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs truncate'}>
                  {isCollapsed ? 'System' : 'System Health'}
                </span>
              </div>
            </Link>

            {/* Network Connections */}
            <Link
              to="/connections"
              className={`rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center justify-between px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } ${
                isActive('/connections')
                  ? 'bg-slate-100 dark:bg-cyber-700/80 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40'
              }`}
              title="Network Connections"
            >
              <div className={`flex items-center min-w-0 ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <Network className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs truncate'}>
                  {isCollapsed ? 'Network' : 'Network Connections'}
                </span>
              </div>
            </Link>

            {/* Port Scanner */}
            <Link
              to="/scanner"
              className={`rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center justify-between px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } ${
                isActive('/scanner')
                  ? 'bg-slate-100 dark:bg-cyber-700/80 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40'
              }`}
              title="Network Port Scanner"
            >
              <div className={`flex items-center min-w-0 ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <Radar className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs truncate'}>
                  {isCollapsed ? 'Scanner' : 'Port Scanner'}
                </span>
              </div>
            </Link>

            {/* USB History */}
            <Link
              to="/usb-history"
              className={`rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center justify-between px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } ${
                isActive('/usb-history')
                  ? 'bg-slate-100 dark:bg-cyber-700/80 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40'
              }`}
              title="USB Device History"
            >
              <div className={`flex items-center min-w-0 ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <Usb className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs truncate'}>
                  {isCollapsed ? 'USB Hist' : 'USB History'}
                </span>
              </div>
            </Link>

            {/* Incident Timeline */}
            <Link
              to="/timeline"
              className={`rounded-sm transition group focus:outline-none ${
                isCollapsed
                  ? 'flex flex-col items-center justify-center py-2.5 px-1 min-h-[52px] text-center'
                  : 'flex items-center justify-between px-3.5 py-3 min-h-[46px] text-xs font-semibold'
              } ${
                isActive('/timeline')
                  ? 'bg-slate-100 dark:bg-cyber-700/80 text-blue-600 dark:text-blue-400 font-bold shadow-xs'
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-cyber-700/40 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 focus:bg-slate-50 dark:focus:bg-cyber-700/40'
              }`}
              title="Incident Timeline"
            >
              <div className={`flex items-center min-w-0 ${isCollapsed ? 'flex-col space-y-1' : 'space-x-3'}`}>
                <Clock className="w-5 h-5 flex-shrink-0 group-hover:text-blue-600 dark:group-hover:text-blue-400 group-focus:text-blue-600 dark:group-focus:text-blue-400 transition-colors" />
                <span className={isCollapsed ? 'text-[9.5px] font-medium leading-none' : 'text-xs truncate'}>
                  {isCollapsed ? 'Timeline' : 'Incident Timeline'}
                </span>
              </div>
            </Link>
          </div>
        </nav>

        {/* Sidebar Footer & Theme Toggles */}
        <div className="p-2.5 border-t border-slate-200 dark:border-cyber-700/60 bg-slate-50 dark:bg-cyber-900/40 flex-shrink-0">
          {!isCollapsed ? (
            <div className="space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-1">
                Theme
              </div>
              <div className="grid grid-cols-3 gap-1 bg-slate-200 dark:bg-cyber-700/60 p-1 rounded-sm text-[11px] font-medium text-slate-600 dark:text-slate-300">
                <button
                  onClick={() => setTheme('light')}
                  className={`py-1.5 rounded-sm flex items-center justify-center space-x-1 transition focus:outline-none ${
                    theme === 'light'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light</span>
                </button>
                <button
                  onClick={() => setTheme('dark')}
                  className={`py-1.5 rounded-sm flex items-center justify-center space-x-1 transition focus:outline-none ${
                    theme === 'dark'
                      ? 'bg-cyber-600 text-white shadow-xs font-bold'
                      : 'hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </button>
                <button
                  onClick={() => setTheme('system')}
                  className={`py-1.5 rounded-sm flex items-center justify-center space-x-1 transition focus:outline-none ${
                    theme === 'system'
                      ? 'bg-white dark:bg-cyber-600 text-slate-900 dark:text-white shadow-xs font-bold'
                      : 'hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400'
                  }`}
                >
                  <Monitor className="w-3.5 h-3.5" />
                  <span>Auto</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center py-1">
              <button
                onClick={() => setTheme(isDark ? 'light' : 'dark')}
                className="w-full py-2 px-1 flex items-center justify-center rounded-sm text-xs font-semibold text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 hover:bg-slate-200 dark:hover:bg-cyber-700/60 transition cursor-pointer focus:outline-none"
                title="Toggle Theme"
              >
                {isDark ? 'dark' : 'light'}
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
