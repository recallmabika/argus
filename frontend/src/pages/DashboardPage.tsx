import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { MetricsRibbon } from '../components/dashboard/MetricsRibbon';
import { MitreChartCard } from '../components/dashboard/MitreChartCard';
import { DevicesTableCard } from '../components/dashboard/DevicesTableCard';
import { GeolocationMapCard } from '../components/dashboard/GeolocationMapCard';
import { ThreatStreamFeed } from '../components/threats/ThreatStreamFeed';
import { ForensicsBridgeWorkstation } from '../components/dashboard/ForensicsBridgeWorkstation';
import { Alert, AlertStats, Device } from '../types';
import { api } from '../services/api';
import { useArgusWebSocket } from '../services/websocket';

type CardId = 'threats' | 'matrix' | 'devices' | 'branches';

interface LayoutSlots {
  slot1: CardId; // Upper Primary Stage (2 cols)
  slot2: CardId; // Upper Secondary (1 col)
  slot3: CardId; // Lower Primary / Devices (2 cols)
  slot4: CardId; // Lower Secondary / Map (1 col)
}

const DEFAULT_LAYOUT: LayoutSlots = {
  slot1: 'threats',
  slot2: 'matrix',
  slot3: 'devices',
  slot4: 'branches'
};

export const DashboardPage: React.FC = () => {
  const location = useLocation();
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [auditCount, setAuditCount] = useState(0);
  const [loading, setLoading] = useState(true);

  // Layout slots state with localStorage persistence
  const [layout, setLayout] = useState<LayoutSlots>(() => {
    try {
      const saved = localStorage.getItem('artis-dashboard-layout');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.slot1 && parsed.slot2 && parsed.slot3 && parsed.slot4) {
          return parsed;
        }
      }
    } catch {
      // ignore
    }
    return DEFAULT_LAYOUT;
  });

  const [draggedCard, setDraggedCard] = useState<CardId | null>(null);
  const [dragOverSlot, setDragOverSlot] = useState<string | null>(null);
  const [pulseCard, setPulseCard] = useState<CardId | null>(null);

  const saveLayout = (nextLayout: LayoutSlots) => {
    setLayout(nextLayout);
    try {
      localStorage.setItem('artis-dashboard-layout', JSON.stringify(nextLayout));
    } catch {
      // ignore
    }
  };

  const resetLayout = () => {
    saveLayout(DEFAULT_LAYOUT);
  };

  useEffect(() => {
    const handleReset = () => resetLayout();
    window.addEventListener('artis-reset-layout', handleReset);
    return () => window.removeEventListener('artis-reset-layout', handleReset);
  }, []);

  const loadData = () => {
    Promise.all([
      api.getAlertStats().then(setStats).catch(() => {}),
      api.getDevices().then(setDevices).catch(() => {}),
      api.getAlerts(25).then(setAlerts).catch(() => {}),
      api.getAuditLogs(10).then((a) => setAuditCount(a.length)).catch(() => {})
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

  // Smooth scroll and pulse target panel when hash is present
  useEffect(() => {
    if (!location.hash) return;
    const targetId = location.hash.replace('#', '');
    const element = document.getElementById(targetId);
    if (element) {
      setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
        element.classList.add('ring-2', 'ring-blue-500/60', 'transition-all');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-500/60');
        }, 1500);
      }, 150);
    }
  }, [location.hash]);

  // Pull any card into Slot 1 (the main 2-col primary stage)
  const pullToMain = (cardId: CardId) => {
    if (layout.slot1 === cardId) return; // already main stage

    const oldMain = layout.slot1;
    const next: LayoutSlots = {
      slot1: cardId,
      slot2: layout.slot2 === cardId ? oldMain : layout.slot2,
      slot3: layout.slot3 === cardId ? oldMain : layout.slot3,
      slot4: layout.slot4 === cardId ? oldMain : layout.slot4
    };

    setPulseCard(cardId);
    setTimeout(() => setPulseCard(null), 800);
    saveLayout(next);
  };

  // Drag and drop between any two slots
  const handleDrop = (targetSlot: keyof LayoutSlots) => {
    if (!draggedCard) return;

    let sourceSlot: keyof LayoutSlots | null = null;
    if (layout.slot1 === draggedCard) sourceSlot = 'slot1';
    else if (layout.slot2 === draggedCard) sourceSlot = 'slot2';
    else if (layout.slot3 === draggedCard) sourceSlot = 'slot3';
    else if (layout.slot4 === draggedCard) sourceSlot = 'slot4';

    if (!sourceSlot || sourceSlot === targetSlot) {
      setDraggedCard(null);
      setDragOverSlot(null);
      return;
    }

    const targetCard = layout[targetSlot];
    const next: LayoutSlots = {
      slot1: targetSlot === 'slot1' ? draggedCard : (sourceSlot === 'slot1' ? targetCard : layout.slot1),
      slot2: targetSlot === 'slot2' ? draggedCard : (sourceSlot === 'slot2' ? targetCard : layout.slot2),
      slot3: targetSlot === 'slot3' ? draggedCard : (sourceSlot === 'slot3' ? targetCard : layout.slot3),
      slot4: targetSlot === 'slot4' ? draggedCard : (sourceSlot === 'slot4' ? targetCard : layout.slot4)
    };

    setPulseCard(draggedCard);
    setTimeout(() => setPulseCard(null), 800);
    saveLayout(next);
    setDraggedCard(null);
    setDragOverSlot(null);
  };

  const renderCard = (cardId: CardId, isMainStage: boolean) => {
    switch (cardId) {
      case 'threats':
        return (
          <ThreatStreamFeed
            isMainStage={isMainStage}
            onPullToMain={() => pullToMain('threats')}
          />
        );
      case 'matrix':
        return (
          <MitreChartCard
            alerts={alerts}
            isMainStage={isMainStage}
            onPullToMain={() => pullToMain('matrix')}
          />
        );
      case 'devices':
        return (
          <DevicesTableCard
            devices={devices}
            loading={loading}
            isMainStage={isMainStage}
            onPullToMain={() => pullToMain('devices')}
          />
        );
      case 'branches':
        return (
          <GeolocationMapCard
            devices={devices}
            isMainStage={isMainStage}
            onPullToMain={() => pullToMain('branches')}
          />
        );
    }
  };

  const renderSlot = (slotKey: keyof LayoutSlots, colSpan: string, minHeight: string) => {
    const cardId = layout[slotKey];
    const isMain = slotKey === 'slot1';
    const isDragOver = dragOverSlot === slotKey;
    const isPulsing = pulseCard === cardId;

    return (
      <div
        id={slotKey}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOverSlot(slotKey);
        }}
        onDragLeave={() => {
          if (dragOverSlot === slotKey) setDragOverSlot(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          handleDrop(slotKey);
        }}
        className={`panel-slot ${colSpan} ${minHeight} flex flex-col transition-all duration-200 ${
          isDragOver ? 'ring-2 ring-slate-900 dark:ring-white bg-slate-900/5 dark:bg-white/5 rounded-sm' : ''
        }`}
      >
        <div
          draggable
          onDragStart={(e) => {
            setDraggedCard(cardId);
            e.dataTransfer.setData('text/plain', cardId);
          }}
          onDragEnd={() => {
            setDraggedCard(null);
            setDragOverSlot(null);
          }}
          className={`panel-card w-full h-full flex flex-col flex-1 transition-all duration-200 ${
            draggedCard === cardId ? 'opacity-40 scale-[0.98]' : ''
          } ${isPulsing ? 'ring-2 ring-slate-900 dark:ring-white ring-offset-2 rounded-sm' : ''}`}
        >
          {renderCard(cardId, isMain)}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* 5-Card Metrics Ribbon */}
      <MetricsRibbon
        stats={stats}
        deviceCount={devices.length}
        auditCount={auditCount}
        branchCount={new Set(devices.map((d) => d.branch_name).filter(Boolean)).size}
      />

      {/* Upper Modular Section: Slots 1 & 2 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {renderSlot('slot1', 'lg:col-span-2', 'min-h-[380px] lg:min-h-[420px]')}
        {renderSlot('slot2', 'lg:col-span-1', 'min-h-[380px] lg:min-h-[420px]')}
      </div>

      {/* Lower Modular Section: Slots 3 & 4 (Device Manager & Geolocation Map by default) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {renderSlot('slot3', 'lg:col-span-2', 'min-h-[380px] lg:min-h-[420px]')}
        {renderSlot('slot4', 'lg:col-span-1', 'min-h-[380px] lg:min-h-[420px]')}
      </div>

      {/* Digital Forensics & Hardware Bridge Workstation */}
      <ForensicsBridgeWorkstation />
    </div>
  );
};
