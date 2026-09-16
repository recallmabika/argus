import sys
import uuid
import time
import logging
from typing import List, Dict, Any, Set
from config import config

logger = logging.getLogger("argus.collector.print")


class PrintCollector:
    def __init__(self):
        self.seen_job_ids: Set[str] = set()
        self.is_windows = sys.platform == "win32"

    def check_print_jobs(self) -> List[Dict[str, Any]]:
        """Queries print spooler for newly submitted print jobs."""
        events = []
        if not self.is_windows:
            return events

        try:
            import win32print
            # Enumerate local printers
            printers = win32print.EnumPrinters(win32print.PRINTER_ENUM_LOCAL | win32print.PRINTER_ENUM_CONNECTIONS)
            for flags, description, name, comment in printers:
                try:
                    hprinter = win32print.OpenPrinter(name)
                    try:
                        jobs = win32print.EnumJobs(hprinter, 0, -1, 1)
                        for job in jobs:
                            job_id = f"{name}_{job.get('JobId')}_{job.get('pDocument')}"
                            if job_id not in self.seen_job_ids:
                                self.seen_job_ids.add(job_id)
                                
                                events.append({
                                    "event_id": str(uuid.uuid4()),
                                    "device_id": config.DEVICE_ID,
                                    "hostname": config.HOSTNAME,
                                    "os_type": config.OS_TYPE,
                                    "username": job.get("pUserName") or config.USERNAME,
                                    "branch_id": config.BRANCH_ID,
                                    "branch_name": config.BRANCH_NAME,
                                    "latitude": config.LATITUDE,
                                    "longitude": config.LONGITUDE,
                                    "event_type": "PRINT_JOB",
                                    "severity_hint": "INFO",
                                    "payload": {
                                        "printer_name": name,
                                        "document_name": job.get("pDocument", "Untitled Document"),
                                        "pages": job.get("TotalPages", 1),
                                        "status": job.get("Status", 0),
                                        "size_bytes": job.get("Size", 0)
                                    }
                                })
                    finally:
                        win32print.ClosePrinter(hprinter)
                except Exception:
                    continue
        except ImportError:
            logger.warning("win32print not available on this platform.")
        except Exception as e:
            logger.debug(f"Print job check error: {e}")

        return events
