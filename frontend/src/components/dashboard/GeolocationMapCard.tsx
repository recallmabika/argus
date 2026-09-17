import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { Device } from '../../types';

interface GeolocationMapCardProps {
  devices: Device[];
}

export const GeolocationMapCard: React.FC<GeolocationMapCardProps> = ({ devices }) => {
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
    <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 flex flex-col shadow-xs" id="branches">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-cyber-700/50">
        <div className="flex items-center space-x-2">
          <MapPin className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Branch Site Geolocation
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">OpenStreetMap Engine</span>
      </div>

      <div className="flex-1 min-h-[260px] relative rounded-sm overflow-hidden mt-3 border border-slate-200 dark:border-cyber-700/50">
        <div ref={mapContainerRef} className="w-full h-full min-h-[260px]" />
      </div>
    </div>
  );
};
