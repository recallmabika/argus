import io
import csv
import json
from datetime import datetime, timezone, timedelta
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_, String
from app.core.database import get_db
from app.models import Device, TelemetryEvent

router = APIRouter()


def _parse_hunting_time_range(hours: Optional[str], time_range: Optional[str]) -> Optional[datetime]:
    val = hours or time_range
    if not val or val == "all":
        return None
    now = datetime.now(timezone.utc)
    
    # Check if number of hours
    try:
        hrs = float(val)
        return now - timedelta(hours=hrs)
    except ValueError:
        pass
        
    mapping = {
        "1h": timedelta(hours=1),
        "6h": timedelta(hours=6),
        "24h": timedelta(hours=24),
        "7d": timedelta(days=7),
        "30d": timedelta(days=30),
    }
    delta = mapping.get(str(val).lower())
    return now - delta if delta else now - timedelta(hours=24)


@router.get("/search")
async def search_hunting(
    q: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    hours: Optional[str] = Query(None),
    time_range: Optional[str] = Query(None),
    device_id: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=1000),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    """
    Dedicated Threat Hunting telemetry query engine.
    Matches queries by keyword, event category, severity and timeframe.
    """
    query = select(TelemetryEvent, Device.hostname).outerjoin(Device, TelemetryEvent.device_id == Device.id)

    cutoff = _parse_hunting_time_range(hours, time_range)
    if cutoff:
        query = query.where(TelemetryEvent.timestamp >= cutoff)

    if device_id:
        query = query.where(TelemetryEvent.device_id == device_id)
    if event_type and event_type.strip():
        query = query.where(TelemetryEvent.event_type == event_type.upper().strip())
    if severity and severity.strip():
        query = query.where(TelemetryEvent.severity_hint == severity.upper().strip())

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(
            or_(
                TelemetryEvent.username.ilike(term),
                TelemetryEvent.event_type.ilike(term),
                TelemetryEvent.device_id.ilike(term),
                TelemetryEvent.payload.cast(String).ilike(term),
                Device.hostname.ilike(term)
            )
        )

    # Count
    count_query = select(func.count()).select_from(query.subquery())
    count_res = await db.execute(count_query)
    total = count_res.scalar_one()

    # Results
    query = query.order_by(desc(TelemetryEvent.timestamp)).offset(offset).limit(limit)
    res = await db.execute(query)
    rows = res.all()

    formatted_events = []
    for ev, hostname in rows:
        payload_str = json.dumps(ev.payload) if isinstance(ev.payload, (dict, list)) else str(ev.payload or "")
        formatted_events.append({
            "id": ev.id,
            "timestamp": ev.timestamp.isoformat() if ev.timestamp else "",
            "event_type": ev.event_type,
            "device_id": ev.device_id,
            "hostname": hostname or ev.device_id,
            "user": ev.username or "system",
            "username": ev.username or "system",
            "severity": ev.severity_hint or "INFO",
            "payload": payload_str,
            "raw_event": ev.payload
        })

    return {
        "count": total,
        "total": total,
        "offset": offset,
        "limit": limit,
        "events": formatted_events
    }


@router.get("/export")
async def export_hunting(
    q: Optional[str] = Query(None),
    event_type: Optional[str] = Query(None),
    severity: Optional[str] = Query(None),
    hours: Optional[str] = Query(None),
    time_range: Optional[str] = Query(None),
    device_id: Optional[str] = Query(None),
    export_format: str = Query("csv", alias="format", pattern="^(csv|json)$"),
    limit: int = Query(2500, ge=1, le=10000),
    db: AsyncSession = Depends(get_db)
):
    """
    Exports threat hunting investigations directly to CSV or JSON.
    """
    query = select(TelemetryEvent, Device.hostname).outerjoin(Device, TelemetryEvent.device_id == Device.id)

    cutoff = _parse_hunting_time_range(hours, time_range)
    if cutoff:
        query = query.where(TelemetryEvent.timestamp >= cutoff)

    if device_id:
        query = query.where(TelemetryEvent.device_id == device_id)
    if event_type and event_type.strip():
        query = query.where(TelemetryEvent.event_type == event_type.upper().strip())
    if severity and severity.strip():
        query = query.where(TelemetryEvent.severity_hint == severity.upper().strip())

    if q and q.strip():
        term = f"%{q.strip()}%"
        query = query.where(
            or_(
                TelemetryEvent.username.ilike(term),
                TelemetryEvent.event_type.ilike(term),
                TelemetryEvent.device_id.ilike(term),
                TelemetryEvent.payload.cast(String).ilike(term),
                Device.hostname.ilike(term)
            )
        )

    query = query.order_by(desc(TelemetryEvent.timestamp)).limit(limit)
    res = await db.execute(query)
    rows = res.all()

    timestamp_str = datetime.now().strftime("%Y%m%d_%H%M%S")

    if export_format.lower() == "json":
        data = [
            {
                "id": ev.id,
                "timestamp": ev.timestamp.isoformat() if ev.timestamp else "",
                "event_type": ev.event_type,
                "device_id": ev.device_id,
                "hostname": hostname or ev.device_id,
                "user": ev.username or "system",
                "severity": ev.severity_hint or "INFO",
                "payload": ev.payload
            }
            for ev, hostname in rows
        ]
        content = json.dumps(data, indent=2)
        return StreamingResponse(
            io.StringIO(content),
            media_type="application/json",
            headers={"Content-Disposition": f"attachment; filename=argus_threat_hunt_{timestamp_str}.json"}
        )
    else:
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["id", "timestamp", "device_id", "hostname", "user", "event_type", "severity", "payload"])
        for ev, hostname in rows:
            writer.writerow([
                ev.id,
                ev.timestamp.isoformat() if ev.timestamp else "",
                ev.device_id,
                hostname or ev.device_id,
                ev.username or "system",
                ev.event_type,
                ev.severity_hint or "INFO",
                json.dumps(ev.payload)
            ])
        output.seek(0)
        return StreamingResponse(
            iter([output.getvalue()]),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=argus_threat_hunt_{timestamp_str}.csv"}
        )
