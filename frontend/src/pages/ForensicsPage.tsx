import React, { useState, useEffect } from 'react';
import {
  Microscope,
  RefreshCw,
  HardDrive,
  Monitor,
  Smartphone,
  Eye,
  Download,
  ShieldCheck,
  Cpu,
  Usb,
  CheckCircle2,
  Terminal,
  FileSearch,
  ExternalLink
} from 'lucide-react';
import { api } from '../services/api';
import { ForensicDevice } from '../types';
import { useModals } from '../context/ModalContext';
import { DeviceForensicBadge } from '../components/common/DeviceForensicBadge';

export const ForensicsPage: React.FC = () => {
  const { openForensicStudio, alert } = useModals();
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
    const interval = setInterval(fetchDevices, 6000);
    return () => clearInterval(interval);
  }, []);

  const totalAttached = devices.length;
  const onlineCount = devices.filter((d) => (d.status || '').toUpperCase() === 'ONLINE' || (d.status || '').toUpperCase() === 'CONNECTED').length;
  const storageCount = devices.filter((d) => d.type === 'storage' || d.type === 'USB_STORAGE').length;
  const mobileCount = devices.filter((d) => d.type === 'ANDROID_MOBILE').length;

  return (
    <div className="space-y-5">
      {/* Top Telemetry KPI Ribbon */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              USB Targets Attached
            </span>
            <Usb className="w-4 h-4 text-cyan-500" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {totalAttached}
            </h3>
            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">PHYSICAL USB</span>
          </div>
        </div>

        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Online Mobile Units
            </span>
            <Smartphone className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {mobileCount}
            </h3>
            <span className="text-[10px] font-mono text-emerald-500 font-semibold">ADB READY</span>
          </div>
        </div>

        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Removable USB Drives
            </span>
            <HardDrive className="w-4 h-4 text-slate-400" />
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-2xl sm:text-3xl font-light text-slate-900 dark:text-white font-sans tracking-tight">
              {storageCount}
            </h3>
            <span className="text-[10px] font-mono text-amber-500 font-semibold">MOUNTED</span>
          </div>
        </div>

        <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Hardware Bus Status
            </span>
            <span className="relative flex h-2 w-2 flex-shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500"></span>
            </span>
          </div>
          <div className="mt-2 flex items-baseline justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white font-mono uppercase tracking-wider">
              POLLING ACTIVE
            </h3>
            <span className="text-[10px] font-mono text-cyan-600 dark:text-cyan-400 font-semibold">USB BUS</span>
          </div>
        </div>
      </div>

      {/* Main USB Hardware Forensics Deck */}
      <div className="bg-white dark:bg-cyber-card rounded-sm p-4 sm:p-5 shadow-xs space-y-4">
        {/* Header Strip */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between pb-3 border-b border-slate-100 dark:border-cyber-700/50 gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center space-x-1.5">
                <Microscope className="w-4 h-4 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
                  USB Digital Forensics Device Bridge
                </h2>
              </div>
              <DeviceForensicBadge variant="listener" label="USB HARDWARE BUS LISTENER" />
            </div>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
              Physical USB plug &amp; play hardware detection: screen mirroring, touch control, evidence file extraction, and triage shell execution.
            </p>
          </div>

          <div className="flex items-center space-x-2 flex-shrink-0">
            <button
              onClick={fetchDevices}
              className="px-3 py-1.5 rounded-sm bg-transparent border border-cyan-600/80 dark:border-cyan-500/80 text-xs font-semibold text-cyan-600 dark:text-cyan-400 transition-all flex items-center space-x-1.5 whitespace-nowrap cursor-pointer hover:border-cyan-600 dark:hover:border-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300 hover:ring-1 hover:ring-cyan-600 dark:hover:ring-cyan-400 focus:outline-none"
            >
              <RefreshCw className={`w-3.5 h-3.5 flex-shrink-0 ${loading ? 'animate-spin' : ''}`} />
              <span>Scan USB Bus</span>
            </button>
          </div>
        </div>

        {/* Attached USB Hardware Targets Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 pt-1">
          {loading && devices.length === 0 ? (
            [1, 2, 3].map((i) => (
              <div
                key={i}
                className="p-4 bg-slate-50 dark:bg-cyber-800/40 rounded-sm space-y-3 animate-pulse"
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
                <div className="h-7 bg-slate-200 dark:bg-cyber-700/60 rounded-sm"></div>
              </div>
            ))
          ) : devices.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-xs col-span-full bg-slate-50/50 dark:bg-cyber-800/20 rounded-sm space-y-3">
              <div className="w-12 h-12 mx-auto rounded-full bg-slate-100 dark:bg-cyber-700/40 flex items-center justify-center text-slate-400">
                <Usb className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="font-bold text-sm text-slate-700 dark:text-slate-200">
                  No Hardware Targets Currently Connected via USB
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 max-w-md mx-auto">
                  Plug in an Android mobile device via USB cable (with USB debugging enabled) or connect a removable USB flash drive. The device will be detected automatically.
                </p>
              </div>
            </div>
          ) : (
            devices.map((dev) => {
              const isStorage = dev.type === 'storage' || dev.type === 'USB_STORAGE';
              const isOnline = (dev.status || '').toUpperCase() === 'ONLINE' || (dev.status || '').toUpperCase() === 'CONNECTED';
              const platformName = dev.platform || (dev.details && (dev.details.os || dev.details.fstype)) || (isStorage ? 'USB Storage' : 'Android');
              const batteryText = typeof dev.battery === 'object' && dev.battery && dev.battery.level !== undefined
                ? `${dev.battery.level}%`
                : typeof dev.battery === 'string' && dev.battery !== 'N/A'
                ? dev.battery
                : 'Bus Power';

              return (
                <div
                  key={dev.id}
                  className="p-4 bg-slate-50 dark:bg-cyber-800/50 rounded-sm space-y-3 shadow-xs transition flex flex-col justify-between border border-slate-200/80 dark:border-cyber-700/60"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center space-x-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-sm bg-slate-200/60 dark:bg-cyber-700/50 flex items-center justify-center flex-shrink-0">
                          {isStorage ? (
                            <HardDrive className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                          ) : (
                            <Smartphone className="w-4 h-4 text-cyan-600 dark:text-cyan-400 flex-shrink-0" />
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
                      <DeviceForensicBadge
                        variant={isStorage ? 'storage' : 'usb'}
                        label={isStorage ? 'MASS STORAGE' : 'USB CABLE'}
                      />
                    </div>

                    <div className="pt-2 border-t border-slate-200/60 dark:border-cyber-700/40 grid grid-cols-2 gap-2 text-[10px] font-mono text-slate-600 dark:text-slate-400">
                      <div>
                        Status:{' '}
                        {isOnline ? (
                          <span className="inline-flex items-center space-x-1 text-emerald-600 dark:text-emerald-400 font-bold">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>ONLINE</span>
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
                          Capacity: <span className="text-slate-700 dark:text-slate-300 font-semibold">{dev.details.capacity}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-3 flex items-center space-x-2">
                    {!isStorage ? (
                      <button
                        onClick={() => openForensicStudio(dev.id)}
                        className="flex-1 py-2 px-3 rounded-sm bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black font-semibold text-xs transition flex items-center justify-center space-x-1.5 shadow-xs whitespace-nowrap cursor-pointer focus:outline-none"
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
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* USB Forensic Operational Guide Card */}
      <div className="bg-white dark:bg-cyber-card rounded-sm p-4 shadow-xs space-y-2 border border-slate-100 dark:border-cyber-700/50">
        <div className="flex items-center space-x-2 pb-1 border-b border-slate-100 dark:border-cyber-700/50">
          <FileSearch className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            USB Hardware Bus Standard Operating Procedure
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs text-slate-600 dark:text-slate-300 font-sans pt-1">
          <div className="p-3 bg-slate-50 dark:bg-cyber-800/30 rounded-sm space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-slate-900 dark:text-white font-mono text-[11px]">
              <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-cyber-700 text-center leading-4 text-[10px]">1</span>
              <span>Physical Cable Connection</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Connect the target device (Android smartphone, tablet, or USB mass storage drive) directly to an available USB port using a data-capable USB cable.
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-cyber-800/30 rounded-sm space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-slate-900 dark:text-white font-mono text-[11px]">
              <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-cyber-700 text-center leading-4 text-[10px]">2</span>
              <span>Enable USB Debugging</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              For Android devices, confirm Developer Options &gt; USB Debugging is toggled on, and authorize the RSA forensic key prompt on the device screen.
            </p>
          </div>

          <div className="p-3 bg-slate-50 dark:bg-cyber-800/30 rounded-sm space-y-1">
            <div className="flex items-center space-x-1.5 font-bold text-slate-900 dark:text-white font-mono text-[11px]">
              <span className="w-4 h-4 rounded-full bg-slate-200 dark:bg-cyber-700 text-center leading-4 text-[10px]">3</span>
              <span>Automated Discovery</span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              Argus detects the device automatically on the USB hardware bus. Click "Open Studio &amp; Control" to mirror the screen, navigate apps, and extract forensic files.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
