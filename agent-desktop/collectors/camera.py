import os
import time
import logging
from pathlib import Path
from typing import Optional
import requests
from config import config

logger = logging.getLogger("argus.collector.camera")


class CameraSnapshotCollector:
    def __init__(self):
        self.temp_dir = config.CONFIG_DIR / "snapshots"
        self.temp_dir.mkdir(parents=True, exist_ok=True)

    def capture_anomaly_snapshot(self, reason: str = "Anomaly Triggered") -> Optional[str]:
        """
        Captures a single timestamped frame from the device webcam upon security anomaly.
        Uploads snapshot to backend server.
        """
        try:
            import cv2
            cap = cv2.VideoCapture(0)
            if not cap.isOpened():
                logger.warning("No accessible webcam device found on this system.")
                return None

            # Read frame
            ret, frame = cap.read()
            cap.release()

            if not ret or frame is None:
                logger.warning("Webcam capture returned empty frame.")
                return None

            timestamp = int(time.time())
            filename = f"snapshot_{config.DEVICE_ID}_{timestamp}.jpg"
            filepath = self.temp_dir / filename
            cv2.imwrite(str(filepath), frame)

            # Upload to backend
            with open(filepath, "rb") as f:
                response = requests.post(
                    config.SNAPSHOT_ENDPOINT,
                    data={"device_id": config.DEVICE_ID, "reason": reason},
                    files={"file": (filename, f, "image/jpeg")},
                    timeout=5
                )
                if response.status_code == 200:
                    logger.info(f"Anomaly webcam snapshot uploaded successfully: {filename}")
                    return str(filepath)
                else:
                    logger.error(f"Failed to upload webcam snapshot: {response.text}")
        except Exception as e:
            logger.error(f"Exception during webcam snapshot capture: {e}")
        return None
