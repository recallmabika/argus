import React, { useState, useEffect } from 'react';
import { Wifi, RefreshCw, HardDrive, Laptop, Smartphone, Eye, Download, X } from 'lucide-react';
import { api } from '../../services/api';
import { ForensicDevice } from '../../types';
import { useModals } from '../../context/ModalContext';

export const ForensicsBridgeWorkstation: React.FC = () => {
  const { openWirelessConnect, openForensicStudio, confirm, alert } = useModals();
  const [devices, setDevices] = useState<ForensicDevice[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchDevices = () => {
    setLoading(true);
    api.getForensicDevices()
      .then((res) => setDevices(res.devices || []))
      .catch((err) => {
        console.error('Failed to load forensic devices:', err);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(fetchDevices, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleDisconnect = async (deviceId: string) => {
    const ok = await confirm({
      title: 'Disconnect Endpoint',
      badge: 'DISCONNECT CONFIRMATION',
      message: `Are you sure you want to terminate the wireless connection to endpoint "${deviceId}"? Active ADB bridges and forensic monitoring sessions will be closed.`,
      confirmText: 'Disconnect Endpoint',
      cancelText: 'Cancel',
      type: 'danger'
    });
    if (!ok) return;

    try {
      await api.disconnectForensicDevice(deviceId);
      fetchDevices();
    } catch (err: any) {
      alert({
        title: 'Disconnection Failed',
        badge: 'ERROR',
        message: `Unable to disconnect wireless endpoint "${deviceId}": ${err.message}`,
        type: 'danger'
      });
    }
  };

  return (
    <div
      id="forensics"
      className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 sm:p-5 shadow-xs space-y-4"
    >
      {/* Section Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-slate-100 dark:border-cyber-700/50 gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
              Digital Forensics Device Bridge
            </h2>
            <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 font-semibold flex items-center space-x-1 whitespace-nowrap">
              <span className="h-1.5 w-1.5 rounded-full bg-cyan-500 animate-pulse"></span>
              <span>LIVE BUS &amp; WIRELESS LISTENER</span>
            </span>
          </div>
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
            Plug in a device via USB cable or pair wirelessly (Wi-Fi ADB) to control the screen, navigate apps, and acquire evidence
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2 flex-shrink-0">
          <button
            onClick={openWirelessConnect}
            className="px-3 py-1.5 rounded-sm bg-slate-100 dark:bg-cyber-700 hover:bg-slate-200 dark:hover:bg-cyber-600 text-xs font-medium text-slate-700 dark:text-slate-200 transition flex items-center space-x-1.5 border border-slate-200 dark:border-cyber-600 shadow-xs whitespace-nowrap cursor-pointer hover:text-blue-600 dark:hover:text-blue-400 focus:outline-none"
          >
            <Wifi className="w-3.5 h-3.5 text-cyan-500 flex-shrink-0" />
            <span>Pair Wireless (Wi-Fi)</span>
          </button>
          <button
            onClick={fetchDevices}
            className="px-3 py-1.5 rounded-sm bg-cyan-600 hover:bg-cyan-500 text-xs font-semibold text-white transition flex items-center space-x-1.5 shadow-sm shadow-cyan-500/20 whitespace-nowrap cursor-pointer focus:outline-none"
          >
            <RefreshCw className={`w-3.5 h-3.5 flex-shrink-0 ${loading ? 'animate-spin' : ''}`} />
            <span>Scan Attached Hardware</span>
          </button>
        </div>
      </div>

      {/* Attached Target Devices Grid */}
      <div id="forensicDevicesGrid" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-1">
        {loading && devices.length === 0 ? (
          [1, 2].map((i) => (
            <div
              key={i}
              className="p-4 bg-slate-50 dark:bg-cyber-800/40 rounded-sm border border-slate-200 dark:border-cyber-700/60 space-y-3 animate-pulse"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2 w-2/3">
                  <div className="w-8 h-8 rounded-sm bg-slate-200 dark:bg-cyber-700/70"></div>
                  <div className="space-y-1.5 flex-1">
                    <div className="h-3.5 w-3/4 bg-slate-200 dark:bg-cyber-700/70 rounded-sm"></div>
                    <div className="h-2.5 w-1/2 bg-slate-200 dark:bg-cyber-700/50 rounded-sm"></div>
                  </div>
                </div>
                <div className="h-4 w-16 bg-slate-200 dark:bg-cyber-700/70 rounded-sm"></div>
              </div>
              <div className="flex gap-2 pt-2">
                <div className="h-7 flex-1 bg-slate-200 dark:bg-cyber-700/60 rounded-sm"></div>
              </div>
            </div>
          ))
        ) : devices.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs col-span-full border border-dashed border-slate-200 dark:border-cyber-700/60 rounded-sm space-y-2">
            <p className="font-semibold text-slate-600 dark:text-slate-300">
              No hardware targets currently attached to USB bus or Wi-Fi ports
            </p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Connect an Android phone via USB cable (with USB debugging), plug in a USB drive, or click "Pair Wireless" to connect over Wi-Fi.
            </p>
          </div>
        ) : (
          devices.map((dev) => {
            const isStorage = dev.type === 'storage' || dev.type === 'USB_STORAGE';
            const isHost = dev.type === 'host' || dev.type === 'HOST_WORKSTATION';
            const isWireless = dev.connection && (dev.connection.toLowerCase().includes('wireless') || dev.connection.toLowerCase().includes('wi-fi'));

            const typeBadgeClass = isWireless
              ? 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30'
              : isStorage
              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
              : isHost
              ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30 font-bold'
              : 'bg-slate-200 dark:bg-white/10 text-slate-800 dark:text-slate-200 border-slate-300 dark:border-white/20';

            const typeLabel = isWireless ? 'WI-FI ADB' : isStorage ? 'MASS STORAGE' : isHost ? 'LOCAL HOST' : 'USB CABLE';

            const platformName = dev.platform || (dev.details && (dev.details.os || dev.details.fstype)) || (isHost ? 'Windows Host' : isStorage ? 'USB Storage' : 'Android');
            const batteryText = typeof dev.battery === 'object' && dev.battery && dev.battery.level !== undefined
              ? `${dev.battery.level}%`
              : typeof dev.battery === 'string' && dev.battery !== 'N/A'
              ? dev.battery
              : isHost ? 'AC Power' : 'Bus Power';

            const isOnline = (dev.status || '').toUpperCase() === 'ONLINE' || (dev.status || '').toUpperCase() === 'CONNECTED';
            const isQuarantined = (dev.status || '').toUpperCase() === 'QUARANTINED';

            return (
              <div
                key={dev.id}
                className="p-4 bg-slate-50 dark:bg-cyber-800/50 rounded-sm border border-slate-200 dark:border-cyber-700/60 space-y-3 shadow-xs hover:border-slate-400 dark:hover:border-white/40 transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5 min-w-0">
                      <div className="w-7 h-7 rounded-sm bg-slate-200/50 dark:bg-cyber-700/40 flex items-center justify-center flex-shrink-0">
                        {isStorage ? (
                          <HardDrive className="w-4 h-4 text-slate-600 dark:text-slate-300 flex-shrink-0" />
                        ) : isHost ? (
                          <Laptop className="w-4 h-4 text-slate-600 dark:text-slate-300 flex-shrink-0" />
                        ) : (
                          <Smartphone className="w-4 h-4 text-slate-600 dark:text-slate-300 flex-shrink-0" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4
                          className="font-bold text-slate-900 dark:text-white text-xs truncate"
                          title={dev.model || dev.name}
                        >
                          {dev.model || dev.name}
                        </h4>
                        <div className="font-mono text-[10px] text-slate-500 dark:text-slate-400 truncate">
                          ID: {dev.id}
                        </div>
                      </div>
                    </div>
                    <span
                      className={`px-2 py-0.5 rounded-sm text-[10px] font-mono border font-semibold flex-shrink-0 whitespace-nowrap ${typeBadgeClass}`}
                    >
                      {typeLabel}
                    </span>
                  </div>

                  <div className="pt-2 border-t border-slate-200/60 dark:border-cyber-700/40 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                    <div>
                      Status:{' '}
                      {isOnline ? (
                        <span className="inline-flex items-center space-x-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span>ONLINE</span>
                        </span>
                      ) : isQuarantined ? (
                        <span className="inline-flex items-center space-x-1.5 text-rose-600 dark:text-rose-400 font-bold">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          <span>QUARANTINED</span>
                        </span>
                      ) : (
                        <span className="text-slate-900 dark:text-white font-semibold uppercase">{dev.status}</span>
                      )}
                    </div>
                    <div className="truncate" title={platformName}>
                      Platform: <span className="text-slate-700 dark:text-slate-300 font-semibold">{platformName}</span>
                    </div>
                    <div>
                      Power: <span className="text-slate-700 dark:text-slate-300 font-semibold">{batteryText}</span>
                    </div>
                    {dev.details?.capacity && (
                      <div className="truncate">
                        Storage: <span className="text-slate-700 dark:text-slate-300 font-semibold">{dev.details.capacity}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 flex items-center space-x-2">
                  {!isStorage ? (
                    <button
                      onClick={() => openForensicStudio(dev.id)}
                      className="flex-1 py-2 px-3 rounded-sm bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black font-semibold text-xs transition flex items-center justify-center space-x-1.5 shadow-sm whitespace-nowrap cursor-pointer focus:outline-none"
                    >
                      <Eye className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Open Studio &amp; Control</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => openForensicStudio(dev.id)}
                      className="flex-1 py-2 px-3 rounded-sm bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs transition flex items-center justify-center space-x-1.5 whitespace-nowrap cursor-pointer focus:outline-none"
                    >
                      <Download className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>Acquire Storage Files</span>
                    </button>
                  )}

                  {isWireless && (
                    <button
                      onClick={() => handleDisconnect(dev.id)}
                      title="Disconnect Wireless Target"
                      className="p-2 rounded-sm bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition flex-shrink-0 cursor-pointer focus:outline-none"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
