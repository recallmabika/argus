from typing import Optional, List
from pydantic import BaseModel
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.core.database import get_db
from app.models import Device
from app.services.port_scanner import port_scanner

router = APIRouter()


class ScanRequestIn(BaseModel):
    target: Optional[str] = None
    device_id: Optional[str] = None
    ports: Optional[List[int]] = None
    timeout: Optional[float] = 0.6


@router.post("/scan")
async def execute_port_scan(
    payload: ScanRequestIn,
    db: AsyncSession = Depends(get_db)
):
    """
    Executes a high-speed concurrent network port scan on a target IP or enrolled device.
    Detects open ports, services, banners, and security exposure.
    """
    target_host = payload.target

    # If device_id is provided, resolve IP from device database
    if payload.device_id and not target_host:
        res = await db.execute(select(Device).where(Device.id == payload.device_id))
        device = res.scalar_one_or_none()
        if not device:
            raise HTTPException(status_code=404, detail=f"Device '{payload.device_id}' not found")
        target_host = device.ip_address or "127.0.0.1"

    if not target_host or not target_host.strip():
        target_host = "127.0.0.1"

    result = port_scanner.scan_target(
        target=target_host.strip(),
        custom_ports=payload.ports,
        timeout=payload.timeout or 0.6
    )
    return result


@router.get("/history")
async def get_scan_history():
    """Returns the historical record of network port scans."""
    return port_scanner.get_scan_history()


@router.get("/history/{scan_id}")
async def get_scan_detail(scan_id: str):
    """Retrieves deep telemetry for a specific network port scan."""
    scan = port_scanner.get_scan_by_id(scan_id)
    if not scan:
        raise HTTPException(status_code=404, detail="Scan record not found")
    return scan


@router.post("/scan-device/{device_id}")
async def scan_enrolled_device(
    device_id: str,
    db: AsyncSession = Depends(get_db)
):
    """Shortcut endpoint to audit an enrolled SOC endpoint for open ports."""
    res = await db.execute(select(Device).where(Device.id == device_id))
    device = res.scalar_one_or_none()
    if not device:
        raise HTTPException(status_code=404, detail="Enrolled endpoint not found")

    target_ip = device.ip_address or "127.0.0.1"
    scan = port_scanner.scan_target(target=target_ip)
    scan["device_id"] = device.id
    scan["hostname"] = device.hostname
    return scan
