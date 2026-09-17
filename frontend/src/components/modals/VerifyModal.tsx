import React, { useState } from 'react';
import { X, ShieldCheck, CheckCircle2, AlertTriangle, Upload } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { api } from '../../services/api';
import { Button } from '../common/Button';
import { VerifyReportResponse } from '../../types';

export const VerifyModal: React.FC = () => {
  const { isVerifyOpen, closeVerify, alert } = useModals();
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyReportResponse | null>(null);

  if (!isVerifyOpen) return null;

  const handleVerify = async () => {
    if (!file) {
      alert({ message: 'Please select a PDF file to verify.', type: 'warning' });
      return;
    }
    setLoading(true);
    try {
      const res = await api.verifyReport(file);
      setResult(res);
    } catch (e: any) {
      alert({ title: 'Verification Error', message: e.message || 'Signature validation failed.', type: 'danger' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setResult(null);
    closeVerify();
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700 rounded-sm w-full max-w-md p-6 shadow-2xl space-y-4 text-xs">
        <div className="flex items-center justify-between border-b border-slate-100 dark:border-cyber-700/60 pb-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Verify PDF Chain of Custody</h3>
              <p className="text-[10px] text-slate-400">Cryptographic Ed25519 Signature Check</p>
            </div>
          </div>
          <button onClick={handleClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <p className="text-slate-600 dark:text-slate-300">
          Upload an incident PDF report to inspect its SHA-256 integrity checksum and verify the root authority Ed25519 signature.
        </p>

        <div className="border-2 border-dashed border-slate-300 dark:border-cyber-700 rounded-sm p-4 text-center hover:border-slate-400 transition cursor-pointer relative">
          <input
            type="file"
            accept=".pdf"
            onChange={(e) => {
              if (e.target.files && e.target.files[0]) {
                setFile(e.target.files[0]);
                setResult(null);
              }
            }}
            className="absolute inset-0 opacity-0 cursor-pointer"
          />
          <Upload className="w-6 h-6 mx-auto text-slate-400 mb-1.5" />
          <span className="font-semibold text-slate-800 dark:text-slate-200">
            {file ? file.name : 'Click to select PDF or drag and drop'}
          </span>
          <p className="text-[10px] text-slate-400 mt-0.5">Maximum file size: 25 MB</p>
        </div>

        {result && (
          <div
            className={`p-3.5 rounded-sm space-y-1.5 border ${
              result.verified
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-800 dark:text-rose-300'
            }`}
          >
            <div className="flex items-center space-x-2 font-bold text-xs">
              {result.verified ? (
                <>
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                  <span>Ed25519 Signature Verified Authentic</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-4 h-4 text-rose-500" />
                  <span>Signature Invalid or Corrupted Document</span>
                </>
              )}
            </div>
            <div className="text-[10px] font-mono break-all pt-1">
              <b>Calculated SHA-256:</b> {result.sha256_hash}
            </div>
            {result.signer_public_key && (
              <div className="text-[10px] font-mono break-all">
                <b>Signer Authority:</b> {result.signer_public_key}
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-cyber-700/60">
          <Button variant="secondary" onClick={handleClose}>
            Close
          </Button>
          <Button variant="primary" isLoading={loading} onClick={handleVerify}>
            Verify Signature
          </Button>
        </div>
      </div>
    </div>
  );
};
