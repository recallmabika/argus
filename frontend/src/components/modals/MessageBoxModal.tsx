import React from 'react';
import { Info, CheckCircle2, AlertTriangle, AlertOctagon } from 'lucide-react';
import { useModals } from '../../context/ModalContext';
import { Button } from '../common/Button';

export const MessageBoxModal: React.FC = () => {
  const { messageBox, closeMessageBox } = useModals();

  if (!messageBox) return null;

  const {
    type = 'info',
    title = 'System Notice',
    message,
    badge,
    details,
    confirmText = 'OK',
    cancelText = 'Cancel',
    showCancel = false
  } = messageBox;

  const iconMap = {
    info: <Info className="w-5 h-5" />,
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500" />,
    danger: <AlertOctagon className="w-5 h-5 text-rose-500" />
  };

  return (
    <div className="fixed inset-0 z-[90] bg-black/75 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white dark:bg-cyber-card border border-slate-200 dark:border-cyber-700/80 rounded-sm w-full max-w-md p-6 shadow-2xl space-y-4 text-xs">
        <div className="flex items-start space-x-3">
          <div className="p-2 rounded-sm bg-slate-100 dark:bg-cyber-800 text-slate-800 dark:text-slate-200 flex-shrink-0">
            {iconMap[type]}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider truncate">
                {title}
              </h3>
              {badge && (
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wider bg-slate-200 dark:bg-cyber-700 text-slate-700 dark:text-slate-300">
                  {badge}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed break-words">
              {message}
            </p>
          </div>
        </div>

        {details && (
          <div className="p-2.5 bg-slate-100 dark:bg-cyber-900/60 border border-slate-200 dark:border-cyber-700 rounded-sm font-mono text-[11px] text-slate-700 dark:text-slate-300 max-h-32 overflow-y-auto custom-scrollbar whitespace-pre-wrap">
            {details}
          </div>
        )}

        <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100 dark:border-cyber-700/60">
          {showCancel && (
            <Button variant="secondary" onClick={() => closeMessageBox(false)}>
              {cancelText}
            </Button>
          )}
          <Button variant="primary" onClick={() => closeMessageBox(true)}>
            {confirmText}
          </Button>
        </div>
      </div>
    </div>
  );
};
