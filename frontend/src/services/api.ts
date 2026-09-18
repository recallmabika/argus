import {
  Alert,
  AlertStats,
  Device,
  DeviceDetailResponse,
  UserProfile,
  AuditEntry,
  HuntResultItem,
  WebhookConfig,
  AttackChainResponse,
  ReportGenerationResponse,
  VerifyReportResponse,
  ForensicDevice,
  ForensicWindow,
  ForensicFile,
  ForensicTriage,
  DeviceCommand
} from '../types';

const BASE_URL = ''; // Relative URL handled by Vite proxy or FastAPI in production

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`API Error [${res.status}]: ${errText || res.statusText}`);
  }
  return res.json();
}

export const api = {
  // Alerts
  async getAlerts(limit = 50): Promise<Alert[]> {
    const res = await fetch(`${BASE_URL}/api/v1/alerts?limit=${limit}`);
    return handleResponse<Alert[]>(res);
  },

  async resolveAlert(alertId: string): Promise<Alert> {
    const res = await fetch(`${BASE_URL}/api/v1/alerts/${alertId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED' })
    });
    return handleResponse<Alert>(res);
  },

  async getAlertStats(): Promise<AlertStats> {
    const res = await fetch(`${BASE_URL}/api/v1/alerts/stats/summary`);
    return handleResponse<AlertStats>(res);
  },

  async getAttackChain(alertId: string): Promise<AttackChainResponse> {
    const res = await fetch(`${BASE_URL}/api/v1/alerts/${alertId}/attack-chain`);
    return handleResponse<AttackChainResponse>(res);
  },

  // Devices
  async getDevices(): Promise<Device[]> {
    const res = await fetch(`${BASE_URL}/api/v1/devices`);
    return handleResponse<Device[]>(res);
  },

  async getDeviceDetail(deviceId: string): Promise<DeviceDetailResponse> {
    const res = await fetch(`${BASE_URL}/api/v1/devices/${deviceId}`);
    return handleResponse<DeviceDetailResponse>(res);
  },

  async dispatchDeviceCommand(deviceId: string, action: string, parameters: Record<string, any> = {}): Promise<DeviceCommand> {
    const res = await fetch(`${BASE_URL}/api/v1/devices/${deviceId}/command`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command_type: action, parameters, issued_by: 'analyst' })
    });
    return handleResponse<DeviceCommand>(res);
  },

  async getDeviceCommands(deviceId: string, limit = 20): Promise<DeviceCommand[]> {
    const res = await fetch(`${BASE_URL}/api/v1/devices/${deviceId}/commands?limit=${limit}`);
    return handleResponse<DeviceCommand[]>(res);
  },

  async enrollDevice(payload: {
    hostname: string;
    os_type?: string;
    ip_address?: string;
    current_user?: string;
    branch_name?: string;
    status?: string;
  }): Promise<Device> {
    const res = await fetch(`${BASE_URL}/api/v1/devices`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse<Device>(res);
  },

  async detectLocalHost(): Promise<{
    hostname: string;
    username: string;
    os_type: string;
    ip_address: string;
    suggested_id: string;
  }> {
    const res = await fetch(`${BASE_URL}/api/v1/devices/local-host/detect`);
    return handleResponse(res);
  },

  async unenrollDevice(deviceId: string): Promise<{ status: string; message: string }> {
    const res = await fetch(`${BASE_URL}/api/v1/devices/${encodeURIComponent(deviceId)}`, {
      method: 'DELETE'
    });
    return handleResponse(res);
  },

  // Users
  async getUserProfile(): Promise<UserProfile> {
    const res = await fetch(`${BASE_URL}/api/v1/users/me`);
    return handleResponse<UserProfile>(res);
  },

  // Audit
  async getAuditLogs(limit = 50): Promise<AuditEntry[]> {
    const res = await fetch(`${BASE_URL}/api/v1/audit?limit=${limit}`);
    return handleResponse<AuditEntry[]>(res);
  },

  // Reports
  async generateReport(title: string, audience: 'ANALYST' | 'EXECUTIVE' = 'ANALYST'): Promise<ReportGenerationResponse> {
    const res = await fetch(`${BASE_URL}/api/v1/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, audience })
    });
    return handleResponse<ReportGenerationResponse>(res);
  },

  async verifyReport(file: File): Promise<VerifyReportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${BASE_URL}/api/v1/reports/verify`, {
      method: 'POST',
      body: formData
    });
    return handleResponse<VerifyReportResponse>(res);
  },

  // Threat Hunting
  async searchHunt(query: string, eventType = '', severity = '', hours = '24'): Promise<{ count: number; events: HuntResultItem[] }> {
    const params = new URLSearchParams();
    if (query) params.set('q', query);
    if (eventType) params.set('event_type', eventType);
    if (severity) params.set('severity', severity);
    if (hours) params.set('hours', hours);
    const res = await fetch(`${BASE_URL}/api/v1/hunting/search?${params.toString()}`);
    return handleResponse(res);
  },

  // Webhooks
  async getWebhooks(): Promise<WebhookConfig[]> {
    const res = await fetch(`${BASE_URL}/api/v1/webhooks`);
    return handleResponse<WebhookConfig[]>(res);
  },

  async registerWebhook(data: { name: string; platform: string; url: string; min_severity: string }): Promise<WebhookConfig> {
    const res = await fetch(`${BASE_URL}/api/v1/webhooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return handleResponse<WebhookConfig>(res);
  },

  async deleteWebhook(webhookId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/api/v1/webhooks/${webhookId}`, {
      method: 'DELETE'
    });
    return handleResponse(res);
  },

  // Forensics Device Bridge & Studio
  async getForensicDevices(): Promise<{ count: number; devices: ForensicDevice[] }> {
    const res = await fetch(`${BASE_URL}/api/v1/forensics/devices`);
    return handleResponse(res);
  },

  async connectWireless(ip: string, port: number = 5555): Promise<{ status: string; message: string }> {
    const res = await fetch(`${BASE_URL}/api/v1/forensics/connect-wireless`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ip, port })
    });
    return handleResponse(res);
  },

  async disconnectForensicDevice(deviceId: string): Promise<{ success: boolean }> {
    const res = await fetch(`${BASE_URL}/api/v1/forensics/devices/${encodeURIComponent(deviceId)}/disconnect`, {
      method: 'POST'
    });
    return handleResponse(res);
  },

  async getDeviceWindows(deviceId: string): Promise<{ count: number; windows: ForensicWindow[] }> {
    const res = await fetch(`${BASE_URL}/api/v1/forensics/devices/${encodeURIComponent(deviceId)}/windows`);
    return handleResponse(res);
  },

  async sendForensicInput(deviceId: string, payload: Record<string, any>): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/v1/forensics/devices/${encodeURIComponent(deviceId)}/input`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    return handleResponse(res);
  },

  async listForensicFiles(deviceId: string, path: string): Promise<{ path: string; items: ForensicFile[] }> {
    const res = await fetch(`${BASE_URL}/api/v1/forensics/devices/${encodeURIComponent(deviceId)}/files?path=${encodeURIComponent(path)}`);
    return handleResponse(res);
  },

  async getForensicTriage(deviceId: string): Promise<ForensicTriage> {
    const res = await fetch(`${BASE_URL}/api/v1/forensics/devices/${encodeURIComponent(deviceId)}/triage`);
    return handleResponse(res);
  },

  async executeForensicShell(deviceId: string, command: string): Promise<{ output: string; exit_code?: number }> {
    const res = await fetch(`${BASE_URL}/api/v1/forensics/devices/${encodeURIComponent(deviceId)}/shell`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command })
    });
    return handleResponse(res);
  }
};
