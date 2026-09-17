import React, { createContext, useContext, useState, useCallback } from 'react';

interface MessageBoxOptions {
  type?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  message: string;
  badge?: string;
  digest?: string;
  details?: string;
  confirmText?: string;
  cancelText?: string;
  showCancel?: boolean;
}

interface ModalContextType {
  // Modal states
  isReportOpen: boolean;
  isVerifyOpen: boolean;
  isAuditOpen: boolean;
  isSettingsOpen: boolean;
  isHuntingOpen: boolean;
  isWebhooksOpen: boolean;
  isWirelessConnectOpen: boolean;
  activeForensicDeviceId: string | null;
  activeDeviceId: string | null;
  activeAttackChainAlertId: string | null;
  killProcessTarget: { deviceId?: string; defaultTarget?: string } | null;
  messageBox: (MessageBoxOptions & { resolve?: (val: boolean) => void }) | null;

  // Actions
  openWirelessConnect: () => void;
  closeWirelessConnect: () => void;
  openForensicStudio: (deviceId: string) => void;
  closeForensicStudio: () => void;
  openReport: () => void;
  closeReport: () => void;
  openVerify: () => void;
  closeVerify: () => void;
  openAudit: () => void;
  closeAudit: () => void;
  toggleAudit: () => void;
  openSettings: () => void;
  closeSettings: () => void;
  openHunting: () => void;
  closeHunting: () => void;
  openWebhooks: () => void;
  closeWebhooks: () => void;
  openDeviceDetail: (deviceId: string) => void;
  closeDeviceDetail: () => void;
  openAttackChain: (alertId: string) => void;
  closeAttackChain: () => void;
  openKillProcess: (deviceId?: string, defaultTarget?: string) => void;
  closeKillProcess: () => void;
  alert: (options: MessageBoxOptions | string) => Promise<boolean>;
  confirm: (options: MessageBoxOptions | string) => Promise<boolean>;
  closeMessageBox: (result: boolean) => void;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export const ModalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isVerifyOpen, setIsVerifyOpen] = useState(false);
  const [isAuditOpen, setIsAuditOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHuntingOpen, setIsHuntingOpen] = useState(false);
  const [isWebhooksOpen, setIsWebhooksOpen] = useState(false);
  const [isWirelessConnectOpen, setIsWirelessConnectOpen] = useState(false);
  const [activeForensicDeviceId, setActiveForensicDeviceId] = useState<string | null>(null);
  const [activeDeviceId, setActiveDeviceId] = useState<string | null>(null);
  const [activeAttackChainAlertId, setActiveAttackChainAlertId] = useState<string | null>(null);
  const [killProcessTarget, setKillProcessTarget] = useState<{ deviceId?: string; defaultTarget?: string } | null>(null);
  const [messageBox, setMessageBox] = useState<(MessageBoxOptions & { resolve?: (val: boolean) => void }) | null>(null);

  const openWirelessConnect = useCallback(() => setIsWirelessConnectOpen(true), []);
  const closeWirelessConnect = useCallback(() => setIsWirelessConnectOpen(false), []);

  const openForensicStudio = useCallback((deviceId: string) => setActiveForensicDeviceId(deviceId), []);
  const closeForensicStudio = useCallback(() => setActiveForensicDeviceId(null), []);

  const openReport = useCallback(() => setIsReportOpen(true), []);
  const closeReport = useCallback(() => setIsReportOpen(false), []);

  const openVerify = useCallback(() => setIsVerifyOpen(true), []);
  const closeVerify = useCallback(() => setIsVerifyOpen(false), []);

  const openAudit = useCallback(() => setIsAuditOpen(true), []);
  const closeAudit = useCallback(() => setIsAuditOpen(false), []);
  const toggleAudit = useCallback(() => setIsAuditOpen(prev => !prev), []);

  const openSettings = useCallback(() => setIsSettingsOpen(true), []);
  const closeSettings = useCallback(() => setIsSettingsOpen(false), []);

  const openHunting = useCallback(() => setIsHuntingOpen(true), []);
  const closeHunting = useCallback(() => setIsHuntingOpen(false), []);

  const openWebhooks = useCallback(() => setIsWebhooksOpen(true), []);
  const closeWebhooks = useCallback(() => setIsWebhooksOpen(false), []);

  const openDeviceDetail = useCallback((deviceId: string) => setActiveDeviceId(deviceId), []);
  const closeDeviceDetail = useCallback(() => setActiveDeviceId(null), []);

  const openAttackChain = useCallback((alertId: string) => setActiveAttackChainAlertId(alertId), []);
  const closeAttackChain = useCallback(() => setActiveAttackChainAlertId(null), []);

  const openKillProcess = useCallback((deviceId?: string, defaultTarget?: string) => {
    setKillProcessTarget({ deviceId, defaultTarget });
  }, []);
  const closeKillProcess = useCallback(() => setKillProcessTarget(null), []);

  const alert = useCallback((options: MessageBoxOptions | string) => {
    return new Promise<boolean>((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : options;
      setMessageBox({
        ...opts,
        type: opts.type || 'info',
        title: opts.title || 'System Notification',
        confirmText: opts.confirmText || 'Acknowledge',
        showCancel: false,
        resolve
      });
    });
  }, []);

  const confirm = useCallback((options: MessageBoxOptions | string) => {
    return new Promise<boolean>((resolve) => {
      const opts = typeof options === 'string' ? { message: options } : options;
      setMessageBox({
        ...opts,
        type: opts.type || 'warning',
        title: opts.title || 'Action Confirmation',
        badge: opts.badge || 'CONFIRMATION',
        confirmText: opts.confirmText || 'Confirm',
        cancelText: opts.cancelText || 'Cancel',
        showCancel: true,
        resolve
      });
    });
  }, []);

  const closeMessageBox = useCallback((result: boolean) => {
    if (messageBox?.resolve) {
      messageBox.resolve(result);
    }
    setMessageBox(null);
  }, [messageBox]);

  return (
    <ModalContext.Provider
      value={{
        isReportOpen,
        isVerifyOpen,
        isAuditOpen,
        isSettingsOpen,
        isHuntingOpen,
        isWebhooksOpen,
        isWirelessConnectOpen,
        activeForensicDeviceId,
        activeDeviceId,
        activeAttackChainAlertId,
        killProcessTarget,
        messageBox,
        openWirelessConnect,
        closeWirelessConnect,
        openForensicStudio,
        closeForensicStudio,
        openReport,
        closeReport,
        openVerify,
        closeVerify,
        openAudit,
        closeAudit,
        toggleAudit,
        openSettings,
        closeSettings,
        openHunting,
        closeHunting,
        openWebhooks,
        closeWebhooks,
        openDeviceDetail,
        closeDeviceDetail,
        openAttackChain,
        closeAttackChain,
        openKillProcess,
        closeKillProcess,
        alert,
        confirm,
        closeMessageBox
      }}
    >
      {children}
    </ModalContext.Provider>
  );
};

export const useModals = () => {
  const context = useContext(ModalContext);
  if (!context) throw new Error('useModals must be used within ModalProvider');
  return context;
};
