from typing import List, Optional
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc
from app.core.database import get_db
from app.models import Device, TelemetryEvent, AuditLog, DeviceCommand
from app.schemas import DeviceOut, DeviceCommandIn, DeviceCommandOut, DeviceCommandAckIn
from app.services.websocket_manager import ws_manager

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


@router.post("/{device_id}/command", response_model=DeviceCommandOut)
@router.post("/{device_id}/commands", response_model=DeviceCommandOut)
async def dispatch_device_command(
    device_id: str,
    payload: DeviceCommandIn,
    db: AsyncSession = Depends(get_db)
):
    """Dispatches an active threat remediation command to a specific endpoint device."""
    res = await db.execute(select(Device).where(Device.id == device_id))
    device = res.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    cmd = DeviceCommand(
        device_id=device_id,
        command_type=payload.command_type.upper(),
        parameters=payload.parameters,
        status="PENDING",
        issued_by=payload.issued_by or "analyst"
    )
    db.add(cmd)

    # State transition for device if isolating or restoring
    if cmd.command_type == "ISOLATE_NETWORK":
        device.status = "QUARANTINED"
        device.risk_score = max(device.risk_score, 85)
    elif cmd.command_type == "RESTORE_NETWORK":
        device.status = "ONLINE"

    # Audit Trail
    audit_entry = AuditLog(
        actor_username=cmd.issued_by,
        action=f"DISPATCH_REMEDIATION_{cmd.command_type}",
        target_resource="Device",
        target_id=device_id,
        details={
            "command_type": cmd.command_type,
            "parameters": cmd.parameters,
            "hostname": device.hostname
        }
    )
    db.add(audit_entry)
    await db.commit()
    await db.refresh(cmd)

    # Broadcast command over WebSocket so real-time connected agent receives it immediately
    await ws_manager.broadcast_json({
        "type": "DEVICE_COMMAND",
        "command_id": cmd.id,
        "device_id": device_id,
        "command_type": cmd.command_type,
        "parameters": cmd.parameters,
        "timestamp": cmd.created_at.isoformat()
    })

    return cmd


@router.get("/{device_id}/commands", response_model=List[DeviceCommandOut])
async def get_device_commands(
    device_id: str,
    status: Optional[str] = None,
    limit: int = Query(20, le=100),
    db: AsyncSession = Depends(get_db)
):
    """Retrieves command queue and execution history for an endpoint."""
    stmt = select(DeviceCommand).where(DeviceCommand.device_id == device_id).order_by(desc(DeviceCommand.created_at)).limit(limit)
    if status:
        stmt = stmt.where(DeviceCommand.status == status.upper())
    res = await db.execute(stmt)
    return res.scalars().all()


@router.post("/{device_id}/command-ack")
async def acknowledge_device_command(
    device_id: str,
    ack: DeviceCommandAckIn,
    db: AsyncSession = Depends(get_db)
):
    """Agent acknowledges execution of a remediation command."""
    res = await db.execute(
        select(DeviceCommand).where(
            DeviceCommand.id == ack.command_id,
            DeviceCommand.device_id == device_id
        )
    )
    cmd = res.scalar_one_or_none()
    if not cmd:
        raise HTTPException(status_code=404, detail="Command not found")

    cmd.status = ack.status.upper()
    cmd.result_summary = ack.result_summary
    cmd.executed_at = datetime.now(timezone.utc)

    # Audit Trail
    audit_entry = AuditLog(
        actor_username="system_agent",
        action=f"EXECUTE_COMMAND_{cmd.command_type}",
        target_resource="DeviceCommand",
        target_id=cmd.id,
        details={"status": cmd.status, "summary": ack.result_summary, "device_id": device_id}
    )
    db.add(audit_entry)
    await db.commit()

    # Broadcast update
    await ws_manager.broadcast_json({
        "type": "COMMAND_ACK",
        "command_id": cmd.id,
        "device_id": device_id,
        "status": cmd.status,
        "result_summary": cmd.result_summary
    })

    return {"status": "success", "command_id": cmd.id, "execution_status": cmd.status}

