from typing import Optional, List, Dict, Any
from datetime import datetime
from pydantic import BaseModel, Field


class TelemetryEventIn(BaseModel):
    event_id: Optional[str] = None
    device_id: str
    hostname: str
    os_type: str = "windows"
    ip_address: Optional[str] = None
    username: Optional[str] = None
    branch_id: Optional[str] = "HQ-01"
    branch_name: Optional[str] = "Headquarters"
    latitude: Optional[str] = "40.7128"
    longitude: Optional[str] = "-74.0060"
    event_type: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    severity_hint: str = "INFO"
    payload: Dict[str, Any] = Field(default_factory=dict)


class TelemetryBatchIn(BaseModel):
    events: List[TelemetryEventIn]


class DeviceCreateIn(BaseModel):
    hostname: str
    os_type: str = "windows"
    ip_address: Optional[str] = "127.0.0.1"
    current_user: Optional[str] = "analyst"
    branch_name: Optional[str] = "Headquarters"
    branch_id: Optional[str] = "BRANCH-HQ-01"
    latitude: Optional[str] = "40.7128"
    longitude: Optional[str] = "-74.0060"
    status: Optional[str] = "ONLINE"


class DeviceOut(BaseModel):
    id: str
    hostname: str
    os_type: str
    ip_address: Optional[str]
    branch_id: str
    branch_name: str
    latitude: str
    longitude: str
    current_user: Optional[str]
    status: str
    risk_score: int
    last_seen: datetime

    class Config:
        from_attributes = True


class AlertOut(BaseModel):
    id: str
    title: str
    description: str
    severity: str
    mitre_tactic: Optional[str]
    mitre_technique_id: Optional[str]
    mitre_technique_name: Optional[str]
    device_id: str
    username: Optional[str]
    status: str
    suggested_remediation: Optional[str]
    detected_at: datetime
    details: Dict[str, Any]

    class Config:
        from_attributes = True


class ReportGenerateIn(BaseModel):
    title: str = "Argus CyberSecOps Incident & Telemetry Assessment Report"
    report_type: str = "ANALYST"  # EXECUTIVE or ANALYST
    alert_ids: Optional[List[str]] = None


class ReportVerifyIn(BaseModel):
    sha256_hash: str
    signature_hex: str


class AuditLogOut(BaseModel):
    id: str
    actor_username: str
    action: str
    target_resource: str
    target_id: Optional[str]
    timestamp: datetime
    ip_address: Optional[str]
    details: Dict[str, Any]

    class Config:
        from_attributes = True


class DeviceCommandIn(BaseModel):
    command_type: str  # ISOLATE_NETWORK, RESTORE_NETWORK, TERMINATE_PROCESS, CAPTURE_FORENSIC_TRIAGE
    parameters: Dict[str, Any] = Field(default_factory=dict)
    issued_by: Optional[str] = "analyst"


class DeviceCommandOut(BaseModel):
    id: str
    device_id: str
    command_type: str
    parameters: Dict[str, Any]
    status: str
    issued_by: str
    result_summary: Optional[str]
    created_at: datetime
    executed_at: Optional[datetime]

    class Config:
        from_attributes = True


class DeviceCommandAckIn(BaseModel):
    command_id: str
    status: str = "COMPLETED"  # COMPLETED or FAILED
    result_summary: Optional[str] = None


class WebhookConfigIn(BaseModel):
    name: str
    url: str
    webhook_type: str = "GENERIC_JSON"  # DISCORD, SLACK, GENERIC_JSON, SYSLOG
    min_severity: str = "HIGH"  # HIGH, CRITICAL, ALL
    is_enabled: bool = True


class WebhookConfigOut(BaseModel):
    id: str
    name: str
    url: str
    webhook_type: str
    min_severity: str
    is_enabled: bool
    created_at: datetime

    class Config:
        from_attributes = True

