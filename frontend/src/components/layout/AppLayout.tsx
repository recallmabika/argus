import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { TopNav } from './TopNav';
import {
  DeviceModal,
  ReportModal,
  VerifyModal,
  AuditDrawer,
  SettingsModal,
  AttackChainModal,
  ThreatHuntingModal,
  WebhooksModal,
  KillProcessModal,
  MessageBoxModal,
  ForensicStudioModal,
  WirelessConnectModal
} from '../modals';

export const AppLayout: React.FC = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem('artis-sidebar-collapsed') === 'true';
  });

  const toggleCollapse = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem('artis-sidebar-collapsed', String(next));
      return next;
    });
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-50 dark:bg-cyber-900 text-slate-800 dark:text-slate-100 transition-colors">
      {/* Sidebar */}
      <Sidebar
        isOpen={sidebarOpen}
        isCollapsed={sidebarCollapsed}
        onClose={() => setSidebarOpen(false)}
        onToggleCollapse={toggleCollapse}
      />

      {/* Main Column */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        <TopNav onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        {/* Scrollable Page Outlet */}
        <main className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-6 w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Operational Modals */}
      <DeviceModal />
      <ReportModal />
      <VerifyModal />
      <AuditDrawer />
      <SettingsModal />
      <AttackChainModal />
      <ThreatHuntingModal />
      <WebhooksModal />
      <KillProcessModal />
      <MessageBoxModal />
      <ForensicStudioModal />
      <WirelessConnectModal />
    </div>
  );
};
