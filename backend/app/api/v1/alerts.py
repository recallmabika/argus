import uuid
from datetime import datetime, timezone, timedelta
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_
from pydantic import BaseModel

from app.core.database import get_db
from app.models import Alert, Device, TelemetryEvent, WebhookConfig
from app.schemas import AlertOut, WebhookConfigIn, WebhookConfigOut
from app.services.webhook_dispatcher import webhook_dispatcher

router = APIRouter()


class AlertStatusUpdate(BaseModel):
    status: str  # OPEN, INVESTIGATING, RESOLVED, FALSE_POSITIVE


@router.get("", response_model=List[AlertOut])
async def list_alerts(
    status: Optional[str] = None,
    severity: Optional[str] = None,
    device_id: Optional[str] = None,
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Lists security threat alerts with optional filtering."""
    stmt = select(Alert).order_by(desc(Alert.detected_at)).limit(limit)
    if status:
        stmt = stmt.where(Alert.status == status.upper())
    if severity:
        stmt = stmt.where(Alert.severity == severity.upper())
    if device_id:
        stmt = stmt.where(Alert.device_id == device_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/stats/summary")
async def get_alerts_summary(db: AsyncSession = Depends(get_db)):
    """Summary statistics of active threats and MITRE tactics."""
    total = await db.scalar(select(func.count(Alert.id))) or 0
    critical = await db.scalar(select(func.count(Alert.id)).where(Alert.severity == "CRITICAL")) or 0
    high = await db.scalar(select(func.count(Alert.id)).where(Alert.severity == "HIGH")) or 0
    medium = await db.scalar(select(func.count(Alert.id)).where(Alert.severity == "MEDIUM")) or 0
    open_count = await db.scalar(select(func.count(Alert.id)).where(Alert.status == "OPEN")) or 0

    return {
        "total_alerts": total,
        "critical": critical,
        "high": high,
        "medium": medium,
        "open": open_count
    }


# Webhook Management Endpoints
@router.get("/webhooks", response_model=List[WebhookConfigOut])
async def list_webhooks(db: AsyncSession = Depends(get_db)):
    """Lists all configured notification webhooks (Discord, Slack, SIEM)."""
    res = await db.execute(select(WebhookConfig).order_by(desc(WebhookConfig.created_at)))
    return res.scalars().all()


@router.post("/webhooks", response_model=WebhookConfigOut)
async def create_webhook(
    config: WebhookConfigIn,
    db: AsyncSession = Depends(get_db)
):
    """Registers a new alerting webhook destination."""
    wh = WebhookConfig(
        id=str(uuid.uuid4()),
        name=config.name.strip(),
        url=config.url.strip(),
        webhook_type=config.webhook_type.upper(),
        min_severity=config.min_severity.upper(),
        is_enabled=config.is_enabled,
        created_at=datetime.now(timezone.utc)
    )
    db.add(wh)
    await db.commit()
    await db.refresh(wh)
    return wh


@router.delete("/webhooks/{webhook_id}")
async def delete_webhook(
    webhook_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Removes a configured webhook."""
    res = await db.execute(select(WebhookConfig).where(WebhookConfig.id == webhook_id))
    wh = res.scalar_one_or_none()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook configuration not found")
    
    await db.delete(wh)
    await db.commit()
    return {"status": "ok", "message": "Webhook successfully deleted"}


@router.post("/webhooks/{webhook_id}/test")
async def test_webhook_destination(
    webhook_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Sends a live test alert to the specified webhook to verify connectivity."""
    res = await db.execute(select(WebhookConfig).where(WebhookConfig.id == webhook_id))
    wh = res.scalar_one_or_none()
    if not wh:
        raise HTTPException(status_code=404, detail="Webhook configuration not found")
    
    success, status_code, message = await webhook_dispatcher.test_webhook(wh)
    return {
        "success": success,
        "status_code": status_code,
        "message": message
    }


# Alert Detail & Status
@router.get("/{alert_id}", response_model=AlertOut)
async def get_alert(
    alert_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Fetches details for a specific alert."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@router.patch("/{alert_id}")
async def update_alert_status(
    alert_id: str,
    update_data: AlertStatusUpdate,
    db: AsyncSession = Depends(get_db)
):
    """Updates the status of an alert (e.g. mark RESOLVED or INVESTIGATING)."""
    result = await db.execute(select(Alert).where(Alert.id == alert_id))
    alert = result.scalar_one_or_none()
    if not alert:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    alert.status = update_data.status.upper()
    await db.commit()
    await db.refresh(alert)
    return {"status": "ok", "alert_id": alert.id, "new_status": alert.status}


@router.get("/{alert_id}/attack-chain")
async def get_alert_attack_chain(
    alert_id: str,
    db: AsyncSession = Depends(get_db)
):
    """
    Reconstructs the multi-stage MITRE ATT&CK incident kill-chain for an alert.
    Collects correlated detections and telemetry on the compromised host,
    mapping them across standard MITRE tactics from Initial Access to Impact.
    """
    res = await db.execute(select(Alert).where(Alert.id == alert_id))
    target_alert = res.scalar_one_or_none()
    if not target_alert:
        raise HTTPException(status_code=404, detail="Alert not found")

    device_res = await db.execute(select(Device).where(Device.id == target_alert.device_id))
    device = device_res.scalar_one_or_none()

    # Time window: +/- 24 hours around target alert
    base_time = target_alert.detected_at or datetime.now(timezone.utc)
    start_time = base_time - timedelta(hours=24)
    end_time = base_time + timedelta(hours=24)

    # Fetch correlated alerts on the same device
    alerts_stmt = (
        select(Alert)
        .where(Alert.device_id == target_alert.device_id)
        .where(Alert.detected_at >= start_time)
        .where(Alert.detected_at <= end_time)
        .order_by(Alert.detected_at.asc())
    )
    alerts_res = await db.execute(alerts_stmt)
    correlated_alerts = alerts_res.scalars().all()

    # Standard MITRE Tactics sequence
    mitre_stages_def = [
        {"tactic": "Initial Access", "description": "Entry vectors (phishing, removable media, network services)"},
        {"tactic": "Execution", "description": "Running adversary-controlled code (PowerShell, CMD, scripts)"},
        {"tactic": "Persistence", "description": "Maintaining access across reboots (Registry, scheduled tasks)"},
        {"tactic": "Privilege Escalation", "description": "Gaining higher-level permissions (SYSTEM/root)"},
        {"tactic": "Defense Evasion", "description": "Avoiding detection, terminating security agents or logging"},
        {"tactic": "Credential Access", "description": "Stealing credentials (SAM, LSASS, brute force)"},
        {"tactic": "Discovery", "description": "Post-compromise reconnaissance (network scan, net view)"},
        {"tactic": "Lateral Movement", "description": "Pivoting between workstations and servers"},
        {"tactic": "Collection", "description": "Gathering target data, keystrokes, clipboard, screenshots"},
        {"tactic": "Command and Control", "description": "Communicating with external attacker C2 servers"},
        {"tactic": "Exfiltration", "description": "Stealing data via cloud, USB, or spooled print jobs"},
        {"tactic": "Impact", "description": "Disrupting availability, ransomware encryption, wiper"}
    ]

    # Map detected alerts into tactics
    alerts_by_tactic: Dict[str, List[Dict[str, Any]]] = {}
    timeline = []

    for al in correlated_alerts:
        tactic_name = al.mitre_tactic or "Unknown"
        item = {
            "id": al.id,
            "title": al.title,
            "severity": al.severity,
            "tactic": tactic_name,
            "technique_id": al.mitre_technique_id,
            "technique_name": al.mitre_technique_name,
            "timestamp": al.detected_at.isoformat() if al.detected_at else "",
            "is_target": (al.id == target_alert.id),
            "status": al.status,
            "suggested_remediation": al.suggested_remediation
        }
        timeline.append(item)
        if tactic_name not in alerts_by_tactic:
            alerts_by_tactic[tactic_name] = []
        alerts_by_tactic[tactic_name].append(item)

    stages_result = []
    for stage in mitre_stages_def:
        matched = alerts_by_tactic.get(stage["tactic"], [])
        stages_result.append({
            "tactic": stage["tactic"],
            "description": stage["description"],
            "observed": len(matched) > 0,
            "count": len(matched),
            "alerts": matched
        })

    return {
        "alert": {
            "id": target_alert.id,
            "title": target_alert.title,
            "severity": target_alert.severity,
            "mitre_tactic": target_alert.mitre_tactic,
            "mitre_technique_id": target_alert.mitre_technique_id,
            "mitre_technique_name": target_alert.mitre_technique_name,
            "detected_at": target_alert.detected_at.isoformat() if target_alert.detected_at else "",
            "status": target_alert.status,
            "details": target_alert.details or {}
        },
        "device": {
            "id": device.id if device else target_alert.device_id,
            "hostname": device.hostname if device else "Unknown",
            "os_type": device.os_type if device else "Unknown",
            "risk_score": device.risk_score if device else 0,
            "status": device.status if device else "ONLINE"
        },
        "timeline": timeline,
        "stages": stages_result
    }
