import socket
import getpass
import platform
from typing import List, Optional, Dict, Any
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, delete
from app.core.database import get_db
from app.models import Device, TelemetryEvent, AuditLog, DeviceCommand, Alert
from app.schemas import DeviceOut, DeviceCreateIn, DeviceCommandIn, DeviceCommandOut, DeviceCommandAckIn
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


@router.get("/local-host/detect")
async def detect_local_host():
    """Returns the real environment parameters of the active workstation."""
    host = socket.gethostname()
    user = getpass.getuser()
    system_os = platform.system().lower()
    try:
        ip = socket.gethostbyname(host)
    except Exception:
        ip = "127.0.0.1"

    return {
        "hostname": host,
        "username": user,
        "os_type": system_os,
        "ip_address": ip,
        "suggested_id": f"ARGUS-{host.upper().replace(' ', '-')}"
    }


@router.post("", response_model=DeviceOut)
async def create_device(
    payload: DeviceCreateIn,
    db: AsyncSession = Depends(get_db)
):
    """Enrolls a new endpoint device into the Argus fleet."""
    clean_host = payload.hostname.strip()
    if not clean_host:
        raise HTTPException(status_code=400, detail="Hostname cannot be empty.")

    dev_id = f"ARGUS-{clean_host.upper().replace(' ', '-')}"
    res = await db.execute(select(Device).where((Device.id == dev_id) | (Device.hostname == clean_host)))
    existing = res.scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"Device with hostname '{clean_host}' is already enrolled.")

    device = Device(
        id=dev_id,
        hostname=clean_host,
        os_type=payload.os_type.lower(),
        ip_address=payload.ip_address or "127.0.0.1",
        branch_id=payload.branch_id or "BRANCH-HQ-01",
        branch_name=payload.branch_name or "Headquarters",
        latitude=payload.latitude or "40.7128",
        longitude=payload.longitude or "-74.0060",
        current_user=payload.current_user or "analyst",
        status=payload.status or "ONLINE",
        risk_score=0,
        last_seen=datetime.now(timezone.utc)
    )
    db.add(device)

    # Compliance audit log
    audit_entry = AuditLog(
        actor_username="analyst",
        action="ENROLL_DEVICE",
        target_resource="Device",
        target_id=device.id,
        details={
            "hostname": device.hostname,
            "branch": device.branch_name,
            "os": device.os_type,
            "ip": device.ip_address
        }
    )
    db.add(audit_entry)
    await db.commit()
    await db.refresh(device)

    # Real-time WebSocket announcement
    await ws_manager.broadcast_json({
        "type": "DEVICE_UPDATE",
        "device_id": device.id,
        "hostname": device.hostname,
        "status": device.status
    })

    return device


@router.delete("/{device_id}")
async def delete_device(
    device_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Unenrolls and removes an endpoint device from fleet monitoring."""
    res = await db.execute(select(Device).where(Device.id == device_id))
    device = res.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    hostname = device.hostname
    # Clean up associated telemetry & commands
    await db.execute(delete(DeviceCommand).where(DeviceCommand.device_id == device_id))
    await db.execute(delete(TelemetryEvent).where(TelemetryEvent.device_id == device_id))
    await db.execute(delete(Alert).where(Alert.device_id == device_id))
    await db.delete(device)

    audit_entry = AuditLog(
        actor_username="analyst",
        action="UNENROLL_DEVICE",
        target_resource="Device",
        target_id=device_id,
        details={"hostname": hostname}
    )
    db.add(audit_entry)
    await db.commit()

    await ws_manager.broadcast_json({
        "type": "DEVICE_UPDATE",
        "device_id": device_id,
        "action": "DELETED"
    })

    return {"status": "success", "message": f"Device {hostname} unenrolled"}


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

