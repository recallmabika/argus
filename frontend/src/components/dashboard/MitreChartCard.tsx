import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { ShieldAlert, GripVertical, Maximize2 } from 'lucide-react';
import { Alert } from '../../types';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend);

interface MitreChartCardProps {
  alerts: Alert[];
  isMainStage?: boolean;
  onPullToMain?: () => void;
}

export const MitreChartCard: React.FC<MitreChartCardProps> = ({
  alerts,
  isMainStage = false,
  onPullToMain
}) => {
  const { isDark } = useTheme();

  const tacticCounts: Record<string, number> = {
    Execution: 0,
    Collection: 0,
    Exfiltration: 0,
    Discovery: 0,
    'Initial Access': 0
  };

  alerts.forEach((a) => {
    if (a.mitre_tactic && tacticCounts.hasOwnProperty(a.mitre_tactic)) {
      tacticCounts[a.mitre_tactic]++;
    }
  });

  const data = {
    labels: Object.keys(tacticCounts),
    datasets: [
      {
        data: Object.values(tacticCounts),
        backgroundColor: ['#EF4444', '#F59E0B', '#8B5CF6', '#06B6D4', '#10B981'],
        borderColor: isDark ? '#121215' : '#FFFFFF',
        borderWidth: 2
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: isDark ? '#E2E8F0' : '#1E293B',
          font: { family: "'Plus Jakarta Sans', system-ui, sans-serif", size: 10, weight: 600 as const }
        }
      }
    }
  };

  return (
    <div className="bg-white dark:bg-cyber-card rounded-sm p-4 flex flex-col shadow-xs h-full" id="matrix">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-cyber-700/50">
        <div className="flex items-center space-x-2">
          <span className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 dark:hover:text-slate-200" title="Drag to reorder panel">
            <GripVertical className="w-4 h-4" />
          </span>
          <ShieldAlert className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            Threat Tactics Matrix
          </h3>
        </div>
        <div className="flex items-center space-x-2">
          {onPullToMain && (
            <button
              onClick={onPullToMain}
              className={`px-2 py-0.5 rounded-sm text-[10px] font-mono transition flex items-center space-x-1 ${
                isMainStage
                  ? 'bg-slate-100 dark:bg-cyber-700/60 text-slate-700 dark:text-slate-300 font-semibold'
                  : 'bg-slate-50 dark:bg-cyber-800/60 hover:bg-slate-100 dark:hover:bg-cyber-700 text-slate-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400'
              }`}
              title={isMainStage ? 'Currently on Primary Stage' : 'Pull into Main Stage'}
            >
              <Maximize2 className="w-3 h-3 text-slate-400 dark:text-slate-500" />
              <span>{isMainStage ? 'Primary Stage' : 'Pull to Main'}</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 min-h-[220px] flex items-center justify-center pt-2">
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
};
