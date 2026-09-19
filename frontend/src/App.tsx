import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ModalProvider } from './context/ModalContext';
import { LoadingProvider } from './context/LoadingContext';
import { TopProgressBar } from './components/common/TopProgressBar';
import { GlobalTooltip } from './components/common/CustomTooltip';
import { AppLayout } from './components/layout/AppLayout';
import { DashboardPage } from './pages/DashboardPage';
import { ThreatStreamPage } from './pages/ThreatStreamPage';
import { DevicesPage } from './pages/DevicesPage';
import { GeolocationPage } from './pages/GeolocationPage';
import { ForensicsPage } from './pages/ForensicsPage';
import { LandingPage } from './pages/LandingPage';
import { SystemHealthPage } from './pages/SystemHealthPage';
import { NetworkConnectionsPage } from './pages/NetworkConnectionsPage';
import { UsbHistoryPage } from './pages/UsbHistoryPage';
import { IncidentTimelinePage } from './pages/IncidentTimelinePage';
import { NetworkScannerPage } from './pages/NetworkScannerPage';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <ModalProvider>
        <BrowserRouter>
          <LoadingProvider>
            <TopProgressBar />
            <GlobalTooltip />
            <Routes>
              {/* Public Landing Page */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/landing" element={<LandingPage />} />

              {/* Authenticated SOC App Layout */}
              <Route element={<AppLayout />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/console" element={<Navigate to="/dashboard" replace />} />
                <Route path="/threats" element={<ThreatStreamPage />} />
                <Route path="/devices" element={<DevicesPage />} />
                <Route path="/branches" element={<GeolocationPage />} />
                <Route path="/map" element={<Navigate to="/branches" replace />} />
                <Route path="/forensics" element={<ForensicsPage />} />
                <Route path="/system" element={<SystemHealthPage />} />
                <Route path="/connections" element={<NetworkConnectionsPage />} />
                <Route path="/scanner" element={<NetworkScannerPage />} />
                <Route path="/usb-history" element={<UsbHistoryPage />} />
                <Route path="/timeline" element={<IncidentTimelinePage />} />
              </Route>

              {/* Catch-All Fallback */}
              <Route path="*" element={<Navigate to="/dashboard" replace />} />
            </Routes>
          </LoadingProvider>
        </BrowserRouter>
      </ModalProvider>
    </ThemeProvider>
  );
};

export default App;
