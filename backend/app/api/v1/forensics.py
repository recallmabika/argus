"""
ARTIS Forensic Device Bridge & Visual Remote Control API Router
--------------------------------------------------------------
Endpoints for real physical device discovery (USB cable & wireless),
real-time visual screen streaming, remote touch/key navigation,
file system exploration, evidence acquisition, and triage shell execution.
"""

from fastapi import APIRouter, HTTPException, Query, WebSocket, WebSocketDisconnect, Response
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, List
import io
import asyncio
import json

from app.services.forensics_manager import forensics_manager

router = APIRouter()


class WirelessConnectRequest(BaseModel):
    target: Optional[str] = Field(default=None, description="Target IP address or MAC address (e.g. 192.168.1.50 or D4-0D-AB-1D-DB-08)")
    ip: Optional[str] = Field(default=None, description="IP address of target device")
    mac: Optional[str] = Field(default=None, description="MAC address of target device")
    port: Optional[int] = Field(default=5555, description="Port for ADB over TCP/IP or remote agent")
    alias: Optional[str] = Field(default=None, description="Optional friendly name for the endpoint")


class InputControlRequest(BaseModel):
    action: Optional[str] = Field(default=None, description="Action name: click, right_click, double_click, mouse_move, wheel, drag, tap, swipe, key, text")
    type: Optional[str] = Field(default="click", description="Fallback action type")
    window_id: Optional[str] = Field(default=None, description="Specific HWND window identifier if targeting window")
    x: Optional[float] = Field(default=0.5, description="Relative horizontal coordinate (0.0 to 1.0) or pixel")
    y: Optional[float] = Field(default=0.5, description="Relative vertical coordinate (0.0 to 1.0) or pixel")
    x1: Optional[float] = Field(default=0.5)
    y1: Optional[float] = Field(default=0.5)
    x2: Optional[float] = Field(default=0.5)
    y2: Optional[float] = Field(default=0.5)
    duration: Optional[int] = Field(default=300, description="Swipe duration in ms")
    delta: Optional[int] = Field(default=-120, description="Mouse wheel scroll delta")
    deltaY: Optional[int] = Field(default=-120, description="Mouse wheel scroll delta Y")
    button: Optional[str] = Field(default="left", description="Mouse button: left, right, middle")
    key: Optional[str] = Field(default="ENTER", description="Hardware key name (ENTER, ESC, TAB, WIN, BACK, HOME, RECENTS, POWER, etc.)")
    text: Optional[str] = Field(default="", description="Text string to type")


class ShellCommandRequest(BaseModel):
    command: str = Field(..., description="Forensic shell command to execute on target device")


@router.get("/devices", summary="List all physical devices attached via cable or wireless")
async def list_forensic_devices():
    """Returns all genuine hardware targets currently detected by ARTIS."""
    devices = forensics_manager.list_devices()
    return {
        "count": len(devices),
        "devices": devices
    }


@router.get("/network-targets", summary="Discover active LAN and Wi-Fi devices via host ARP table")
async def list_network_targets():
    """Returns real physical endpoints discovered on the local network/Wi-Fi via host ARP table inspection."""
    targets = forensics_manager.get_arp_table()
    return {
        "count": len(targets),
        "targets": targets
    }


@router.get("/devices/{device_id}/windows", summary="List genuine open application windows for targeting")
async def list_device_windows(device_id: str):
    """Returns all active application windows open on the workstation."""
    windows = forensics_manager.list_windows(device_id)
    return {
        "device_id": device_id,
        "count": len(windows),
        "windows": windows
    }


@router.post("/connect-wireless", summary="Connect to a device wirelessly via Wi-Fi IP or MAC address")
async def connect_wireless_device(req: WirelessConnectRequest):
    """
    Pairs with a wireless target (e.g. Android phone or endpoint over Wi-Fi).
    Accepts IP address OR MAC address.
    Zero-ADB requirement: works whether ADB is enabled or disabled.
    """
    target_val = req.target or req.ip or req.mac
    if not target_val:
        raise HTTPException(status_code=400, detail="Must provide target IP address or MAC address.")

    result = forensics_manager.connect_wireless(target_val, req.port or 5555, alias=req.alias)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@router.post("/devices/{device_id}/disconnect", summary="Disconnect a wireless device")
async def disconnect_forensic_device(device_id: str):
    """Disconnects a target device session."""
    return forensics_manager.disconnect_device(device_id)


@router.get("/devices/{device_id}/screen", summary="Capture single live visual screen frame")
async def get_screen_frame(
    device_id: str,
    window_id: Optional[str] = Query(default=None, description="Optional HWND or 'active' for window targeting"),
    quality: int = Query(default=92, description="JPEG quality (85-95)")
):
    """Returns a real, high-definition JPEG frame of the target device's display or chosen application window."""
    frame_bytes = forensics_manager.get_screen_frame(device_id, window_id=window_id, quality=quality)
    if not frame_bytes:
        raise HTTPException(status_code=404, detail="Screen capture unavailable for this device.")
    
    res = forensics_manager.get_device_resolution(device_id, window_id=window_id)
    headers = {
        "X-Device-Width": str(res["width"]),
        "X-Device-Height": str(res["height"]),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
    }
    return Response(content=frame_bytes, media_type="image/jpeg", headers=headers)


@router.post("/devices/{device_id}/input", summary="Send visual remote control input (mouse/touch/keys)")
async def send_device_input(device_id: str, req: InputControlRequest):
    """
    Sends mouse clicks, right clicks, wheel scrolls, touch taps, swipes,
    hardware keys, or text characters to physically navigate the device or PC window.
    """
    action_dict = req.model_dump()
    result = forensics_manager.send_input_action(device_id, action_dict)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@router.get("/devices/{device_id}/files", summary="Browse device file system")
async def list_device_files(device_id: str, path: str = Query(default="", description="Directory path")):
    """Lists files and folders on the device storage."""
    files = forensics_manager.list_files(device_id, path)
    return {
        "device_id": device_id,
        "current_path": path or ("/" if device_id != "HOST-LOCAL-BRIDGE" else "C:\\"),
        "files": files
    }


@router.get("/devices/{device_id}/files/download", summary="Acquire & hash evidence file with chain of custody")
async def download_device_file(device_id: str, path: str = Query(..., description="File path on device")):
    """
    Downloads an artifact file from the device and computes SHA-256 + MD5 cryptographic
    hashes to preserve forensic chain of custody.
    """
    evidence = forensics_manager.download_evidence_file(device_id, path)
    if not evidence or not evidence.get("content"):
        raise HTTPException(status_code=404, detail="File could not be extracted from device.")

    headers = {
        "X-Forensic-SHA256": evidence["sha256"],
        "X-Forensic-MD5": evidence["md5"],
        "X-Source-Device": evidence["source_device"],
        "X-Acquired-At": evidence["acquired_at"],
        "Content-Disposition": f'attachment; filename="{evidence["filename"]}"'
    }

    return StreamingResponse(
        io.BytesIO(evidence["content"]),
        media_type="application/octet-stream",
        headers=headers
    )


@router.get("/devices/{device_id}/triage", summary="Extract device forensic triage profile")
async def get_device_triage(device_id: str):
    """Extracts running processes, installed applications, and network connections."""
    triage = forensics_manager.get_device_triage(device_id)
    return triage


@router.post("/devices/{device_id}/shell", summary="Execute forensic triage command on target")
async def execute_shell_command(device_id: str, req: ShellCommandRequest):
    """Executes a forensic shell command directly on the device."""
    res = forensics_manager.execute_shell_command(device_id, req.command)
    return res


@router.websocket("/devices/{device_id}/ws-screen")
async def websocket_screen_stream(websocket: WebSocket, device_id: str):
    """
    High-speed bidirectional visual streaming & control loop:
    - Streams JPEG screen frames at ~10-15 fps.
    - Receives touch, swipe, and keypress JSON messages from the web canvas.
    """
    await websocket.accept()
    running = True

    async def receive_input_loop():
        try:
            while running:
                data_text = await websocket.receive_text()
                try:
                    msg = json.loads(data_text)
                    forensics_manager.send_input_action(device_id, msg)
                except Exception as e:
                    print(f"[Forensic WS Input Error] {e}")
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    async def stream_frames_loop():
        try:
            while running:
                frame_bytes = forensics_manager.get_screen_frame(device_id)
                if frame_bytes:
                    await websocket.send_bytes(frame_bytes)
                await asyncio.sleep(0.12)  # ~8-10 fps stream
        except WebSocketDisconnect:
            pass
        except Exception:
            pass

    receiver_task = asyncio.create_task(receive_input_loop())
    streamer_task = asyncio.create_task(stream_frames_loop())

    try:
        await asyncio.gather(receiver_task, streamer_task)
    except Exception:
        pass
    finally:
        running = False
        receiver_task.cancel()
        streamer_task.cancel()
