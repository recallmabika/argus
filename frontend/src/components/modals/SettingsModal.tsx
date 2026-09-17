import React, { useState, useEffect } from 'react';
import { X, Settings, ShieldCheck, User } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { UserProfile } from '../../types';
import { Button } from '../common/Button';

export const SettingsModal: React.FC = () => {
  const { isSettingsOpen, closeSettings } = useModals();
  const [user, setUser] = useState<UserProfile | null>(null);

  useEffect(() => {
    if (isSettingsOpen) {
      api.getUserProfile().then(setUser).catch(() => {});
    }
  }, [isSettingsOpen]);

  if (!isSettingsOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700 rounded-sm w-full max-w-lg p-6 shadow-2xl space-y-5 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-cyber-700/60 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black">
              <Settings className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">SOC Analyst &amp; System Settings</h3>
              <p className="text-[10px] text-slate-400">Security configuration &amp; operator profile</p>
            </div>
          </div>
          <button onClick={closeSettings} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* User Identity Card */}
        {user && (
          <div className="p-3.5 bg-slate-50 dark:bg-cyber-800/60 rounded-sm border border-slate-200 dark:border-cyber-700/50 flex items-center space-x-3.5">
            <div className="w-12 h-12 rounded-full bg-slate-900 dark:bg-white text-white dark:text-black font-bold text-base flex items-center justify-center shadow-xs">
              {user.full_name.charAt(0)}
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-900 dark:text-white">{user.full_name}</h4>
              <div className="font-mono text-[11px] text-slate-700 dark:text-slate-300">
                User ID: <span className="font-semibold">{user.user_id}</span>
              </div>
              <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                Role: {user.role} • Org: {user.organization_name}
              </div>
            </div>
          </div>
        )}

        {/* Cryptographic System Specs */}
        <div className="p-3 bg-slate-100 dark:bg-cyber-800/80 border border-slate-200 dark:border-cyber-700 rounded-sm space-y-1.5 text-[11px]">
          <div className="font-bold text-slate-700 dark:text-slate-300 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-500" />
            <span>Chain-of-Custody Cryptographic Engine</span>
          </div>
          <div className="font-mono text-[10px] text-slate-600 dark:text-slate-400 break-all space-y-0.5 pt-1">
            <div><b>Root Authority:</b> Ed25519 Elliptic Curve Keypair</div>
            <div><b>Integrity Digest:</b> SHA-256 Engine (Active)</div>
            <div><b>Protocol Version:</b> ARTIS EDR Bridge v1.0.0</div>
          </div>
        </div>

        <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-cyber-700/60">
          <Button variant="primary" onClick={closeSettings}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};
