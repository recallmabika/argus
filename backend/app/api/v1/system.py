from fastapi import APIRouter
from typing import Optional
from app.services.system_monitor import SystemMonitor

router = APIRouter()
monitor = SystemMonitor()

@router.get("/health")
async def get_system_health():
    """Returns real-time system metrics (CPU, RAM, disk, network, top processes)"""
    return monitor.get_system_health()

@router.get("/connections")
async def get_network_connections(status: Optional[str] = None, protocol: Optional[str] = None):
    """Returns all active network connections with process resolution"""
    conns = monitor.get_network_connections(status, protocol)
    return {"total": len(conns), "connections": conns}

@router.get("/usb-history")
async def get_usb_history():
    """Returns historical USB device connections from Windows Registry"""
    devices = monitor.get_usb_history()
    return {"count": len(devices), "devices": devices}
