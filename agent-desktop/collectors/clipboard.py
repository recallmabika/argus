import time
import uuid
import hashlib
import logging
from typing import Optional, Dict, Any
import pyperclip
from config import config

logger = logging.getLogger("argus.collector.clipboard")


class ClipboardCollector:
    def __init__(self):
        self.last_hash: Optional[str] = None
        # Initialize with current clipboard to avoid logging existing content as new
        try:
            current = pyperclip.paste()
            if current:
                self.last_hash = hashlib.sha256(current.encode("utf-8", errors="ignore")).hexdigest()
        except Exception:
            pass

    def check_clipboard(self) -> Optional[Dict[str, Any]]:
        """Checks if clipboard content has changed. Returns telemetry event if changed."""
        try:
            content = pyperclip.paste()
            if not content:
                return None

            content_hash = hashlib.sha256(content.encode("utf-8", errors="ignore")).hexdigest()
            if content_hash != self.last_hash:
                self.last_hash = content_hash
                
                # Truncate preview if very long
                preview = content[:200]

                return {
                    "event_id": str(uuid.uuid4()),
                    "device_id": config.DEVICE_ID,
                    "hostname": config.HOSTNAME,
                    "os_type": config.OS_TYPE,
                    "username": config.USERNAME,
                    "branch_id": config.BRANCH_ID,
                    "branch_name": config.BRANCH_NAME,
                    "latitude": config.LATITUDE,
                    "longitude": config.LONGITUDE,
                    "event_type": "CLIPBOARD_SYNC",
                    "severity_hint": "INFO",
                    "payload": {
                        "content": preview,
                        "length": len(content),
                        "hash": content_hash,
                        "timestamp": time.time()
                    }
                }
        except Exception as e:
            logger.debug(f"Clipboard check exception: {e}")
        return None
