import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import L from 'leaflet';
import { MapPin, GripVertical, Maximize2, ExternalLink, Navigation, Compass } from 'lucide-react';
import { Device } from '../../types';
import { useTheme } from '../../context/ThemeContext';
import { useModals } from '../../context/ModalContext';

interface GeolocationMapCardProps {
  devices: Device[];
  isMainStage?: boolean;
  onPullToMain?: () => void;
}

export const GeolocationMapCard: React.FC<GeolocationMapCardProps> = ({
  devices,
  isMainStage = false,
  onPullToMain
}) => {
  const { isDark } = useTheme();
  const { openDeviceDetail } = useModals();

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  const [selectedBranch, setSelectedBranch] = useState<string>('ALL');

  // Register global device inspector callback for Leaflet popup actions
  useEffect(() => {
    (window as any).__argusInspectFromMap = (deviceId: string) => {
      const dev = devices.find(d => d.id === deviceId);
      if (dev) {
        openDeviceDetail(dev.id);
      }
    };
    return () => {
      delete (window as any).__argusInspectFromMap;
    };
  }, [devices, openDeviceDetail]);

  // Unique branches from geocoded devices
  const branchList = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number; count: number; maxRisk: number }>();
    devices.forEach((d) => {
      if (d.latitude && d.longitude && d.branch_name) {
        const lat = Number(d.latitude);
        const lng = Number(d.longitude);
        if (!isNaN(lat) && !isNaN(lng)) {
          const existing = map.get(d.branch_name);
          if (existing) {
            existing.count += 1;
            existing.maxRisk = Math.max(existing.maxRisk, d.risk_score || 0);
          } else {
            map.set(d.branch_name, { lat, lng, count: 1, maxRisk: d.risk_score || 0 });
          }
        }
      }
    });
    return Array.from(map.entries()).map(([name, data]) => ({
      name,
      ...data
    }));
  }, [devices]);

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        zoomControl: false,
        attributionControl: false
      }).setView([20, 0], 2);

      // Add compact zoom control in bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // Dedicated layer group for markers
      const markerGroup = L.layerGroup().addTo(map);
      markersLayerRef.current = markerGroup;

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Remove old tile layer if switching light/dark
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

  // Update Markers
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markerGroup = markersLayerRef.current;
    if (!map || !markerGroup) return;

    markerGroup.clearLayers();

    const bounds: L.LatLngBounds = L.latLngBounds([]);
    let hasCoords = false;

    // Filter devices based on selected branch
    const visibleDevices = devices.filter((d) => {
      if (!d.latitude || !d.longitude) return false;
      const lat = Number(d.latitude);
      const lng = Number(d.longitude);
      if (isNaN(lat) || !isNaN(lng) === false) return false;
      if (selectedBranch !== 'ALL' && d.branch_name !== selectedBranch) return false;
      return true;
    });

    visibleDevices.forEach((d) => {
      const lat = Number(d.latitude);
      const lng = Number(d.longitude);
      const risk = d.risk_score || 0;

      // Tactical color coding based on risk score
      const pinColor = risk >= 75 ? '#f43f5e' : risk >= 40 ? '#f59e0b' : '#10b981';
      const pingColor = risk >= 75 ? 'rgba(244, 63, 94, 0.4)' : risk >= 40 ? 'rgba(245, 158, 11, 0.35)' : 'rgba(16, 185, 129, 0.3)';

      // Custom DivIcon with pulsing radar ring
      const customIcon = L.divIcon({
        className: 'custom-tactical-pin',
        html: `
          <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center; cursor: pointer;">
            <div style="position: absolute; width: 28px; height: 28px; border-radius: 50%; background: ${pingColor}; animation: pulse 2s infinite ease-in-out;"></div>
            <div style="position: relative; width: 14px; height: 14px; border-radius: 50%; background: ${pinColor}; border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.5);"></div>
          </div>
        `,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });

      const marker = L.marker([lat, lng], { icon: customIcon });

      const popupHtml = `
        <div style="min-width: 190px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 11px; padding: 2px;">
          <div style="font-weight: 800; font-size: 12px; color: ${pinColor}; text-transform: uppercase; margin-bottom: 3px; display: flex; align-items: center; justify-content: space-between;">
            <span>${d.branch_name || 'Branch Site'}</span>
            <span style="font-size: 10px; padding: 1px 5px; border-radius: 2px; background: ${pinColor}22; border: 1px solid ${pinColor}55;">RISK ${risk}</span>
          </div>
          <div style="border-top: 1px solid rgba(120,120,120,0.25); padding-top: 5px; margin-top: 3px; line-height: 1.5; color: #64748b;">
            <div><strong style="color: #334155;">Host:</strong> ${d.hostname}</div>
            <div><strong style="color: #334155;">User:</strong> ${d.current_user || 'system'}</div>
            <div><strong style="color: #334155;">IP:</strong> ${d.ip_address || 'DHCP'}</div>
            <div><strong style="color: #334155;">Status:</strong> <span style="font-weight: bold; color: ${d.status === 'ONLINE' ? '#10b981' : '#f43f5e'};">${d.status}</span></div>
          </div>
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid rgba(120,120,120,0.25);">
            <button
              onclick="window.__argusInspectFromMap('${d.id}')"
              style="width: 100%; padding: 4px 8px; background: #0f172a; color: #ffffff; border: none; border-radius: 2px; font-size: 10px; font-weight: 700; cursor: pointer; text-transform: uppercase;"
            >
              Inspect Device
            </button>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        closeButton: false,
        className: 'tactical-leaflet-popup'
      });

      markerGroup.addLayer(marker);
      bounds.extend([lat, lng]);
      hasCoords = true;
    });

    if (hasCoords) {
      map.fitBounds(bounds, {
        padding: [30, 30],
        maxZoom: 13
      });
    }

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [devices, selectedBranch]);

  const handleBranchSelect = (branch: string) => {
    setSelectedBranch(branch);
    const map = mapInstanceRef.current;
    if (!map) return;

    if (branch === 'ALL') {
      const bounds: L.LatLngBounds = L.latLngBounds([]);
      devices.forEach((d) => {
        if (d.latitude && d.longitude) {
          bounds.extend([Number(d.latitude), Number(d.longitude)]);
        }
      });
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 12 });
      }
    } else {
      const match = branchList.find((b) => b.name === branch);
      if (match) {
        map.flyTo([match.lat, match.lng], 10, { duration: 1.2 });
      }
    }
  };

  return (
    <div
      className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col shadow-xs h-full relative isolate z-0"
      id="branches"
    >
      {/* Card Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-cyber-700/50">
        <div className="flex items-center space-x-2">
          <span
            className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
            title="Drag to reorder panel"
          >
            <GripVertical className="w-4 h-4" />
          </span>
          <MapPin className="w-4 h-4 text-slate-400" />
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Branch Site Geolocation Perimeter
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block">
              {branchList.length} physical sites &bull; Live endpoint positioning
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <Link
            to="/branches"
            className="px-2 py-0.5 rounded-sm bg-slate-50 dark:bg-cyber-800/60 hover:bg-slate-100 dark:hover:bg-cyber-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 text-[10px] font-mono transition flex items-center space-x-1 shadow-xs"
            title="Open Dedicated Fullscreen Perimeter Map"
          >
            <Compass className="w-3 h-3 text-slate-400" />
            <span className="hidden sm:inline">Perimeter View</span>
            <ExternalLink className="w-2.5 h-2.5 text-slate-400 ml-0.5" />
          </Link>

          {onPullToMain && (
            <button
              onClick={onPullToMain}
              className={`px-2 py-0.5 rounded-sm text-[10px] font-mono transition flex items-center space-x-1 ${
                isMainStage
                  ? 'bg-slate-100 dark:bg-cyber-700/60 text-slate-700 dark:text-slate-300 font-semibold'
                  : 'bg-slate-50 dark:bg-cyber-800/60 hover:bg-slate-100 dark:hover:bg-cyber-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              title={isMainStage ? 'Currently on Primary Stage' : 'Pull into Main Stage'}
            >
              <Maximize2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>{isMainStage ? 'Primary Stage' : 'Pull to Main'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Branch Quick Switcher */}
      {branchList.length > 0 && (
        <div className="pt-2 flex items-center space-x-1.5 overflow-x-auto custom-scrollbar text-[10px] font-mono">
          <button
            onClick={() => handleBranchSelect('ALL')}
            className={`px-2 py-0.5 rounded-sm transition whitespace-nowrap cursor-pointer ${
              selectedBranch === 'ALL'
                ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                : 'bg-slate-100 dark:bg-cyber-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            All Sites ({devices.filter((d) => d.latitude && d.longitude).length})
          </button>
          {branchList.map((b) => (
            <button
              key={b.name}
              onClick={() => handleBranchSelect(b.name)}
              className={`px-2 py-0.5 rounded-sm transition whitespace-nowrap flex items-center space-x-1 cursor-pointer ${
                selectedBranch === b.name
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-black font-bold shadow-xs'
                  : 'bg-slate-100 dark:bg-cyber-800/60 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <span>{b.name}</span>
              <span className="opacity-70">({b.count})</span>
            </button>
          ))}
        </div>
      )}

      {/* Map Canvas */}
      <div className="flex-1 min-h-[260px] relative rounded-sm overflow-hidden mt-3 isolate z-0">
        <div ref={mapContainerRef} className="w-full h-full min-h-[260px] relative z-0" />
      </div>
    </div>
  );
};
