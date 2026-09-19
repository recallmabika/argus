from fastapi import APIRouter, Depends
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, desc
from datetime import datetime, timedelta

from app.core.database import get_db
from app.models import TelemetryEvent, Alert, AuditLog, DeviceCommand, Device

router = APIRouter()

def _parse_time_range(time_range: str) -> datetime:
    now = datetime.utcnow()
    if time_range == "1h":
        return now - timedelta(hours=1)
    elif time_range == "6h":
        return now - timedelta(hours=6)
    elif time_range == "24h":
        return now - timedelta(hours=24)
    elif time_range == "7d":
        return now - timedelta(days=7)
    elif time_range == "30d":
        return now - timedelta(days=30)
    return now - timedelta(hours=24)  # Default

@router.get("/")
async def get_incident_timeline(
    device_id: Optional[str] = None,
    username: Optional[str] = None,
    time_range: Optional[str] = "24h",  # 1h, 6h, 24h, 7d, 30d
    limit: int = 200,
    db: AsyncSession = Depends(get_db)
):
    cutoff = _parse_time_range(time_range)
    timeline = []

    # Telemetry
    telemetry_query = select(TelemetryEvent).where(TelemetryEvent.timestamp >= cutoff)
    if device_id:
        telemetry_query = telemetry_query.where(TelemetryEvent.device_id == device_id)
    
    result = await db.execute(telemetry_query)
    for event in result.scalars().all():
        timeline.append({
            "id": f"tel_{event.id}",
            "timestamp": event.timestamp,
            "source_type": "telemetry",
            "title": event.event_type,
            "description": str(event.payload)[:100] + "..." if event.payload else "No payload",
            "severity": "info",
            "device_id": event.device_id,
            "username": None,
            "details": event.payload
        })

    # Alert
    alert_query = select(Alert).where(Alert.detected_at >= cutoff)
    if device_id:
        alert_query = alert_query.where(Alert.device_id == device_id)
    
    result = await db.execute(alert_query)
    for alert in result.scalars().all():
        timeline.append({
            "id": f"alt_{alert.id}",
            "timestamp": alert.detected_at.isoformat() if alert.detected_at else "",
            "source_type": "alert",
            "title": alert.title,
            "description": alert.description,
            "severity": alert.severity,
            "device_id": alert.device_id,
            "username": alert.username,
            "details": {"status": alert.status, "mitre_tactic": alert.mitre_tactic, "mitre_technique_id": alert.mitre_technique_id}
        })

    # AuditLog
    audit_query = select(AuditLog).where(AuditLog.timestamp >= cutoff)
    if username:
        audit_query = audit_query.where(AuditLog.actor_username == username)
    
    result = await db.execute(audit_query)
    for log in result.scalars().all():
        timeline.append({
            "id": f"aud_{log.id}",
            "timestamp": log.timestamp.isoformat() if log.timestamp else "",
            "source_type": "audit",
            "title": log.action,
            "description": log.target_resource,
            "severity": "LOW",
            "device_id": log.target_id if log.target_resource == "device" else None,
            "username": log.actor_username,
            "details": log.details
        })

    # DeviceCommand
    cmd_query = select(DeviceCommand).where(DeviceCommand.created_at >= cutoff)
    if device_id:
        cmd_query = cmd_query.where(DeviceCommand.device_id == device_id)
    if username:
        cmd_query = cmd_query.where(DeviceCommand.issued_by == username)

    result = await db.execute(cmd_query)
    for cmd in result.scalars().all():
        timeline.append({
            "id": f"cmd_{cmd.id}",
            "timestamp": cmd.created_at.isoformat() if cmd.created_at else "",
            "source_type": "command",
            "title": cmd.command_type,
            "description": f"Status: {cmd.status}. Params: {str(cmd.parameters)[:50]}",
            "severity": "LOW" if cmd.status == "COMPLETED" else "MEDIUM",
            "device_id": cmd.device_id,
            "username": cmd.issued_by,
            "details": cmd.parameters
        })

    # Ensure all telemetry timestamps are isoformatted
    for item in timeline:
        if isinstance(item["timestamp"], datetime):
            item["timestamp"] = item["timestamp"].isoformat()

    # Sort descending
    timeline.sort(key=lambda x: x["timestamp"], reverse=True)
    trimmed = timeline[:limit]
    return {"total": len(timeline), "events": trimmed}
