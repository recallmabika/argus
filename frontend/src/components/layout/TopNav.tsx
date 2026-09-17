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
  Menu
} from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useModals } from '../../context/ModalContext';
import { UserProfile } from '../../types';
import { api } from '../../services/api';

interface TopNavProps {
  onToggleSidebar?: () => void;
  onResetLayout?: () => void;
}

export const TopNav: React.FC<TopNavProps> = ({ onToggleSidebar, onResetLayout }) => {
  const location = useLocation();
  const { theme, setTheme } = useTheme();
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
      {/* Left: Mobile Sidebar Toggle + Navigation / Mode */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        <button
          onClick={onToggleSidebar}
          className="p-1 rounded-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition focus:outline-none"
          title="Toggle Navigation Menu"
        >
          <Menu className="w-4 h-4" />
        </button>

        <h2 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider hidden md:block">
          {isThreatsPage ? 'Live Ingestion Feed' : 'SOC Operations Command'}
        </h2>

        {/* Left action group: Border-divided segmented toolbar with zero background fills and hover states */}
        <div className="flex items-center border border-slate-200 dark:border-cyber-700/70 rounded-sm divide-x divide-slate-200 dark:divide-cyber-700/70 overflow-hidden text-[9.5px] font-mono">
          <span className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-slate-700 dark:text-slate-300 font-semibold flex items-center space-x-1">
            <span className="relative flex h-1.5 w-1.5 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
            <span>{isThreatsPage ? 'LIVE STREAM' : 'LIVE MONITORING'}</span>
          </span>

          {isThreatsPage ? (
            <Link
              to="/dashboard"
              className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition flex items-center space-x-1"
              title="Return to SOC Dashboard"
            >
              <Activity className="w-3 h-3" />
              <span>Dashboard</span>
            </Link>
          ) : (
            <button
              onClick={() => {
                if (onResetLayout) onResetLayout();
                window.dispatchEvent(new CustomEvent('artis-reset-layout'));
              }}
              className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition flex items-center space-x-1"
              title="Reset dashboard panels to default layout"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Layout</span>
            </button>
          )}

          <a
            href="/landing"
            className="px-2 py-0.5 sm:px-2.5 sm:py-1 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition flex items-center space-x-1"
            title="Return to Executive Landing Page"
          >
            <Home className="w-3 h-3" />
            <span>Landing Page</span>
          </a>
        </div>
      </div>

      {/* Right: Border-Divided Toolbars (Export PDF | Verify | Audit) + User Profile */}
      <div className="flex items-center space-x-1.5 sm:space-x-2">
        {/* Right action group: Border-divided segmented toolbar with zero background fills */}
        <div className="flex items-center border border-slate-200 dark:border-cyber-700/70 rounded-sm divide-x divide-slate-200 dark:divide-cyber-700/70 overflow-hidden text-[11px]">
          <button
            onClick={openReport}
            className="px-2 py-1 sm:px-2.5 sm:py-1 flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition"
          >
            <FileText className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span className="hidden sm:inline">Export PDF</span>
            <span className="sm:hidden">PDF</span>
          </button>
          <button
            onClick={openVerify}
            className="px-2 py-1 sm:px-2.5 sm:py-1 flex items-center space-x-1 font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
            <span>Verify</span>
          </button>
          <button
            onClick={toggleAudit}
            className="px-2 py-1 sm:px-2.5 sm:py-1 font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-cyber-700/60 transition"
          >
            <span>Audit</span>
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
              <div className="w-8 h-8 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-xs flex items-center justify-center border border-slate-300 dark:border-cyber-600">
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
                  <div className="flex items-center space-x-1.5 mt-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded-sm font-semibold bg-slate-200 dark:bg-white/10 text-slate-900 dark:text-white border border-slate-300 dark:border-white/20">
                      {user.role.toUpperCase()}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-sm font-mono bg-slate-200 dark:bg-cyber-700 text-slate-600 dark:text-slate-300 truncate">
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
