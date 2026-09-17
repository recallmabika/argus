import React from 'react';
import { useLoading } from '../../context/LoadingContext';

export const TopProgressBar: React.FC = () => {
  const { isLoading, progress, currentColor } = useLoading();

  if (!isLoading && progress === 0) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[99999] pointer-events-none">
      {/* High-Precision Multi-Stage Top Progress Bar */}
      <div
        className="h-[3.5px] transition-all duration-150 ease-out"
        style={{
          width: `${progress}%`,
          backgroundColor: currentColor,
          boxShadow: `0 0 14px ${currentColor}, 0 0 4px ${currentColor}`
        }}
      />

      {/* Circular Spinner Arc in Top Navigation Area (matching uploaded reference) */}
      <div className="fixed top-3.5 right-4 sm:right-6 z-[99999] pointer-events-none flex items-center space-x-2 bg-white/90 dark:bg-cyber-900/90 backdrop-blur-xs px-2.5 py-1 rounded-sm border border-slate-200/80 dark:border-cyber-700/80 shadow-md transition-opacity duration-200">
        <div
          className="w-3.5 h-3.5 rounded-full border-2 border-transparent border-t-current animate-spin flex-shrink-0"
          style={{ color: currentColor }}
        />
        <span
          className="text-[10px] font-mono font-bold tracking-wider uppercase transition-colors"
          style={{ color: currentColor }}
        >
          {progress >= 100 ? 'READY' : `${progress}%`}
        </span>
      </div>
    </div>
  );
};
