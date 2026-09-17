import React, { useState, useEffect } from 'react';
import { MetricsRibbon } from '../components/dashboard/MetricsRibbon';
import { MitreChartCard } from '../components/dashboard/MitreChartCard';
import { DevicesTableCard } from '../components/dashboard/DevicesTableCard';
import { GeolocationMapCard } from '../components/dashboard/GeolocationMapCard';
import { ThreatStreamFeed } from '../components/threats/ThreatStreamFeed';
import { Alert, AlertStats, Device } from '../types';
import { api } from '../services/api';
import { useArgusWebSocket } from '../services/websocket';

export const DashboardPage: React.FC = () => {
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [auditCount, setAuditCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const loadData = () => {
    Promise.all([
      api.getAlertStats().then(setStats).catch(() => {}),
      api.getDevices().then(setDevices).catch(() => {}),
      api.getAlerts(25).then(setAlerts).catch(() => {}),
      api.getAuditLogs(10).then(a => setAuditCount(a.length)).catch(() => {})
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  useArgusWebSocket((data) => {
    if (data.type === 'NEW_ALERT' || data.type === 'DEVICE_UPDATE') {
      loadData();
    }
  });

  return (
    <div className="space-y-5">
      {/* 5-Card Metrics Ribbon */}
      <MetricsRibbon stats={stats} deviceCount={devices.length} auditCount={auditCount} />

      {/* Main Operational Stage Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 8 columns: Live Threat Stream */}
        <div className="lg:col-span-8 space-y-5">
          <ThreatStreamFeed />
          <DevicesTableCard devices={devices} loading={loading} />
        </div>

        {/* Right 4 columns: MITRE Tactics Matrix & Geolocation Map */}
        <div className="lg:col-span-4 space-y-5">
          <MitreChartCard alerts={alerts} />
          <GeolocationMapCard devices={devices} />
        </div>
      </div>
    </div>
  );
};
