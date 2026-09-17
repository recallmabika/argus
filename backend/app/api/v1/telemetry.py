import os
import io
import csv
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_, String
from app.core.database import get_db
from app.core.config import settings
from app.schemas import TelemetryBatchIn, TelemetryEventIn
from app.models import Device, TelemetryEvent, Alert, DeviceCommand, AuditLog
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

    # Retrieve and dispatch any pending DeviceCommand queued by analysts
    cmd_stmt = select(DeviceCommand).where(
        DeviceCommand.device_id == device.id,
        DeviceCommand.status == "PENDING"
    ).order_by(DeviceCommand.created_at)
    cmd_res = await db.execute(cmd_stmt)
    pending_cmds = cmd_res.scalars().all()
    for pc in pending_cmds:
        commands.append({
            "command_id": pc.id,
            "action": pc.command_type,
            "parameters": pc.parameters
        })
        pc.status = "DISPATCHED"

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


def _parse_time_range(time_range: Optional[str]) -> Optional[datetime]:
    if not time_range or time_range == "all":
        return None
    now = datetime.now(timezone.utc)
    mapping = {
        "1h": timedelta(hours=1),
        "6h": timedelta(hours=6),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    delta = mapping.get(time_range.lower())
    return now - delta if delta else None


@router.get("/search")
async def search_telemetry(
    q: Optional[str] = Query(None, description="Keyword search across payload, user, and event type"),
    device_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    time_range: Optional[str] = Query("24h"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """
    Threat hunting search engine across telemetry events.
    Supports payload keyword matching, faceted filtering, and time-range scoping.
    """
    query = select(TelemetryEvent)

    # Time filtering
    cutoff = _parse_time_range(time_range)
    if cutoff:
        query = query.where(TelemetryEvent.timestamp >= cutoff)

    # Specific attribute filtering
    if device_id:
        query = query.where(TelemetryEvent.device_id == device_id)
    if event_type:
        query = query.where(TelemetryEvent.event_type == event_type.upper())
    if severity:
        query = query.where(TelemetryEvent.severity_hint == severity.upper())

    # Full-text / JSON keyword search
    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(
            or_(
                TelemetryEvent.username.ilike(term),
                TelemetryEvent.event_type.ilike(term),
                TelemetryEvent.device_id.ilike(term),
                TelemetryEvent.payload.cast(String).ilike(term)
            )
        )

    # Total count query
    count_query = select(func.count()).select_from(query.subquery())
    count_res = await db.execute(count_query)
    total = count_res.scalar_one()

    # Results pagination
    query = query.order_by(desc(TelemetryEvent.timestamp)).offset(offset).limit(limit)
    res = await db.execute(query)
    events = res.scalars().all()

    return {
        "total": total,
        "offset": offset,
        "limit": limit,
        "events": [
            {
                "id": ev.id,
                "device_id": ev.device_id,
                "username": ev.username,
                "event_type": ev.event_type,
                "timestamp": ev.timestamp.isoformat(),
                "severity_hint": ev.severity_hint,
                "payload": ev.payload
            }
            for ev in events
        ]
    }


@router.get("/export")
async def export_telemetry(
    q: Optional[str] = Query(None),
    device_id: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    time_range: Optional[str] = Query("24h"),
    export_format: str = Query("csv", alias="format", pattern="^(csv|json)$"),
    limit: int = Query(2000, ge=1, le=10000),
    db: AsyncSession = Depends(get_db)
):
    """
    Streams telemetry hunting results to CSV or JSON for incident response documentation.
    """
    query = select(TelemetryEvent)

    cutoff = _parse_time_range(time_range)
    if cutoff:
        query = query.where(TelemetryEvent.timestamp >= cutoff)

    if device_id:
        query = query.where(TelemetryEvent.device_id == device_id)
    if event_type:
        query = query.where(TelemetryEvent.event_type == event_type.upper())
    if severity:
        query = query.where(TelemetryEvent.severity_hint == severity.upper())

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(
            or_(
                TelemetryEvent.username.ilike(term),
                TelemetryEvent.event_type.ilike(term),
                TelemetryEvent.device_id.ilike(term),
                TelemetryEvent.payload.cast(String).ilike(term)
            )
        )

    query = query.order_by(desc(TelemetryEvent.timestamp)).limit(limit)
    res = await db.execute(query)
    events = res.scalars().all()

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")

    if export_format.lower() == "json":
        data = [
            {
                "id": ev.id,
                "device_id": ev.device_id,
                "username": ev.username,
                "event_type": ev.event_type,
                "timestamp": ev.timestamp.isoformat(),
                "severity_hint": ev.severity_hint,
                "payload": ev.payload
            }
            for ev in events
        ]
        content = json.dumps(data, indent=2)
        return StreamingResponse(
            io.StringIO(content),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=artis_hunt_{timestamp_str}.json"}
        )
    else:
        # CSV Export
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "timestamp", "device_id", "username", "event_type", "severity", "payload"])
        for ev in events:
            writer.writerow([
                ev.id,
                ev.timestamp.isoformat(),
                ev.device_id,
                ev.username,
                ev.event_type,
                ev.severity_hint,
                json.dumps(ev.payload)
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=artis_hunt_{timestamp_str}.csv"}
        )

