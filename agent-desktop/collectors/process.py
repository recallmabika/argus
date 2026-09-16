import time
import uuid
import psutil
import logging
from typing import List, Dict, Any, Set
from config import config

logger = logging.getLogger("argus.collector.process")


class ProcessCollector:
    def __init__(self):
        self.seen_pids: Set[int] = set()
        self._prime_pids()

    def _prime_pids(self):
        """Initial baseline of currently running processes so we only emit new ones."""
        for p in psutil.process_iter(['pid']):
            try:
                self.seen_pids.add(p.info['pid'])
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                continue

    def collect_new_processes(self) -> List[Dict[str, Any]]:
        """Collects real process creations since last poll."""
        events = []
        current_pids = set()

        for p in psutil.process_iter(['pid', 'name', 'cmdline', 'ppid', 'create_time', 'username']):
            try:
                pid = p.info['pid']
                current_pids.add(pid)

                if pid not in self.seen_pids:
                    # New process spawned!
                    self.seen_pids.add(pid)
                    
                    cmdline = " ".join(p.info.get('cmdline') or [])
                    parent_name = "unknown"
                    try:
                        parent = p.parent()
                        if parent:
                            parent_name = parent.name()
                    except Exception:
                        pass

                    event = {
                        "event_id": str(uuid.uuid4()),
                        "device_id": config.DEVICE_ID,
                        "hostname": config.HOSTNAME,
                        "os_type": config.OS_TYPE,
                        "username": p.info.get('username') or config.USERNAME,
                        "branch_id": config.BRANCH_ID,
                        "branch_name": config.BRANCH_NAME,
                        "latitude": config.LATITUDE,
                        "longitude": config.LONGITUDE,
                        "event_type": "PROCESS_START",
                        "severity_hint": "INFO",
                        "payload": {
                            "pid": pid,
                            "process_name": p.info.get('name') or "unknown",
                            "command_line": cmdline,
                            "parent_name": parent_name,
                            "parent_pid": p.info.get('ppid'),
                            "create_time": p.info.get('create_time')
                        }
                    }
                    events.append(event)
            except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                continue

        # Clean up terminated PIDs from seen cache
        self.seen_pids.intersection_update(current_pids)
        return events
