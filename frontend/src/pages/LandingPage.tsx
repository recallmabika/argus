import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, Radio, Terminal, Monitor, ArrowRight, Lock, CheckCircle2 } from 'lucide-react';
import { Button } from '../components/common/Button';

export const LandingPage: React.FC = () => {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-cyber-900 text-slate-900 dark:text-white flex flex-col font-sans">
      {/* Navbar */}
      <nav className="h-16 border-b border-slate-200 dark:border-cyber-700/60 px-6 flex items-center justify-between bg-white dark:bg-cyber-card">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 rounded-sm bg-slate-900 dark:bg-white text-white dark:text-black flex items-center justify-center font-bold font-mono text-sm shadow-sm">
            A
          </div>
          <span className="font-extrabold text-sm tracking-wider uppercase">ARTIS CyberSecOps</span>
        </div>

        <div className="flex items-center space-x-3">
          <Link to="/threats">
            <Button variant="outline" size="sm">
              <Radio className="w-3.5 h-3.5 mr-1 text-rose-500" />
              <span>Live Threats</span>
            </Button>
          </Link>
          <Link to="/dashboard">
            <Button variant="primary" size="sm">
              <span>SOC Console</span>
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </Button>
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-20 text-center max-w-4xl mx-auto space-y-6">
        <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-sm bg-slate-200 dark:bg-cyber-800 text-[11px] font-mono font-semibold text-slate-700 dark:text-slate-300 border border-slate-300 dark:border-cyber-700">
          <span className="relative flex h-2 w-2 flex-shrink-0">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
          </span>
          <span>ENTERPRISE DEFENSE GRID ACTIVE</span>
        </div>

        <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight">
          Autonomous Threat Intelligence &amp; Digital Forensics
        </h1>

        <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl leading-relaxed">
          High-performance security operations platform correlating real-time endpoint telemetry, automated MITRE ATT&amp;CK kill-chain mapping, and cryptographic non-repudiation.
        </p>

        <div className="flex items-center space-x-4 pt-4">
          <Link to="/dashboard">
            <Button variant="primary" size="lg">
              Launch SOC Console
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </Link>
          <Link to="/threats">
            <Button variant="secondary" size="lg">
              <Radio className="w-4 h-4 mr-2 text-rose-500" />
              Stream Threats
            </Button>
          </Link>
        </div>

        {/* Capability Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-left pt-12 w-full">
          <div className="p-5 rounded-sm bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 space-y-2">
            <Radio className="w-5 h-5 text-rose-500" />
            <h3 className="font-bold text-sm">WebSocket Threat Bus</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Sub-millisecond alert ingestion from Windows, macOS, Linux, and Android endpoints.
            </p>
          </div>
          <div className="p-5 rounded-sm bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 space-y-2">
            <Shield className="w-5 h-5 text-slate-900 dark:text-white" />
            <h3 className="font-bold text-sm">MITRE ATT&amp;CK Matrix</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Automated behavioral classification across execution, collection, exfiltration, and discovery tactics.
            </p>
          </div>
          <div className="p-5 rounded-sm bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 space-y-2">
            <Lock className="w-5 h-5 text-emerald-500" />
            <h3 className="font-bold text-sm">Ed25519 Chain of Custody</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Courtroom-grade signed PDF incident reports with verified cryptographic SHA-256 integrity digests.
            </p>
          </div>
        </div>
      </main>

      <footer className="h-14 border-t border-slate-200 dark:border-cyber-700/60 px-6 flex items-center justify-between text-xs text-slate-500 font-mono">
        <span>ARTIS v1.0.0 Enterprise SOC</span>
        <span>Argus CyberSecOps Architecture</span>
      </footer>
    </div>
  );
};
