import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Activity,
  FileText,
  ShieldCheck,
  ClipboardList,
  ChevronDown,
  Sun,
  Moon,
  Monitor,
  Settings,
  Lock,
  RotateCcw,
  Home,
  Menu,
  Shield,
  ChevronRight
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useModals } from '../../context/ModalContext';
import { UserProfile } from '../../types';
import { api } from '../../services/api';

interface TopNavProps {
  onToggleSidebar?: () => void;
  onResetLayout?: () => void;
  isSidebarCollapsed?: boolean;
}

export const TopNav: React.FC<TopNavProps> = ({ onToggleSidebar, onResetLayout, isSidebarCollapsed }) => {
  const location = useLocation();
  const { theme, setTheme, toggleTheme, isDark } = useTheme();
  const { openReport, openVerify, toggleAudit, openSettings, alert } = useModals();

  const [user, setUser] = useState<UserProfile>({
    user_id: 'AG-ARG01-0001',
    full_name: 'Alex Mercer',
    role: 'SOC Lead Analyst',
    organization_name: 'Argus SecOps'
  });
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.getUserProfile().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const isThreatsPage = location.pathname.startsWith('/threats');

  // Dynamic breadcrumb generation based on SPA route & hash
  const getBreadcrumbs = () => {
    const path = location.pathname;
    const hash = location.hash;

    if (path.startsWith('/threats')) {
      return {
        root: { label: 'SOC', path: '/dashboard' },
        category: 'Threat Grid',
        leaf: 'Live Feed'
      };
    }

    if (path.startsWith('/devices')) {
      return {
        root: { label: 'SOC', path: '/dashboard' },
        category: 'Operations',
        leaf: 'Org Devices'
      };
    }

    if (path.startsWith('/landing') || path === '/') {
      return {
        root: { label: 'ARGUS', path: '/' },
        category: 'Gateway',
        leaf: 'Executive'
      };
    }

    let leaf = 'Overview';
    if (hash === '#devices') leaf = 'Endpoint Fleet';
    else if (hash === '#forensics') leaf = 'Forensics Bridge';
    else if (hash === '#branches') leaf = 'Geolocation Grid';

    return {
      root: { label: 'SOC', path: '/dashboard' },
      category: 'Operations',
      leaf
    };
  };

  const breadcrumbs = getBreadcrumbs();

  const handleLockSession = () => {
    setProfileOpen(false);
    alert({
      title: 'SOC Session Locked',
      badge: 'SECURITY SUSPENSION',
      message: 'Your operational console has been locked. Re-authenticate to access sensitive telemetry.',
      type: 'warning',
      confirmText: 'Acknowledge'
    });
  };

  return (
    <header className="h-16 flex-shrink-0 bg-white dark:bg-cyber-card border-b border-slate-200 dark:border-cyber-700/60 px-2 sm:px-3 flex items-center justify-between z-30 transition-colors">
      {/* Left: Mobile Sidebar Toggle + Breadcrumb Navigation */}
      <div className="flex items-center space-x-2 sm:space-x-2.5">
        <button
          onClick={onToggleSidebar}
          data-tooltip={isSidebarCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
          className="p-1 rounded-sm text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400 transition-colors focus:outline-none cursor-pointer"
          title={isSidebarCollapsed ? "Expand Sidebar (Ctrl+B)" : "Collapse Sidebar (Ctrl+B)"}
        >
          <Menu className="w-4 h-4" />
        </button>

        {/* Unique Cyber-Tactical Breadcrumbs */}
        <nav aria-label="Breadcrumbs" className="hidden sm:flex items-center space-x-2 text-xs font-mono select-none">
          <Link
            to={breadcrumbs.root.path}
            className="font-bold text-slate-700 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors focus:outline-none"
            title="Root Console"
          >
            {breadcrumbs.root.label}
          </Link>

          <ChevronRight className="w-3 h-3 text-slate-400 dark:text-cyber-500 flex-shrink-0" />

          <span className="text-slate-500 dark:text-slate-400 font-medium tracking-tight">
            {breadcrumbs.category}
          </span>

          <ChevronRight className="w-3 h-3 text-slate-400 dark:text-cyber-500 flex-shrink-0" />

          <span className="inline-flex items-center space-x-1.5 text-blue-600 dark:text-blue-400 font-bold tracking-tight">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
            <span>{breadcrumbs.leaf}</span>
          </span>
        </nav>

        {/* Vertical Divider */}
        <div className="h-4 w-px bg-slate-200 dark:bg-cyber-700/70 hidden md:block mx-1"></div>

        {/* Left action group: Borderless buttons separated by border-r, hover text color change */}
        <div className="flex items-center text-xs sm:text-[13px] font-medium">
          {isThreatsPage ? (
            <Link
              to="/dashboard"
              className="px-2.5 sm:px-3 py-1 border-r border-slate-200 dark:border-cyber-700/70 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 transition-colors flex items-center space-x-1.5 group focus:outline-none"
              title="Return to SOC Dashboard"
            >
              <Activity className="w-3.5 h-3.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              <span>Dashboard</span>
            </Link>
          ) : (
            <button
              onClick={() => {
                if (onResetLayout) onResetLayout();
                window.dispatchEvent(new CustomEvent('artis-reset-layout'));
              }}
              className="px-2.5 sm:px-3 py-1 border-r border-slate-200 dark:border-cyber-700/70 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 transition-colors flex items-center space-x-1.5 group focus:outline-none"
              title="Reset dashboard panels to default layout"
              data-tooltip="Reset dashboard panels to default layout"
            >
              <RotateCcw className="w-3.5 h-3.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
              <span>Reset Layout</span>
            </button>
          )}

          <Link
            to="/landing"
            className="px-2.5 sm:px-3 py-1 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 transition-colors flex items-center space-x-1.5 group focus:outline-none"
            title="Return to Executive Landing Page"
            data-tooltip="Return to Executive Landing Page"
          >
            <Home className="w-3.5 h-3.5 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            <span>Landing Page</span>
          </Link>
        </div>
      </div>

      {/* Right: Border-Divided Toolbars (Export PDF | Verify | Audit | Theme) + User Profile */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Right action group: Borderless buttons separated by border-r, hover text color change */}
        <div className="flex items-center text-xs sm:text-[13px] font-medium">
          <button
            onClick={openReport}
            data-tooltip="Export Signed Incident PDF Report"
            className="px-2.5 sm:px-3 py-1 border-r border-slate-200 dark:border-cyber-700/70 flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 transition-colors group focus:outline-none"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            <span className="hidden sm:inline">Export PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={openVerify}
            data-tooltip="Verify Cryptographic Report Signature"
            className="px-2.5 sm:px-3 py-1 border-r border-slate-200 dark:border-cyber-700/70 flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 transition-colors group focus:outline-none"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors" />
            <span>Verify</span>
          </button>
          <button
            onClick={toggleAudit}
            data-tooltip="Inspect SOC Audit Trail"
            className="px-2.5 sm:px-3 py-1 border-r border-slate-200 dark:border-cyber-700/70 flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 transition-colors group focus:outline-none"
          >
            <span>Audit</span>
          </button>
          <button
            onClick={toggleTheme}
            data-tooltip={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
            className="px-2.5 sm:px-3 py-1 flex items-center space-x-1.5 text-slate-600 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 focus:text-blue-600 dark:focus:text-blue-400 transition-colors group focus:outline-none capitalize font-mono text-xs"
          >
            <span>{isDark ? 'dark' : 'light'}</span>
          </button>
        </div>

        {/* Vertical Divider */}
        <div className="h-5 w-px bg-slate-200 dark:bg-cyber-700/70 hidden sm:block"></div>

        {/* User Profile Dropdown Button & Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileOpen(!profileOpen)}
            className="flex items-center space-x-1.5 p-0.5 pr-1.5 rounded-sm hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition focus:outline-none"
          >
            <div className="relative flex-shrink-0">
              <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-xs flex items-center justify-center shadow-xs">
                {user.full_name.charAt(0)}
              </div>
              <span className="absolute bottom-0 right-0 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-cyber-800"></span>
            </div>
            <div className="hidden sm:flex flex-col text-left leading-tight">
              <span className="text-xs font-bold text-slate-900 dark:text-white truncate max-w-[110px]">
                {user.full_name}
              </span>
              <span className="text-[10px] font-mono text-slate-500 dark:text-slate-400">
                {user.user_id}
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 ${
                profileOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {/* Dropdown Card */}
          {profileOpen && (
            <div className="absolute right-0 mt-2 w-72 bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700 rounded-sm shadow-2xl z-[70] py-1.5 divide-y divide-slate-100 dark:divide-cyber-700/50 text-xs">
              {/* Identity Card */}
              <div className="p-3.5 flex items-center space-x-3 bg-slate-50 dark:bg-cyber-800/40">
                <div className="relative flex-shrink-0">
                  <div className="w-11 h-11 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-sm flex items-center justify-center shadow">
                    {user.full_name.charAt(0)}
                  </div>
                  <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-cyber-card"></span>
                </div>
                <div className="min-w-0 flex-1">
                  <h4 className="font-bold text-sm text-slate-900 dark:text-white truncate">{user.full_name}</h4>
                  <div className="flex items-center space-x-1 text-[11px] font-mono text-slate-600 dark:text-slate-400">
                    <span>ID:</span>
                    <span className="font-semibold text-slate-800 dark:text-slate-200">{user.user_id}</span>
                  </div>
                  <div className="flex items-center space-x-2 mt-1 text-[10px]">
                    <span className="font-semibold text-slate-700 dark:text-slate-300">
                      {user.role.toUpperCase()}
                    </span>
                    <span className="text-slate-400 dark:text-slate-600">&bull;</span>
                    <span className="font-mono text-slate-500 dark:text-slate-400 truncate">
                      {user.organization_name}
                    </span>
                  </div>
                </div>
              </div>

              {/* Theme Preference Inside Dropdown */}
              <div className="p-3 space-y-1.5">
                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-0.5">
                  Theme Preference
                </div>
                <div className="grid grid-cols-3 gap-1 bg-slate-100 dark:bg-cyber-800/80 p-1 rounded-sm text-[11px] font-medium text-slate-600 dark:text-slate-300">
                  <button
                    onClick={() => setTheme('light')}
                    className={`py-1 rounded-sm flex items-center justify-center space-x-1 transition ${
                      theme === 'light'
                        ? 'bg-white dark:bg-cyber-600 text-slate-900 dark:text-white shadow-xs font-semibold'
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
                        ? 'bg-white dark:bg-cyber-600 text-slate-900 dark:text-white shadow-xs font-semibold'
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
                        ? 'bg-white dark:bg-cyber-600 text-slate-900 dark:text-white shadow-xs font-semibold'
                        : 'hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Auto</span>
                  </button>
                </div>
              </div>

              {/* Menu Options: Settings & Audit */}
              <div className="py-1 px-1 space-y-0.5">
                <button
                  onClick={() => {
                    openSettings();
                    setProfileOpen(false);
                  }}
                  className="w-full text-left flex items-center space-x-2.5 px-3 py-2 rounded-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition"
                >
                  <Settings className="w-4 h-4 text-slate-500" />
                  <span>SOC &amp; Account Settings</span>
                </button>
                <button
                  onClick={() => {
                    toggleAudit();
                    setProfileOpen(false);
                  }}
                  className="w-full text-left flex items-center space-x-2.5 px-3 py-2 rounded-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition"
                >
                  <ClipboardList className="w-4 h-4 text-slate-500" />
                  <span>My Audit Trail</span>
                </button>
              </div>

              {/* Lock Session Action */}
              <div className="p-1">
                <button
                  onClick={handleLockSession}
                  className="w-full text-left flex items-center space-x-2.5 px-3 py-2 rounded-sm text-red-600 dark:text-red-400 hover:bg-red-500/10 transition font-medium"
                >
                  <Lock className="w-4 h-4" />
                  <span>Lock Session</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
