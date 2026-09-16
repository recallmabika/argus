import os
import shutil
import sqlite3
import uuid
import logging
from typing import List, Dict, Any
from pathlib import Path
from config import config

logger = logging.getLogger("argus.collector.browser")


class BrowserHistoryCollector:
    def __init__(self):
        self.shadow_dir = Path(os.getenv("TEMP", "/tmp")) / "argus_browser_shadow"
        self.shadow_dir.mkdir(parents=True, exist_ok=True)
        self.last_visit_time_micro = self._get_initial_timestamp()

    def _get_initial_timestamp(self) -> int:
        # Chrome/Edge timestamps are microseconds since Jan 1, 1601 UTC
        # Current time in Chrome timestamp epoch format
        import datetime
        epoch_start = datetime.datetime(1601, 1, 1)
        now = datetime.datetime.utcnow()
        return int((now - epoch_start).total_seconds() * 1000000)

    def _find_browser_history_files(self) -> List[tuple]:
        """Finds Chrome, Edge, and Brave history databases."""
        local_app_data = os.getenv("LOCALAPPDATA", "")
        if not local_app_data:
            return []

        candidates = [
            ("Chrome", Path(local_app_data) / "Google" / "Chrome" / "User Data" / "Default" / "History"),
            ("Edge", Path(local_app_data) / "Microsoft" / "Edge" / "User Data" / "Default" / "History"),
            ("Brave", Path(local_app_data) / "BraveSoftware" / "Brave-Browser" / "User Data" / "Default" / "History")
        ]
        found = []
        for name, path in candidates:
            if path.exists():
                found.append((name, path))
        return found

    def collect_recent_visits(self) -> List[Dict[str, Any]]:
        """Copies SQLite history to shadow folder and queries recent URLs visited."""
        events = []
        history_sources = self._find_browser_history_files()

        for browser_name, db_path in history_sources:
            shadow_db = self.shadow_dir / f"{browser_name}_history_shadow.db"
            try:
                # Hot shadow copy to bypass browser database lock
                shutil.copy2(db_path, shadow_db)
                
                # Also copy WAL file if present
                wal_path = Path(str(db_path) + "-wal")
                if wal_path.exists():
                    shutil.copy2(wal_path, self.shadow_dir / f"{browser_name}_history_shadow.db-wal")

                with sqlite3.connect(f"file:{shadow_db}?mode=ro", uri=True) as conn:
                    cursor = conn.execute(
                        """
                        SELECT url, title, visit_count, last_visit_time 
                        FROM urls 
                        WHERE last_visit_time > ? 
                        ORDER BY last_visit_time ASC
                        LIMIT 20
                        """,
                        (self.last_visit_time_micro,)
                    )
                    rows = cursor.fetchall()
                    for url, title, count, last_time in rows:
                        if last_time > self.last_visit_time_micro:
                            self.last_visit_time_micro = last_time

                        # Skip empty internal URLs
                        if not url or url.startswith("chrome-extension://") or url.startswith("edge://"):
                            continue

                        events.append({
                            "event_id": str(uuid.uuid4()),
                            "device_id": config.DEVICE_ID,
                            "hostname": config.HOSTNAME,
                            "os_type": config.OS_TYPE,
                            "username": config.USERNAME,
                            "branch_id": config.BRANCH_ID,
                            "branch_name": config.BRANCH_NAME,
                            "latitude": config.LATITUDE,
                            "longitude": config.LONGITUDE,
                            "event_type": "BROWSER_VISIT",
                            "severity_hint": "INFO",
                            "payload": {
                                "browser": browser_name,
                                "url": url,
                                "title": title or url,
                                "visit_count": count
                            }
                        })
            except Exception as e:
                logger.debug(f"Could not read history for {browser_name}: {e}")

        return events
