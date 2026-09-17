import React from 'react';
import { Laptop, GripVertical, Maximize2 } from 'lucide-react';
import { Device } from '../../types';
import { StatusBadge } from '../common/Badge';
import { useModals } from '../../context/ModalContext';

interface DevicesTableCardProps {
  devices: Device[];
  loading?: boolean;
  isMainStage?: boolean;
  onPullToMain?: () => void;
}

export const DevicesTableCard: React.FC<DevicesTableCardProps> = ({
  devices,
  loading = false,
  isMainStage = false,
  onPullToMain
}) => {
  const { openDeviceDetail } = useModals();

  const getRiskColor = (score: number) => {
    if (score >= 80) return 'text-rose-600 dark:text-rose-400';
    if (score >= 50) return 'text-amber-600 dark:text-amber-400';
    return 'text-slate-700 dark:text-slate-300';
  };

  return (
    <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 flex flex-col shadow-xs h-full" id="devices">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-cyber-700/50">
        <div className="flex items-center space-x-2">
          <span className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Drag to reorder panel">
            <GripVertical className="w-4 h-4" />
          </span>
          <Laptop className="w-4 h-4 text-slate-400" />
          <div>
            <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Monitored Org Devices ({devices.length})
            </h3>
            <p className="text-[10px] text-slate-500 dark:text-slate-400 hidden sm:block">
              Endpoint telemetry, access visibility, and composite risk scoring
            </p>
          </div>
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

      <div className="flex-1 overflow-x-auto custom-scrollbar pt-2">
        <table className="w-full text-left font-mono text-xs">
          <thead className="bg-slate-50 dark:bg-cyber-800/60 border-b border-slate-200 dark:border-cyber-700/60 text-[10px] uppercase text-slate-400 tracking-wider">
            <tr>
              <th className="py-2.5 px-3">Hostname</th>
              <th className="py-2.5 px-3">OS</th>
              <th className="py-2.5 px-3">User</th>
              <th className="py-2.5 px-3">Branch</th>
              <th className="py-2.5 px-3">Risk</th>
              <th className="py-2.5 px-3">Status</th>
              <th className="py-2.5 px-3 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-cyber-700/40">
            {loading ? (
              [1, 2, 3].map((i) => (
                <tr key={i} className="animate-pulse">
                  <td colSpan={7} className="py-3 px-3">
                    <div className="h-4 bg-slate-200 dark:bg-cyber-700/50 rounded-sm"></div>
                  </td>
                </tr>
              ))
            ) : devices.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-8 text-center text-slate-400">
                  No devices connected yet. Launch agent-desktop to enroll.
                </td>
              </tr>
            ) : (
              devices.map((d) => (
                <tr key={d.id} className="hover:bg-slate-50/60 dark:hover:bg-cyber-800/30 transition">
                  <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">{d.hostname}</td>
                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{d.os_type}</td>
                  <td className="py-2.5 px-3 text-slate-700 dark:text-slate-300">{d.current_user || 'system'}</td>
                  <td className="py-2.5 px-3 text-slate-500 dark:text-slate-400">{d.branch_name}</td>
                  <td className={`py-2.5 px-3 font-bold ${getRiskColor(d.risk_score)}`}>{d.risk_score} / 100</td>
                  <td className="py-2.5 px-3">
                    <StatusBadge status={d.status} />
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      onClick={() => openDeviceDetail(d.id)}
                      className="px-2.5 py-1 rounded-sm bg-slate-100 dark:bg-cyber-700/60 hover:bg-slate-200 dark:hover:bg-cyber-600 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-cyber-600 font-medium text-[11px] transition"
                    >
                      Inspect
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
