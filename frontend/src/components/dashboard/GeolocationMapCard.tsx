import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin, GripVertical, Maximize2 } from 'lucide-react';
import { Device } from '../../types';

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
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersRef = useRef<Record<string, L.Marker>>({});

  useEffect(() => {
    if (!mapContainerRef.current) return;
    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current).setView([40.7128, -74.006], 4);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 19
      }).addTo(map);
      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Add / update markers for devices with coordinates
    devices.forEach((d) => {
      if (d.latitude && d.longitude) {
        if (!markersRef.current[d.id]) {
          const marker = L.marker([Number(d.latitude), Number(d.longitude)]).addTo(map);
          marker.bindPopup(
            `<b>${d.branch_name}</b><br>Device: ${d.hostname}<br>Risk: ${d.risk_score} / 100`
          );
          markersRef.current[d.id] = marker;
        }
      }
    });

    setTimeout(() => {
      map.invalidateSize();
    }, 200);
  }, [devices]);

  return (
    <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 flex flex-col shadow-xs h-full" id="branches">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-cyber-700/50">
        <div className="flex items-center space-x-2">
          <span className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Drag to reorder panel">
            <GripVertical className="w-4 h-4" />
          </span>
          <MapPin className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Branch Site Geolocation
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          {onPullToMain && (
            <button
              onClick={onPullToMain}
              className={`px-2 py-0.5 rounded-sm text-[10px] font-mono border transition flex items-center space-x-1 ${
                isMainStage
                  ? 'bg-slate-100 dark:bg-cyber-700/60 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-cyber-600 font-semibold'
                  : 'border-slate-200 dark:border-cyber-700/60 bg-slate-50 dark:bg-cyber-800/60 hover:bg-slate-100 dark:hover:bg-cyber-700 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
              title={isMainStage ? 'Currently on Primary Stage' : 'Pull into Main Stage'}
            >
              <Maximize2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>{isMainStage ? 'Primary Stage' : 'Pull to Main'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[260px] relative rounded-sm overflow-hidden mt-3 border border-slate-200 dark:border-cyber-700/50">
        <div ref={mapContainerRef} className="w-full h-full min-h-[260px]" />
      </div>
    </div>
  );
};
