import React, { useState } from 'react';
import { X, Ban } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { Button } from '../common/Button';

export const KillProcessModal: React.FC = () => {
  const { killProcessTarget, closeKillProcess, alert } = useModals();
  const [target, setTarget] = useState(killProcessTarget?.defaultTarget || '');
  const [loading, setLoading] = useState(false);

  if (!killProcessTarget) return null;

  const handleKill = async () => {
    if (!target.trim()) {
      alert({ message: 'Enter a PID or executable name.', type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      if (killProcessTarget.deviceId) {
        await api.dispatchDeviceCommand(killProcessTarget.deviceId, 'KILL_PROCESS', { target });
      }
      closeKillProcess();
      alert({ title: 'Directive Dispatched', message: `Kill process command for '${target}' sent to endpoint.`, type: 'success' });
    } catch (e: any) {
      alert({ title: 'Directive Failed', message: e.message || 'Error killing process.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card rounded-sm max-w-sm w-full p-5 space-y-4 shadow-2xl text-xs">
        <div className="flex items-center space-x-2.5">
          <div className="p-2 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black shadow-xs">
            <Ban className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Terminate Host Process</h3>
            <p className="text-[10px] text-slate-400">Audited emergency containment directive</p>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300">
            Target Process PID or Executable Name
          </label>
          <input
            type="text"
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            placeholder="e.g. 4812 or powershell.exe"
            className="w-full bg-slate-50 dark:bg-cyber-900 rounded-sm px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-slate-900 dark:focus:ring-white shadow-xs"
          />
          <p className="text-[10px] text-slate-400">If a number is provided, process is killed by PID. If a name is provided, matching instances will be killed.</p>
        </div>

        <div className="flex items-center justify-end space-x-2 pt-2">
          <Button variant="secondary" onClick={closeKillProcess}>
            Cancel
          </Button>
          <Button variant="danger" isLoading={loading} onClick={handleKill}>
            Terminate Process
          </Button>
        </div>
      </div>
    </div>
  );
};
