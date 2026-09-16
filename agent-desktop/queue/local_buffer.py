import sqlite3
import json
import logging
from typing import List, Dict, Any
from pathlib import Path
from config import config

logger = logging.getLogger("argus.buffer")


class LocalBufferQueue:
    def __init__(self):
        self.db_path = config.CONFIG_DIR / "agent_buffer.db"
        self._init_db()

    def _init_db(self):
        with sqlite3.connect(self.db_path) as conn:
            conn.execute("""
                CREATE TABLE IF NOT EXISTS event_spool (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    event_id TEXT UNIQUE,
                    event_data TEXT NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()

    def push_event(self, event: Dict[str, Any]):
        """Pushes an event into the local offline buffer."""
        try:
            with sqlite3.connect(self.db_path) as conn:
                conn.execute(
                    "INSERT OR IGNORE INTO event_spool (event_id, event_data) VALUES (?, ?)",
                    (event.get("event_id"), json.dumps(event))
                )
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to buffer event locally: {e}")

    def peek_batch(self, limit: int = 50) -> List[Dict[str, Any]]:
        """Retrieves a batch of buffered events."""
        events = []
        try:
            with sqlite3.connect(self.db_path) as conn:
                cursor = conn.execute(
                    "SELECT id, event_data FROM event_spool ORDER BY id ASC LIMIT ?",
                    (limit,)
                )
                for row_id, data_str in cursor.fetchall():
                    ev = json.loads(data_str)
                    ev["_row_id"] = row_id
                    events.append(ev)
        except Exception as e:
            logger.error(f"Failed to read buffered events: {e}")
        return events

    def remove_events(self, row_ids: List[int]):
        """Deletes acknowledged events from the local buffer."""
        if not row_ids:
            return
        try:
            with sqlite3.connect(self.db_path) as conn:
                placeholders = ",".join("?" for _ in row_ids)
                conn.execute(f"DELETE FROM event_spool WHERE id IN ({placeholders})", row_ids)
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to clear acknowledged events: {e}")


local_queue = LocalBufferQueue()
