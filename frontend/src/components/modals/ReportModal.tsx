import React, { useState } from 'react';
import { X, FileText, Check, Download } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { Button } from '../common/Button';
import { CustomSelect } from '../common/CustomSelect';
import { ReportGenerationResponse } from '../../types';

export const ReportModal: React.FC = () => {
  const { isReportOpen, closeReport, alert } = useModals();
  const [title, setTitle] = useState('Security Incident & Endpoint Monitoring Assessment');
  const [template, setTemplate] = useState<'ANALYST' | 'EXECUTIVE'>('ANALYST');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ReportGenerationResponse | null>(null);

  if (!isReportOpen) return null;

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const res = await api.generateReport(title, template);
      setResult(res);
    } catch (e: any) {
      alert({ title: 'Report Generation Failed', message: e.message || 'Unknown error occurred.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setResult(null);
    closeReport();
  };

  return (
    <div className="fixed inset-0 z-[80] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700 rounded-sm w-full max-w-md p-6 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-cyber-700/60 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Generate Signed Incident Report</h3>
              <p className="text-[10px] text-slate-400">Ed25519 Cryptographic Attestation</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Report Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-slate-50 dark:bg-cyber-900 border border-slate-300 dark:border-cyber-700 rounded-sm px-3 py-2 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-slate-900 dark:focus:border-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-700 dark:text-slate-300 mb-1">
              Audience Template
            </label>
            <CustomSelect
              minWidth="w-full"
              value={template}
              onChange={(val) => setTemplate(val as any)}
              options={[
                { value: 'ANALYST', label: 'Technical Analyst Report (MITRE IOCs & Forensic Directives)' },
                { value: 'EXECUTIVE', label: 'Executive Summary (Business Risk & Asset Impact)' }
              ]}
            />
          </div>
        </div>

        {result && (
          <div className="p-3 bg-slate-100 dark:bg-cyber-800/80 border border-slate-300 dark:border-white/20 rounded-sm space-y-2">
            <div className="flex items-center space-x-2 text-slate-900 dark:text-white font-semibold">
              <Check className="w-4 h-4 text-emerald-500" />
              <span>Report Signed &amp; Generated</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 dark:text-slate-400 break-all">
              <b>SHA-256:</b> {result.sha256_hash}
            </div>
            <a
              href={result.download_url}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2 bg-slate-900 hover:bg-black dark:bg-white dark:hover:bg-slate-200 text-white dark:text-black font-semibold rounded-sm transition flex items-center justify-center space-x-1.5 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download Signed PDF</span>
            </a>
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-cyber-700/60">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button variant="primary" isLoading={loading} onClick={handleGenerate}>
            Generate &amp; Sign
          </Button>
        </div>
      </div>
    </div>
  );
};
