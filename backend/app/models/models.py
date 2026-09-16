import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Text, ForeignKey, Boolean, Integer, JSON
from sqlalchemy.orm import relationship
from app.core.database import Base


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    username = Column(String(64), unique=True, index=True, nullable=False)
    email = Column(String(128), unique=True, index=True, nullable=False)
    hashed_password = Column(String(256), nullable=False)
    role = Column(String(32), default="analyst", nullable=False)  # analyst, admin, executive
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)


class Device(Base):
    __tablename__ = "devices"

    id = Column(String(64), primary_key=True)  # Device UUID / Hardware ID
    hostname = Column(String(128), index=True, nullable=False)
    os_type = Column(String(32), nullable=False)  # windows, linux, macos, android
    ip_address = Column(String(64), nullable=True)
    branch_id = Column(String(64), index=True, default="HQ-01")
    branch_name = Column(String(128), default="Headquarters")
    latitude = Column(String(32), default="40.7128")
    longitude = Column(String(32), default="-74.0060")
    current_user = Column(String(64), nullable=True)
    status = Column(String(32), default="ONLINE")  # ONLINE, IDLE, OFFLINE, COMPROMISED
    risk_score = Column(Integer, default=0)
    last_seen = Column(DateTime(timezone=True), default=utc_now)
    meta_info = Column(JSON, default=dict)

    events = relationship("TelemetryEvent", back_populates="device", cascade="all, delete-orphan")
    alerts = relationship("Alert", back_populates="device", cascade="all, delete-orphan")


class TelemetryEvent(Base):
    __tablename__ = "telemetry_events"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    device_id = Column(String(64), ForeignKey("devices.id"), index=True, nullable=False)
    username = Column(String(64), index=True, nullable=True)
    event_type = Column(String(64), index=True, nullable=False)
    timestamp = Column(DateTime(timezone=True), default=utc_now, index=True)
    severity_hint = Column(String(32), default="INFO")
    payload = Column(JSON, default=dict)
    raw_hash = Column(String(64), nullable=True)

    device = relationship("Device", back_populates="events")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(256), nullable=False)
    description = Column(Text, nullable=False)
    severity = Column(String(32), index=True, nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    mitre_tactic = Column(String(128), nullable=True)
    mitre_technique_id = Column(String(64), index=True, nullable=True)  # e.g., T1059.001
    mitre_technique_name = Column(String(128), nullable=True)
    device_id = Column(String(64), ForeignKey("devices.id"), index=True, nullable=False)
    username = Column(String(64), nullable=True)
    status = Column(String(32), default="OPEN", index=True)  # OPEN, INVESTIGATING, RESOLVED
    suggested_remediation = Column(Text, nullable=True)
    detected_at = Column(DateTime(timezone=True), default=utc_now, index=True)
    event_id = Column(String(36), nullable=True)
    details = Column(JSON, default=dict)

    device = relationship("Device", back_populates="alerts")


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    actor_username = Column(String(64), index=True, nullable=False)
    action = Column(String(64), nullable=False)
    target_resource = Column(String(64), nullable=False)
    target_id = Column(String(128), nullable=True)
    timestamp = Column(DateTime(timezone=True), default=utc_now, index=True)
    ip_address = Column(String(64), nullable=True)
    details = Column(JSON, default=dict)


class IncidentReport(Base):
    __tablename__ = "incident_reports"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    title = Column(String(256), nullable=False)
    report_type = Column(String(32), default="ANALYST")  # EXECUTIVE, ANALYST
    generated_by = Column(String(64), nullable=False)
    sha256_hash = Column(String(64), nullable=False)
    signature_hex = Column(Text, nullable=False)
    file_path = Column(String(512), nullable=False)
    mitre_summary = Column(JSON, default=dict)
    alert_ids = Column(JSON, default=list)
    generated_at = Column(DateTime(timezone=True), default=utc_now)
