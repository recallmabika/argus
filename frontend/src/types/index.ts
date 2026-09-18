export type SeverityLevel = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

export type AlertStatus = 'OPEN' | 'RESOLVED' | 'FALSE_POSITIVE';

export interface Alert {
  id: string;
  device_id: string;
  hostname?: string;
  title: string;
  description: string;
  severity: SeverityLevel;
  status: AlertStatus;
  detected_at: string;
  raw_command?: string;
  process_command?: string;
  mitre_tactic?: string;
  mitre_technique_id?: string;
  mitre_technique_name?: string;
  user?: string;
  username?: string;
}

export interface AlertStats {
  total: number;
  open: number;
  resolved: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export type DeviceStatus = 'ONLINE' | 'OFFLINE' | 'QUARANTINED';

export interface Device {
  id: string;
  hostname: string;
  ip_address: string;
  os_type: string;
  current_user?: string;
  branch_name: string;
  latitude?: number;
  longitude?: number;
  risk_score: number;
  status: DeviceStatus;
  last_seen: string;
}

export interface DeviceDetailResponse {
  device: Device;
  recent_events: Array<{
    id: string;
    event_type: string;
    timestamp: string;
    payload: Record<string, any>;
    severity?: SeverityLevel;
  }>;
}

export interface DeviceCommand {
  id: string;
  device_id: string;
  command_type: string;
  parameters: Record<string, any>;
  status: 'PENDING' | 'SENT' | 'COMPLETED' | 'FAILED';
  issued_by: string;
  result_summary?: string;
  created_at: string;
  executed_at?: string;
}

export interface UserProfile {
  user_id: string;
  full_name: string;
  role: string;
  organization_name: string;
  organization_code?: string;
}

export interface AuditEntry {
  id: string;
  timestamp: string;
  actor: string;
  action: string;
  resource_type: string;
  resource_id?: string;
  details?: Record<string, any>;
  sha256_hash?: string;
}

export interface HuntResultItem {
  timestamp: string;
  event_type: string;
  hostname: string;
  user: string;
  severity: SeverityLevel;
  payload: string;
  raw_event?: any;
}

export interface WebhookConfig {
  id: string;
  name: string;
  platform: 'SLACK' | 'DISCORD' | 'TEAMS' | 'GENERIC_JSON';
  url: string;
  min_severity: 'CRITICAL' | 'ALL';
  active: boolean;
  created_at: string;
}

export interface AttackChainResponse {
  alert_id: string;
  alert_title: string;
  alert_severity: SeverityLevel;
  target_host: string;
  stages: Array<{
    tactic: string;
    technique_id: string;
    technique_name: string;
    stage_number: number;
    count: number;
    has_target_alert: boolean;
  }>;
  timeline: Array<{
    timestamp: string;
    tactic: string;
    technique_id: string;
    technique_name: string;
    description: string;
    severity: SeverityLevel;
    is_target_event: boolean;
  }>;
}

export interface ReportGenerationResponse {
  report_id: string;
  title: string;
  sha256_hash: string;
  ed25519_signature: string;
  download_url: string;
  created_at: string;
}

export interface VerifyReportResponse {
  verified: boolean;
  sha256_hash: string;
  expected_hash?: string;
  signer_public_key: string;
  signature_valid: boolean;
  timestamp?: string;
  error?: string;
}

export interface ForensicDevice {
  id: string;
  name?: string;
  model?: string;
  type: string;
  platform?: string;
  status: string;
  connection?: string;
  battery?: { level?: number } | string;
  total_space?: number;
  details?: Record<string, any>;
}

export interface ForensicWindow {
  id: string;
  title: string;
  handle: number | string;
  process_name?: string;
}

export interface ForensicFile {
  name: string;
  type: 'file' | 'dir';
  size?: number;
  size_formatted?: string;
  modified?: string;
  path: string;
}

export interface ForensicTriage {
  os?: string;
  arch?: string;
  packages_count?: number;
  procs_count?: number;
  battery?: any;
  network?: any;
}
