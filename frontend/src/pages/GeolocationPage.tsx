import React, { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import {
  MapPin,
  Search,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Monitor,
  Navigation,
  Compass,
  Building2,
  ChevronRight,
  Crosshair,
  ExternalLink,
  Eye
} from 'lucide-react';
import { Device } from '../types';
import { api } from '../services/api';
import { useArgusWebSocket } from '../services/websocket';
import { useTheme } from '../context/ThemeContext';
import { useModals } from '../context/ModalContext';
import { DeviceForensicBadge } from '../components/common/DeviceForensicBadge';

interface BranchSummary {
  name: string;
  lat: number;
  lng: number;
  devices: Device[];
  maxRisk: number;
  onlineCount: number;
}

export const GeolocationPage: React.FC = () => {
  const { isDark } = useTheme();
  const { openDeviceDetail } = useModals();

  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [riskFilter, setRiskFilter] = useState<'ALL' | 'CRITICAL' | 'ELEVATED' | 'NORMAL'>('ALL');
  const [selectedBranchName, setSelectedBranchName] = useState<string | null>(null);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const fetchFleet = async () => {
    try {
      const data = await api.getDevices();
      setDevices(data);
    } catch (err) {
      console.error('Failed to load device fleet for geolocation:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFleet();
    const interval = setInterval(fetchFleet, 12000);
    return () => clearInterval(interval);
  }, []);

  useArgusWebSocket((data) => {
    if (data.type === 'DEVICE_UPDATE' || data.type === 'NEW_ALERT') {
      fetchFleet();
    }
  });

  // Global popup inspector callback
  useEffect(() => {
    (window as any).__argusInspectFromMap = (deviceId: string) => {
      const dev = devices.find((d) => d.id === deviceId);
      if (dev) openDeviceDetail(dev.id);
    };
    return () => {
      delete (window as any).__argusInspectFromMap;
    };
  }, [devices, openDeviceDetail]);

  // Aggregate devices into branch clusters
  const branches: BranchSummary[] = useMemo(() => {
    const branchMap = new Map<string, BranchSummary>();

    devices.forEach((d) => {
      const lat = Number(d.latitude);
      const lng = Number(d.longitude);
      if (isNaN(lat) || isNaN(lng)) return;

      const name = d.branch_name || 'Global HQ';
      const existing = branchMap.get(name);

      if (existing) {
        existing.devices.push(d);
        existing.maxRisk = Math.max(existing.maxRisk, d.risk_score || 0);
        if (d.status === 'ONLINE') existing.onlineCount += 1;
      } else {
        branchMap.set(name, {
          name,
          lat,
          lng,
          devices: [d],
          maxRisk: d.risk_score || 0,
          onlineCount: d.status === 'ONLINE' ? 1 : 0
        });
      }
    });

    return Array.from(branchMap.values()).sort((a, b) => b.maxRisk - a.maxRisk);
  }, [devices]);

  // Filtered branches for directory list
  const filteredBranches = useMemo(() => {
    return branches.filter((b) => {
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchName = b.name.toLowerCase().includes(q);
        const matchDevice = b.devices.some(
          (d) =>
            d.hostname.toLowerCase().includes(q) ||
            d.current_user?.toLowerCase().includes(q) ||
            d.ip_address?.toLowerCase().includes(q)
        );
        if (!matchName && !matchDevice) return false;
      }

      if (riskFilter === 'CRITICAL' && b.maxRisk < 75) return false;
      if (riskFilter === 'ELEVATED' && (b.maxRisk < 40 || b.maxRisk >= 75)) return false;
      if (riskFilter === 'NORMAL' && b.maxRisk >= 40) return false;

      return true;
    });
  }, [branches, searchQuery, riskFilter]);

  // Active selected branch object
  const activeBranch = useMemo(() => {
    if (!selectedBranchName) return branches[0] || null;
    return branches.find((b) => b.name === selectedBranchName) || branches[0] || null;
  }, [branches, selectedBranchName]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([20, 0], 2);

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const markerGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markerGroup;

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    // Clean watermark-free OpenStreetMap tile server with dark-mode CSS inversion
    const tileUrl = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tiles = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    tileLayerRef.current = tiles;

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [isDark]);

  // Update Markers & Geofences on map
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerGroup = markersLayerRef.current;
    if (!map || !markerGroup) return;

    markerGroup.clearLayers();

    const bounds: L.LatLngBounds = L.latLngBounds([]);
    let hasMarkers = false;

    branches.forEach((b) => {
      const risk = b.maxRisk;
      const isCurrentSelected = activeBranch?.name === b.name;
      const pinColor = risk >= 75 ? '#f43f5e' : risk >= 40 ? '#f59e0b' : '#10b981';
      const pingColor =
        risk >= 75 ? 'rgba(244, 63, 94, 0.45)' : risk >= 40 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.3)';

      // Branch site geofence circle radius (approx 1.5km)
      const circle = L.circle([b.lat, b.lng], {
        color: pinColor,
        fillColor: pinColor,
        fillOpacity: isCurrentSelected ? 0.12 : 0.05,
        weight: isCurrentSelected ? 2 : 1,
        radius: 1200
      });
      markerGroup.addLayer(circle);

      // Custom DivIcon marker
      const markerHtml = `
        <div style="position: relative; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
          <div style="position: absolute; width: 34px; height: 34px; border-radius: 50%; background: ${pingColor}; animation: pulse 2s infinite ease-in-out;"></div>
          <div style="position: relative; width: 18px; height: 18px; border-radius: 50%; background: ${pinColor}; border: 2.5px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; color: white; font-size: 9px; font-weight: 900; font-family: sans-serif;">
            ${b.devices.length}
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        className: 'custom-tactical-branch-pin',
        html: markerHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
      });

      const marker = L.marker([b.lat, b.lng], { icon: customIcon });

      const deviceRows = b.devices
        .slice(0, 4)
        .map(
          (d) => `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 3px 0; border-bottom: 1px dashed rgba(120,120,120,0.2);">
            <span style="font-weight: 700; color: #1e293b;">${d.hostname}</span>
            <span style="color: ${d.status === 'ONLINE' ? '#10b981' : '#f43f5e'}; font-size: 9px; font-weight: 700;">${d.status}</span>
          </div>
        `
        )
        .join('');

      const popupContent = `
        <div style="min-width: 220px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px;">
          <div style="font-weight: 800; font-size: 13px; color: ${pinColor}; text-transform: uppercase; margin-bottom: 4px; display: flex; align-items: center; justify-content: space-between;">
            <span>${b.name}</span>
            <span style="font-size: 10px; padding: 1px 6px; border-radius: 2px; background: ${pinColor}22; border: 1px solid ${pinColor}55;">RISK ${b.maxRisk}</span>
          </div>
          <div style="color: #64748b; font-size: 10px; margin-bottom: 6px;">
            WGS84: ${b.lat.toFixed(4)}, ${b.lng.toFixed(4)} &bull; ${b.devices.length} Nodes
          </div>
          <div style="background: rgba(0,0,0,0.03); padding: 4px; border-radius: 2px; margin-bottom: 8px;">
            ${deviceRows}
          </div>
          <button
            onclick="window.__argusInspectFromMap('${b.devices[0]?.id}')"
            style="width: 100%; padding: 5px 8px; background: #0f172a; color: #ffffff; border: none; border-radius: 2px; font-size: 10px; font-weight: 700; cursor: pointer; text-transform: uppercase;"
          >
            Inspect Primary Endpoint (${b.devices[0]?.hostname})
          </button>
        </div>
      `;

      marker.bindPopup(popupContent, {
        closeButton: false,
        className: 'tactical-leaflet-popup'
      });

      marker.on('click', () => {
        setSelectedBranchName(b.name);
      });

      markerGroup.addLayer(marker);
      bounds.extend([b.lat, b.lng]);
      hasMarkers = true;
    });

    if (hasMarkers && !selectedBranchName) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 12 });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [branches, activeBranch, selectedBranchName]);

  const handleFocusBranch = (branch: BranchSummary) => {
    setSelectedBranchName(branch.name);
    const map = mapInstanceRef.current;
    if (map) {
      map.flyTo([branch.lat, branch.lng], 11, { duration: 1.4 });
    }
  };

  const handleResetView = () => {
    setSelectedBranchName(null);
    const map = mapInstanceRef.current;
    if (!map) return;

    const bounds: L.LatLngBounds = L.latLngBounds([]);
    branches.forEach((b) => bounds.extend([b.lat, b.lng]));
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 11 });
    }
  };

  // KPIs
  const totalBranches = branches.length;
  const geocodedDevices = devices.filter((d) => d.latitude && d.longitude).length;
  const criticalBranches = branches.filter((b) => b.maxRisk >= 75).length;
  const normalBranches = branches.filter((b) => b.maxRisk < 40).length;

  return (
    <div className="space-y-4">
      {/* Top Perimeter KPI Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Physical Sites
            </span>
            <Building2 className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {totalBranches}
            </h3>
            <span className="text-[10px] font-mono text-slate-400 font-semibold">FACILITIES</span>
          </div>
        </div>

        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Geocoded Nodes
            </span>
            <Monitor className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {geocodedDevices}
            </h3>
            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">LOCATED</span>
          </div>
        </div>

        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Secure Perimeters
            </span>
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {normalBranches}
            </h3>
            <span className="text-[10px] font-mono text-emerald-500 font-semibold">RISK &lt; 40</span>
          </div>
        </div>

        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Under Active Alert
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-rose-600 dark:text-rose-400 font-sans tracking-tight">
              {criticalBranches}
            </h3>
            <span className="text-[10px] font-mono text-rose-500 font-semibold">ELEVATED SITES</span>
          </div>
        </div>
      </div>

      {/* Main Perimeter Split View */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left: Branch Directory Sidebar */}
        <div className="lg:col-span-4 bg-white dark:bg-cyber-card rounded-sm p-4 shadow-xs flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-cyber-700/50">
            <div className="flex items-center space-x-2">
              <Compass className="w-4 h-4 text-blue-500" />
              <h2 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Perimeter Sites ({branches.length})
              </h2>
            </div>
            <button
              onClick={handleResetView}
              className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-slate-100 dark:bg-cyber-800 hover:bg-slate-200 dark:hover:bg-cyber-700 text-slate-600 dark:text-slate-300 transition flex items-center space-x-1 cursor-pointer"
              title="Reset Map to Full Global Perimeter"
            >
              <Crosshair className="w-3 h-3" />
              <span>Full View</span>
            </button>
          </div>

          {/* Search & Filter */}
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search branch site or host..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-cyber-800/60 border border-slate-200 dark:border-cyber-700 rounded-sm focus:outline-none focus:ring-1 focus:ring-blue-500 text-slate-900 dark:text-white font-sans"
              />
            </div>

            {/* Severity Filter Pills */}
            <div className="flex items-center space-x-1 text-[10px] font-mono">
              {(['ALL', 'CRITICAL', 'ELEVATED', 'NORMAL'] as const).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setRiskFilter(lvl)}
                  className={`flex-1 py-1 rounded-sm text-center transition cursor-pointer font-bold ${
                    riskFilter === lvl
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-black shadow-xs'
                      : 'bg-slate-100 dark:bg-cyber-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          {/* Branch Site List */}
          <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 max-h-[500px] pr-1">
            {loading ? (
              [1, 2, 3].map((i) => (
                <div key={i} className="p-3 bg-slate-50 dark:bg-cyber-800/40 rounded-sm space-y-2 animate-pulse">
                  <div className="h-3.5 w-2/3 bg-slate-200 dark:bg-cyber-700/60 rounded-sm"></div>
                  <div className="h-2.5 w-1/2 bg-slate-200 dark:bg-cyber-700/40 rounded-sm"></div>
                </div>
              ))
            ) : filteredBranches.length === 0 ? (
              <div className="p-6 text-center text-slate-400 text-xs bg-slate-50 dark:bg-cyber-800/20 rounded-sm">
                No branch sites matched filter criteria.
              </div>
            ) : (
              filteredBranches.map((b) => {
                const isSelected = activeBranch?.name === b.name;
                const riskColor =
                  b.maxRisk >= 75
                    ? 'text-rose-600 dark:text-rose-400'
                    : b.maxRisk >= 40
                    ? 'text-amber-600 dark:text-amber-400'
                    : 'text-emerald-600 dark:text-emerald-400';

                return (
                  <div
                    key={b.name}
                    onClick={() => handleFocusBranch(b)}
                    className={`p-3 rounded-sm border transition cursor-pointer flex flex-col justify-between space-y-2 ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50/40 dark:bg-blue-950/20 shadow-xs'
                        : 'border-slate-200/80 dark:border-cyber-700/60 hover:border-slate-300 dark:hover:border-cyber-600 bg-slate-50/50 dark:bg-cyber-800/30'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 flex items-center space-x-2">
                        <MapPin className={`w-3.5 h-3.5 flex-shrink-0 ${riskColor}`} />
                        <h4 className="font-bold text-xs text-slate-900 dark:text-white truncate">
                          {b.name}
                        </h4>
                      </div>
                      <span className={`text-[10px] font-mono font-bold ${riskColor}`}>
                        RISK {b.maxRisk}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 dark:text-slate-400">
                      <span>
                        {b.devices.length} Nodes &bull; {b.onlineCount} Online
                      </span>
                      <span className="flex items-center space-x-0.5 text-blue-600 dark:text-blue-400">
                        <span>Fly To</span>
                        <ChevronRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right: Full Interactive Tactical Map */}
        <div className="lg:col-span-8 bg-white dark:bg-cyber-card rounded-sm p-4 shadow-xs flex flex-col space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-cyber-700/50">
            <div className="flex items-center space-x-2">
              <Navigation className="w-4 h-4 text-cyan-500" />
              <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Tactical Perimeter Visualization
              </h3>
              {activeBranch && (
                <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-bold px-1.5 py-0.5 rounded-sm bg-cyan-500/10 border border-cyan-500/20">
                  {activeBranch.name}
                </span>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-mono text-slate-400 flex items-center space-x-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>GLOBAL WGS84 GRID ACTIVE</span>
              </span>
            </div>
          </div>

          {/* Map Surface */}
          <div className="w-full h-[460px] relative rounded-sm overflow-hidden isolate z-0">
            <div ref={mapContainerRef} className="w-full h-full relative z-0" />
          </div>

          {/* Bottom Selected Site Details */}
          {activeBranch && (
            <div className="pt-2 border-t border-slate-100 dark:border-cyber-700/50 flex flex-col space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white font-mono uppercase">
                    {activeBranch.name} Stations ({activeBranch.devices.length})
                  </h4>
                  <span className="text-[10px] font-mono text-slate-400">
                    Lat: {activeBranch.lat.toFixed(4)} &bull; Lng: {activeBranch.lng.toFixed(4)}
                  </span>
                </div>
                <DeviceForensicBadge variant="listener" className="hidden sm:inline-flex" />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 pt-1">
                {activeBranch.devices.map((dev) => (
                  <div
                    key={dev.id}
                    className="p-2.5 rounded-sm bg-slate-50 dark:bg-cyber-800/40 border border-slate-200/60 dark:border-cyber-700/40 flex items-center justify-between space-x-2"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center space-x-1.5">
                        <Monitor className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                        <span className="font-bold text-xs text-slate-900 dark:text-white truncate font-mono">
                          {dev.hostname}
                        </span>
                      </div>
                      <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 truncate">
                        {dev.current_user || 'system'} &bull; {dev.ip_address || 'DHCP'}
                      </div>
                    </div>
                    <button
                      onClick={() => openDeviceDetail(dev.id)}
                      className="px-2 py-1 rounded-sm bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black text-[10px] font-bold transition flex items-center space-x-1 cursor-pointer flex-shrink-0 shadow-xs"
                      title="Inspect Endpoint Telemetry"
                    >
                      <Eye className="w-3 h-3" />
                      <span>Inspect</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
