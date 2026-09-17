import React, { useState, useEffect } from 'react';
import { X, Bell, Trash2, Plus } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { WebhookConfig } from '../../types';
import { Button } from '../common/Button';
import { CustomSelect } from '../common/CustomSelect';

export const WebhooksModal: React.FC = () => {
  const { isWebhooksOpen, closeWebhooks, alert } = useModals();
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState('');
  const [platform, setPlatform] = useState('SLACK');
  const [url, setUrl] = useState('');
  const [minSeverity, setMinSeverity] = useState('CRITICAL');

  const loadWebhooks = () => {
    api.getWebhooks().then(setWebhooks).catch(() => {});
  };

  useEffect(() => {
    if (isWebhooksOpen) loadWebhooks();
  }, [isWebhooksOpen]);

  if (!isWebhooksOpen) return null;

  const handleAdd = async () => {
    if (!name.trim() || !url.trim()) {
      alert({ message: 'Please enter channel name and endpoint URL.', type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      await api.registerWebhook({ name, platform, url, min_severity: minSeverity });
      setName('');
      setUrl('');
      loadWebhooks();
      alert({ message: 'Webhook channel registered successfully.', type: 'success' });
    } catch (e: any) {
      alert({ title: 'Registration Failed', message: e.message || 'Error saving webhook.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteWebhook(id);
      loadWebhooks();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700 rounded-sm w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden text-xs">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-cyber-700/60 flex items-center justify-between bg-slate-50/50 dark:bg-cyber-800/30">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                SIEM &amp; Webhook Forwarding
              </h3>
              <p className="text-[10px] text-slate-400">Stream critical threat alerts to external SOC platforms</p>
            </div>
          </div>
          <button onClick={closeWebhooks} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar">
          {/* Register Webhook Form */}
          <div className="p-4 bg-slate-50 dark:bg-cyber-800/50 rounded-sm border border-slate-200 dark:border-cyber-700/60 space-y-3">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Register Destination Channel
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Channel Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Primary SOC Discord / Splunk HEC"
                  className="w-full bg-white dark:bg-cyber-900 border border-slate-300 dark:border-cyber-700 rounded-sm px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Target Platform
                </label>
                <CustomSelect
                  minWidth="w-full"
                  value={platform}
                  onChange={setPlatform}
                  options={[
                    { value: 'SLACK', label: 'Slack Webhook' },
                    { value: 'DISCORD', label: 'Discord Channel' },
                    { value: 'TEAMS', label: 'Microsoft Teams' },
                    { value: 'GENERIC_JSON', label: 'Custom SIEM / REST API' }
                  ]}
                />
              </div>
            </div>

            <div>
              <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
                Endpoint URL
              </label>
              <input
                type="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/... or https://siem.internal/alerts"
                className="w-full bg-white dark:bg-cyber-900 border border-slate-300 dark:border-cyber-700 rounded-sm px-3 py-2 text-xs font-mono text-slate-900 dark:text-white focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <div className="flex items-center space-x-2">
                <span className="text-[11px] text-slate-600 dark:text-slate-400">Min Severity:</span>
                <CustomSelect
                  minWidth="w-40"
                  value={minSeverity}
                  onChange={setMinSeverity}
                  options={[
                    { value: 'CRITICAL', label: 'CRITICAL ONLY' },
                    { value: 'ALL', label: 'ALL DETECTIONS' }
                  ]}
                />
              </div>
              <Button variant="primary" isLoading={loading} onClick={handleAdd}>
                <Plus className="w-3.5 h-3.5 mr-1" />
                <span>Add Webhook</span>
              </Button>
            </div>
          </div>

          {/* Existing Webhooks List */}
          <div className="space-y-2">
            <span className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
              Active Forwarding Channels ({webhooks.length})
            </span>
            {webhooks.length === 0 ? (
              <div className="text-center py-8 text-slate-400">No forwarding channels configured yet.</div>
            ) : (
              webhooks.map((wh) => (
                <div
                  key={wh.id}
                  className="p-3 bg-white dark:bg-cyber-800/40 border border-slate-200 dark:border-cyber-700 rounded-sm flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center space-x-2">
                      <span className="font-semibold text-slate-900 dark:text-white">{wh.name}</span>
                      <span className="px-1.5 py-0.2 rounded font-mono text-[9px] bg-slate-200 dark:bg-cyber-700">
                        {wh.platform}
                      </span>
                      <span className="text-[10px] font-mono text-slate-400">Sev: {wh.min_severity}</span>
                    </div>
                    <p className="text-[10px] font-mono text-slate-400 truncate mt-0.5">{wh.url}</p>
                  </div>
                  <button
                    onClick={() => handleDelete(wh.id)}
                    className="p-1.5 text-slate-400 hover:text-rose-600 transition"
                    title="Remove Webhook"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
