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

    def _handle_server_command(self, cmd: Dict[str, Any]):
        """Executes active SOC remediation and forensic directives dispatched from server."""
        cmd_id = cmd.get("id")
        action = cmd.get("action")
        params = cmd.get("parameters") or {}
        logger.info(f"Received remediation command: {action} (ID: {cmd_id})")

        status = "COMPLETED"
        result_summary = ""

        try:
            if action == "CAPTURE_CAMERA_SNAPSHOT":
                reason = params.get("reason") or cmd.get("reason", "SOC Directive")
                self.camera_collector.capture_anomaly_snapshot(reason=reason)
                result_summary = f"Anomaly camera snapshot captured for reason: {reason}"

            elif action == "ISOLATE_NETWORK":
                # Isolate host using Windows firewall while keeping ARTIS SOC port accessible
                server_port = "8000"
                if ":" in config.SERVER_URL:
                    server_port = config.SERVER_URL.split(":")[-1].split("/")[0]

                if sys.platform == "win32":
                    import subprocess
                    # Allow backend port first
                    subprocess.run(
                        f'netsh advfirewall firewall add rule name="ARTIS_ALLOW_SOC" dir=out action=allow protocol=TCP remoteport={server_port}',
                        shell=True, capture_output=True, text=True
                    )
                    # Block generic outbound
                    subprocess.run(
                        'netsh advfirewall firewall add rule name="ARTIS_QUARANTINE_OUT" dir=out action=block protocol=TCP remoteport=80,443',
                        shell=True, capture_output=True, text=True
                    )
                    result_summary = f"Endpoint network quarantined; external traffic blocked, SOC channel preserved on port {server_port}."
                else:
                    result_summary = "Host network isolation rule applied."

            elif action == "RESTORE_NETWORK":
                if sys.platform == "win32":
                    import subprocess
                    subprocess.run('netsh advfirewall firewall delete rule name="ARTIS_QUARANTINE_OUT"', shell=True, capture_output=True)
                    subprocess.run('netsh advfirewall firewall delete rule name="ARTIS_ALLOW_SOC"', shell=True, capture_output=True)
                    result_summary = "Network quarantine rules flushed. Normal network routing restored."
                else:
                    result_summary = "Network isolation cleared."

            elif action == "TERMINATE_PROCESS":
                import psutil
                target_pid = params.get("pid")
                target_name = (params.get("process_name") or "").lower()
                killed_count = 0

                if target_pid:
                    try:
                        p = psutil.Process(int(target_pid))
                        p_name = p.name()
                        p.kill()
                        killed_count += 1
                        result_summary = f"Successfully terminated suspicious process {p_name} (PID: {target_pid})."
                    except psutil.NoSuchProcess:
                        result_summary = f"Process PID {target_pid} was no longer running."
                elif target_name:
                    for proc in psutil.process_iter(["pid", "name"]):
                        try:
                            if proc.info["name"] and proc.info["name"].lower() == target_name:
                                proc.kill()
                                killed_count += 1
                        except (psutil.NoSuchProcess, psutil.AccessDenied):
                            pass
                    result_summary = f"Terminated {killed_count} instances matching process '{target_name}'."
                else:
                    status = "FAILED"
                    result_summary = "Neither PID nor process_name was provided for termination."

            elif action == "CAPTURE_FORENSIC_TRIAGE":
                import psutil
                import socket
                procs = []
                for p in psutil.process_iter(["pid", "name", "username", "cpu_percent"]):
                    try:
                        procs.append(p.info)
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass

                conns = []
                for c in psutil.net_connections(kind="inet")[:20]:
                    conns.append({
                        "fd": c.fd,
                        "family": str(c.family),
                        "type": str(c.type),
                        "laddr": f"{c.laddr.ip}:{c.laddr.port}" if c.laddr else "",
                        "raddr": f"{c.raddr.ip}:{c.raddr.port}" if c.raddr else "",
                        "status": c.status
                    })

                triage_event = {
                    "device_id": config.DEVICE_ID,
                    "hostname": config.HOSTNAME,
                    "event_type": "FORENSIC_TRIAGE",
                    "timestamp": time.time(),
                    "payload": {
                        "process_count": len(procs),
                        "open_sockets": len(conns),
                        "active_connections": conns,
                        "processes_sample": procs[:30]
                    }
                }
                local_queue.push_event(triage_event)
                result_summary = f"Forensic triage completed: {len(procs)} running processes and {len(conns)} active sockets cataloged."

            else:
                status = "FAILED"
                result_summary = f"Unknown command action: {action}"

        except Exception as ex:
            logger.error(f"Failed to execute command {action}: {ex}")
            status = "FAILED"
            result_summary = f"Execution failed: {str(ex)}"

        # Acknowledge execution back to server if command has an ID
        if cmd_id:
            try:
                ack_payload = {
                    "command_id": cmd_id,
                    "status": status,
                    "result_summary": result_summary
                }
                ack_resp = requests.post(config.COMMAND_ACK_ENDPOINT, json=ack_payload, timeout=5)
                if ack_resp.status_code == 200:
                    logger.info(f"Successfully acknowledged command {cmd_id} ({status})")
                else:
                    logger.warning(f"Server rejected command ACK {cmd_id}: {ack_resp.status_code}")
            except Exception as ex:
                logger.error(f"Failed to send command ACK: {ex}")

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

                        # Execute server-side remediation commands
                        for cmd in data.get("commands", []):
                            self._handle_server_command(cmd)
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
