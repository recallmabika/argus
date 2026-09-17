import React from 'react';
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';
import { ShieldAlert } from 'lucide-react';
import { Alert } from '../../types';
import { useTheme } from '../../context/ThemeContext';

ChartJS.register(ArcElement, Tooltip, Legend);

interface MitreChartCardProps {
  alerts: Alert[];
}

export const MitreChartCard: React.FC<MitreChartCardProps> = ({ alerts }) => {
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
    <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/60 rounded-sm p-4 flex flex-col shadow-xs">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-cyber-700/50">
        <div className="flex items-center space-x-2">
          <ShieldAlert className="w-4 h-4 text-slate-400" />
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
            MITRE ATT&amp;CK Tactics Matrix
          </h3>
        </div>
        <span className="text-[10px] font-mono text-slate-400">Enterprise Framework</span>
      </div>

      <div className="flex-1 min-h-[220px] flex items-center justify-center pt-2">
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
};
