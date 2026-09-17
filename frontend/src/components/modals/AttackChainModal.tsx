import React, { useState, useEffect } from 'react';
import { X, ShieldAlert, ArrowRight, Clock } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { AttackChainResponse } from '../../types';
import { SeverityBadge } from '../common/Badge';

export const AttackChainModal: React.FC = () => {
  const { activeAttackChainAlertId, closeAttackChain } = useModals();
  const [chain, setChain] = useState<AttackChainResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!activeAttackChainAlertId) {
      setChain(null);
      return;
    }
    setLoading(true);
    api.getAttackChain(activeAttackChainAlertId)
      .then(setChain)
      .catch((err) => console.error('Failed to load attack chain:', err))
      .finally(() => setLoading(false));
  }, [activeAttackChainAlertId]);

  if (!activeAttackChainAlertId) return null;

  return (
    <div className="fixed inset-0 z-[85] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700 rounded-sm w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-xs">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 dark:border-cyber-700/60 flex items-center justify-between bg-slate-50/50 dark:bg-cyber-800/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  {chain ? chain.alert_title : 'MITRE ATT&CK Incident Attack Chain'}
                </h3>
                {chain && <SeverityBadge severity={chain.alert_severity} />}
              </div>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                Target Host: {chain ? chain.target_host : '...'} | Correlated cross-stage progression
              </p>
            </div>
          </div>
          <button onClick={closeAttackChain} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          {loading || !chain ? (
            <div className="py-16 text-center text-slate-400">Analyzing MITRE kill chain telemetry...</div>
          ) : (
            <>
              {/* Visual Stages Progression Grid */}
              <div>
                <div className="flex items-center justify-between pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Enterprise MITRE ATT&amp;CK Stages
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">Sequence: Left to Right</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {chain.stages.map((stage) => (
                    <div
                      key={stage.tactic}
                      className={`p-2.5 rounded-sm border transition flex flex-col justify-between ${
                        stage.count > 0
                          ? stage.has_target_alert
                            ? 'bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-400 font-bold'
                            : 'bg-slate-100 dark:bg-cyber-700/60 border-slate-300 dark:border-cyber-600 text-slate-900 dark:text-white font-semibold'
                          : 'bg-slate-50/50 dark:bg-cyber-800/20 border-slate-200 dark:border-cyber-700/30 text-slate-400 opacity-60'
                      }`}
                    >
                      <span className="text-[10px] uppercase truncate">{stage.tactic}</span>
                      <div className="mt-2 flex items-center justify-between font-mono text-[11px]">
                        <span>{stage.technique_id || '—'}</span>
                        <span className="text-[9px] px-1 py-0.2 rounded bg-black/10 dark:bg-white/10">
                          {stage.count}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Chronological Timeline */}
              <div>
                <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-cyber-700/60">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                    Correlated Incident Timeline (±24 Hours)
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">
                    {chain.timeline.length} Events Correlated
                  </span>
                </div>
                <div className="pt-3 space-y-2.5">
                  {chain.timeline.map((evt, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-sm border ${
                        evt.is_target_event
                          ? 'border-rose-500/40 bg-rose-500/5'
                          : 'border-slate-200 dark:border-cyber-700/50 bg-slate-50 dark:bg-cyber-800/40'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200 dark:bg-cyber-700 font-bold text-slate-800 dark:text-slate-200">
                            {evt.technique_id}
                          </span>
                          <span className="font-semibold text-slate-900 dark:text-white">{evt.technique_name}</span>
                          <SeverityBadge severity={evt.severity} />
                        </div>
                        <span className="text-[10px] font-mono text-slate-400">
                          {new Date(evt.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1">{evt.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
