import os
import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.core.config import settings
from app.schemas import TelemetryBatchIn, TelemetryEventIn
from app.models import Device, TelemetryEvent, Alert
from app.services.detection_engine import detection_engine
from app.services.websocket_manager import ws_manager

router = APIRouter()


@router.post("/batch")
async def ingest_telemetry_batch(
    batch: TelemetryBatchIn,
    db: AsyncSession = Depends(get_db)
):
    """
    High-throughput ingestion endpoint for agent telemetry.
    Accepts batches of events, persists them, and evaluates MITRE ATT&CK detection rules.
    """
    if not batch.events:
        return {"status": "ok", "ingested": 0, "commands": []}

    first_event = batch.events[0]
    device_id = first_event.device_id

    # 1. Fetch or create Device record
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()

    if not device:
        device = Device(
            id=device_id,
            hostname=first_event.hostname,
            os_type=first_event.os_type,
            ip_address=first_event.ip_address or "127.0.0.1",
            branch_id=first_event.branch_id or "HQ-01",
            branch_name=first_event.branch_name or "Headquarters",
            latitude=first_event.latitude or "40.7128",
            longitude=first_event.longitude or "-74.0060",
            current_user=first_event.username,
            status="ONLINE",
            risk_score=0,
            last_seen=datetime.now(timezone.utc)
        )
        db.add(device)
        await db.flush()
    else:
        device.last_seen = datetime.now(timezone.utc)
        if first_event.ip_address:
            device.ip_address = first_event.ip_address
        if first_event.username:
            device.current_user = first_event.username
        if device.status == "OFFLINE":
            device.status = "ONLINE"

    # 2. Ingest and evaluate each event
    ingested_count = 0
    triggered_alerts = []
    commands = []

    for ev in batch.events:
        event_record = TelemetryEvent(
            id=ev.event_id or str(uuid.uuid4()),
            device_id=device.id,
            username=ev.username or device.current_user,
            event_type=ev.event_type,
            timestamp=ev.timestamp or datetime.now(timezone.utc),
            severity_hint=ev.severity_hint,
            payload=ev.payload
        )
        db.add(event_record)
        await db.flush()
        ingested_count += 1

        # Evaluate detection engine
        alert = await detection_engine.evaluate_event(db, event_record, device)
        if alert:
            triggered_alerts.append(alert.id)
            # If critical alert or auth failure, command agent to snap camera
            if alert.severity in ["HIGH", "CRITICAL"]:
                commands.append({"action": "CAPTURE_CAMERA_SNAPSHOT", "reason": alert.title})

    await db.commit()

    # Broadcast device status update to websocket
    await ws_manager.broadcast_json({
        "type": "DEVICE_UPDATE",
        "device": {
            "id": device.id,
            "hostname": device.hostname,
            "os_type": device.os_type,
            "status": device.status,
            "risk_score": device.risk_score,
            "current_user": device.current_user,
            "last_seen": device.last_seen.isoformat()
        }
    })

    return {
        "status": "ok",
        "ingested": ingested_count,
        "triggered_alerts": len(triggered_alerts),
        "commands": commands
    }


@router.post("/snapshot")
async def upload_camera_snapshot(
    device_id: str = Form(...),
    reason: str = Form("Security Anomaly Snapshot"),
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploads an anomaly-triggered webcam snapshot from a monitored endpoint.
    Stores the snapshot and logs an audited security event.
    """
    snapshot_filename = f"{device_id}_{int(datetime.now().timestamp())}_{file.filename}"
    snapshot_path = os.path.join(settings.SNAPSHOTS_DIR, snapshot_filename)

    with open(snapshot_path, "wb") as f:
        content = await file.read()
        f.write(content)

    # Log telemetry event
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()

    event_record = TelemetryEvent(
        id=str(uuid.uuid4()),
        device_id=device_id,
        username=device.current_user if device else "unknown",
        event_type="CAMERA_ALERT",
        timestamp=datetime.now(timezone.utc),
        severity_hint="MEDIUM",
        payload={
            "reason": reason,
            "snapshot_path": snapshot_path,
            "filename": snapshot_filename,
            "size_bytes": len(content)
        }
    )
    db.add(event_record)
    
    if device:
        await detection_engine.evaluate_event(db, event_record, device)

    await db.commit()

    return {
        "status": "ok",
        "message": "Anomaly camera snapshot securely captured and archived.",
        "filename": snapshot_filename
    }
