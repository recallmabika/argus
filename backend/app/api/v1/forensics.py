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
    ip: str = Field(..., description="IP address of target device (e.g. 192.168.1.50)")
    port: int = Field(default=5555, description="Port for ADB over TCP/IP or remote agent")


class InputControlRequest(BaseModel):
    type: str = Field(default="tap", description="Action type: tap, swipe, key, text")
    x: Optional[float] = Field(default=0.5, description="Relative horizontal coordinate (0.0 to 1.0)")
    y: Optional[float] = Field(default=0.5, description="Relative vertical coordinate (0.0 to 1.0)")
    x1: Optional[float] = Field(default=0.5)
    y1: Optional[float] = Field(default=0.5)
    x2: Optional[float] = Field(default=0.5)
    y2: Optional[float] = Field(default=0.5)
    duration: Optional[int] = Field(default=300, description="Swipe duration in ms")
    key: Optional[str] = Field(default="BACK", description="Hardware key name (BACK, HOME, RECENTS, POWER, etc.)")
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


@router.post("/connect-wireless", summary="Connect to a device wirelessly via Wi-Fi IP")
async def connect_wireless_device(req: WirelessConnectRequest):
    """Pairs with a wireless target (e.g. Android phone over Wi-Fi on port 5555)."""
    result = forensics_manager.connect_wireless(req.ip, req.port)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("message"))
    return result


@router.post("/devices/{device_id}/disconnect", summary="Disconnect a wireless device")
async def disconnect_forensic_device(device_id: str):
    """Disconnects a target device session."""
    return forensics_manager.disconnect_device(device_id)


@router.get("/devices/{device_id}/screen", summary="Capture single live visual screen frame")
async def get_screen_frame(device_id: str):
    """Returns a real JPEG frame of the target device's active display."""
    frame_bytes = forensics_manager.get_screen_frame(device_id)
    if not frame_bytes:
        raise HTTPException(status_code=404, detail="Screen capture unavailable for this device.")
    
    res = forensics_manager.get_device_resolution(device_id)
    headers = {
        "X-Device-Width": str(res["width"]),
        "X-Device-Height": str(res["height"]),
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Pragma": "no-cache"
    }
    return Response(content=frame_bytes, media_type="image/jpeg", headers=headers)


@router.post("/devices/{device_id}/input", summary="Send visual remote control input (tap/swipe/keys)")
async def send_device_input(device_id: str, req: InputControlRequest):
    """
    Sends touch taps, swipes, hardware keys (Back, Home, Recents, Power),
    or text characters to physically navigate the device from the PC.
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
