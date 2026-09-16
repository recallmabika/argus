import time
import threading
import logging
import sys
import requests
from typing import List, Dict, Any

from config import config
from queue.local_buffer import local_queue
from collectors.process import ProcessCollector
from collectors.clipboard import ClipboardCollector
from collectors.browser import BrowserHistoryCollector
from collectors.print_monitor import PrintCollector
from collectors.camera import CameraSnapshotCollector

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] [%(name)s] %(message)s",
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("argus.agent")


class ArgusAgent:
    def __init__(self):
        self.running = False
        self.process_collector = ProcessCollector()
        self.clipboard_collector = ClipboardCollector()
        self.browser_collector = BrowserHistoryCollector()
        self.print_collector = PrintCollector()
        self.camera_collector = CameraSnapshotCollector()

    def _collect_processes_loop(self):
        while self.running:
            try:
                events = self.process_collector.collect_new_processes()
                for ev in events:
                    local_queue.push_event(ev)
            except Exception as e:
                logger.error(f"Process collector loop error: {e}")
            time.sleep(config.PROCESS_POLL_INTERVAL)

    def _collect_clipboard_loop(self):
        while self.running:
            try:
                ev = self.clipboard_collector.check_clipboard()
                if ev:
                    local_queue.push_event(ev)
            except Exception as e:
                logger.error(f"Clipboard collector loop error: {e}")
            time.sleep(config.CLIPBOARD_POLL_INTERVAL)

    def _collect_browser_loop(self):
        while self.running:
            try:
                events = self.browser_collector.collect_recent_visits()
                for ev in events:
                    local_queue.push_event(ev)
            except Exception as e:
                logger.error(f"Browser collector loop error: {e}")
            time.sleep(config.BROWSER_POLL_INTERVAL)

    def _collect_print_loop(self):
        while self.running:
            try:
                events = self.print_collector.check_print_jobs()
                for ev in events:
                    local_queue.push_event(ev)
            except Exception as e:
                logger.error(f"Print collector loop error: {e}")
            time.sleep(config.PRINT_POLL_INTERVAL)

    def _dispatch_loop(self):
        """Dispatches batched telemetry from local queue to the central ingestion API."""
        while self.running:
            try:
                batch = local_queue.peek_batch(limit=config.BATCH_SIZE)
                if batch:
                    # Clean out internal _row_id before payload submission
                    row_ids = [item.pop("_row_id") for item in batch if "_row_id" in item]
                    payload = {"events": batch}

                    response = requests.post(
                        config.INGEST_ENDPOINT,
                        json=payload,
                        timeout=5
                    )

                    if response.status_code == 200:
                        local_queue.remove_events(row_ids)
                        data = response.json()
                        logger.info(f"Dispatched {len(batch)} telemetry events. Server alerts: {data.get('triggered_alerts', 0)}")

                        # Check for server-side commands
                        for cmd in data.get("commands", []):
                            if cmd.get("action") == "CAPTURE_CAMERA_SNAPSHOT":
                                logger.warning(f"Server requested anomaly camera snapshot: {cmd.get('reason')}")
                                self.camera_collector.capture_anomaly_snapshot(reason=cmd.get("reason", "Server Directive"))
                    else:
                        logger.warning(f"Ingestion API returned status {response.status_code}: {response.text}")
            except requests.exceptions.RequestException as e:
                logger.debug(f"Server unreachable (events queued locally): {e}")
            except Exception as e:
                logger.error(f"Dispatch loop error: {e}")

            time.sleep(config.DISPATCH_INTERVAL)

    def start(self):
        """Starts all telemetry collectors and the dispatch worker."""
        logger.info(f"Starting Argus Endpoint Agent v{config.AGENT_VERSION}...")
        logger.info(f"Device ID: {config.DEVICE_ID} | Hostname: {config.HOSTNAME} | Branch: {config.BRANCH_NAME}")
        self.running = True

        threads = [
            threading.Thread(target=self._collect_processes_loop, name="ProcCollector", daemon=True),
            threading.Thread(target=self._collect_clipboard_loop, name="ClipCollector", daemon=True),
            threading.Thread(target=self._collect_browser_loop, name="BrowserCollector", daemon=True),
            threading.Thread(target=self._collect_print_loop, name="PrintCollector", daemon=True),
            threading.Thread(target=self._dispatch_loop, name="Dispatcher", daemon=True)
        ]

        for t in threads:
            t.start()

        logger.info("All telemetry threads running. Monitoring active.")
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            logger.info("Stopping Argus agent...")
            self.running = False


if __name__ == "__main__":
    agent = ArgusAgent()
    agent.start()
