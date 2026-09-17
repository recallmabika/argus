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
  VerifyReportResponse
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

  async dispatchDeviceCommand(deviceId: string, action: string, parameters: Record<string, any> = {}): Promise<any> {
    const res = await fetch(`${BASE_URL}/api/v1/devices/${deviceId}/commands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, parameters })
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
  }
};
