from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.models import Device, TelemetryEvent, AuditLog
from app.schemas import DeviceOut

router = APIRouter()


@router.get("", response_model=List[DeviceOut])
async def list_devices(
    branch_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db)
):
    """Lists all enrolled endpoint devices."""
    stmt = select(Device).order_by(desc(Device.risk_score), desc(Device.last_seen))
    if branch_id:
        stmt = stmt.where(Device.branch_id == branch_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{device_id}")
async def get_device_details(
    device_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Retrieves detailed device information and recent activity."""
    result = await db.execute(select(Device).where(Device.id == device_id))
    device = result.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    # Fetch last 30 events
    ev_stmt = (
        select(TelemetryEvent)
        .where(TelemetryEvent.device_id == device_id)
        .order_by(desc(TelemetryEvent.timestamp))
        .limit(30)
    )
    events_res = await db.execute(ev_stmt)
    events = events_res.scalars().all()

    # Log audit entry: Analyst inspected device monitoring
    audit_entry = AuditLog(
        actor_username="analyst",
        action="VIEW_DEVICE_MONITORING",
        target_resource="Device",
        target_id=device_id,
        details={"hostname": device.hostname, "branch": device.branch_name}
    )
    db.add(audit_entry)
    await db.commit()

    return {
        "device": device,
        "recent_events": [
            {
                "id": ev.id,
                "event_type": ev.event_type,
                "timestamp": ev.timestamp.isoformat(),
                "severity_hint": ev.severity_hint,
                "payload": ev.payload
            }
            for ev in events
        ]
    }
