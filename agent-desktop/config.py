import os
import sys
import uuid
import socket
import getpass
from pathlib import Path


class AgentConfig:
    def __init__(self):
        self.AGENT_VERSION = "1.0.0"
        self.SERVER_URL = os.getenv("ARGUS_SERVER_URL", "http://127.0.0.1:8000")
        self.INGEST_ENDPOINT = f"{self.SERVER_URL}/api/v1/telemetry/batch"
        self.SNAPSHOT_ENDPOINT = f"{self.SERVER_URL}/api/v1/telemetry/snapshot"
        self.COMMAND_ACK_ENDPOINT = f"{self.SERVER_URL}/api/v1/devices/{self.DEVICE_ID}/command-ack"

        # Unique hardware device ID (persisted locally)
        self.CONFIG_DIR = Path(os.getenv("APPDATA", str(Path.home()))) / "ArgusAgent"
        self.CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        self.DEVICE_ID_FILE = self.CONFIG_DIR / "device_id.txt"
        self.DEVICE_ID = self._get_or_create_device_id()

        # Host metadata
        self.HOSTNAME = socket.gethostname()
        self.USERNAME = getpass.getuser()
        self.OS_TYPE = sys.platform
        self.BRANCH_ID = os.getenv("ARGUS_BRANCH_ID", "BRANCH-HQ-01")
        self.BRANCH_NAME = os.getenv("ARGUS_BRANCH_NAME", "Headquarters - Tech Center")
        self.LATITUDE = os.getenv("ARGUS_LATITUDE", "40.7128")
        self.LONGITUDE = os.getenv("ARGUS_LONGITUDE", "-74.0060")

        # Polling & Dispatch intervals (seconds)
        self.PROCESS_POLL_INTERVAL = 3.0
        self.CLIPBOARD_POLL_INTERVAL = 1.0
        self.BROWSER_POLL_INTERVAL = 5.0
        self.PRINT_POLL_INTERVAL = 4.0
        self.DISPATCH_INTERVAL = 2.0
        self.BATCH_SIZE = 25

    def _get_or_create_device_id(self) -> str:
        if self.DEVICE_ID_FILE.exists():
            with open(self.DEVICE_ID_FILE, "r") as f:
                dev_id = f.read().strip()
                if dev_id:
                    return dev_id
        new_id = f"ARGUS-{uuid.uuid4().hex[:12].upper()}"
        with open(self.DEVICE_ID_FILE, "w") as f:
            f.write(new_id)
        return new_id


config = AgentConfig()
