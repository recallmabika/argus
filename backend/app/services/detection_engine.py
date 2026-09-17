import re
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, update
from app.models import TelemetryEvent, Device, Alert
from app.services.websocket_manager import ws_manager

# Regex patterns for sensitive data in clipboard or documents
SENSITIVE_PATTERNS = [
    (r"-----BEGIN (?:RSA|OPENSSH|EC|DSA)? ?PRIVATE KEY-----", "Private Cryptographic Key in Clipboard"),
    (r"(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9_]{36}", "GitHub Personal Access Token"),
    (r"AKIA[0-9A-Z]{16}", "AWS Access Key ID"),
    (r"(?:api[_-]?key|secret|token)\s*[:=]\s*['\"][A-Za-z0-9\-_]{16,}['\"]", "API Secret / Access Token"),
    (r"\b(?:\d{4}[ -]?){3}\d{4}\b", "Potential Payment Card Number"),
]

# Suspicious LOLBin and process signatures
SUSPICIOUS_COMMANDS = [
    (r"powershell.*-(?:enc|encodedcommand)\b", "T1059.001", "Execution", "PowerShell Encoded Command Execution", "CRITICAL"),
    (r"powershell.*(?:bypass|-nop|-w hidden|downloadstring|iex\b)", "T1059.001", "Execution", "PowerShell Hidden / Download Cradle", "HIGH"),
    (r"certutil.*-(?:urlcache|decode|f)\b", "T1105", "Ingress Tool Transfer", "Certutil Remote Ingress / Decode Utility", "HIGH"),
    (r"vssadmin.*delete\s+shadows", "T1490", "Inhibit System Recovery", "VSSAdmin Shadow Copy Deletion", "CRITICAL"),
    (r"whoami\s+/priv", "T1033", "Discovery", "System Privileges Enumeration", "LOW"),
    (r"nltest.*/dclist", "T1018", "Discovery", "Remote Domain Controller Enumeration", "MEDIUM"),
]

# Suspicious web indicators
SUSPICIOUS_DOMAINS = [
    (r"(?:eicar|malware-traffic-analysis|pastebin\.com/raw|ngrok-free\.app|webhook\.site)", "T1071.001", "Command and Control", "Suspicious / C2 Web Channel Navigation", "HIGH"),
    (r"(?:login|verify|account|secure).*(?:support-portal|recovery-auth|update-session)", "T1566.002", "Initial Access", "Potential Credential Harvesting Phishing Domain", "HIGH"),
]


class DetectionEngine:
    async def evaluate_event(self, db: AsyncSession, event: TelemetryEvent, device: Device) -> Optional[Alert]:
        """
        Evaluates a single telemetry event against MITRE ATT&CK rules.
        Returns an Alert if a threat rule triggers.
        """
        payload = event.payload or {}
        event_type = event.event_type
        alert_candidate: Optional[Dict[str, Any]] = None

        # 1. PROCESS_START Evaluation
        if event_type == "PROCESS_START":
            cmdline = str(payload.get("command_line", "")).lower()
            proc_name = str(payload.get("process_name", "")).lower()
            combined = f"{proc_name} {cmdline}"

            for pattern, tech_id, tactic, tech_name, severity in SUSPICIOUS_COMMANDS:
                if re.search(pattern, combined, re.IGNORECASE):
                    alert_candidate = {
                        "title": f"Suspicious Process Execution: {tech_name}",
                        "description": f"Process '{proc_name}' was executed with suspicious arguments: {cmdline[:200]}",
                        "severity": severity,
                        "mitre_tactic": tactic,
                        "mitre_technique_id": tech_id,
                        "mitre_technique_name": tech_name,
                        "suggested_remediation": f"Isolate endpoint '{device.hostname}', terminate PID {payload.get('pid')}, and verify parent process {payload.get('parent_name')}.",
                        "details": {"pid": payload.get("pid"), "cmd": cmdline, "parent": payload.get("parent_name")}
                    }
                    break

        # 2. CLIPBOARD_SYNC Evaluation
        elif event_type == "CLIPBOARD_SYNC":
            content = str(payload.get("content", ""))
            for pattern, desc in SENSITIVE_PATTERNS:
                if re.search(pattern, content, re.IGNORECASE):
                    alert_candidate = {
                        "title": f"Data Exposure: {desc}",
                        "description": f"Canary or sensitive pattern was copied to the clipboard by user '{event.username or device.current_user}'. Content snippet: '{content[:60]}...'",
                        "severity": "HIGH",
                        "mitre_tactic": "Collection",
                        "mitre_technique_id": "T1115",
                        "mitre_technique_name": "Clipboard Data Exposure",
                        "suggested_remediation": "Audit user permissions, invalidate exposed tokens/keys immediately, and review destination window.",
                        "details": {"match": desc, "snippet": content[:80]}
                    }
                    break

        # 3. PRINT_JOB Evaluation
        elif event_type == "PRINT_JOB":
            doc_name = str(payload.get("document_name", "")).lower()
            pages = int(payload.get("pages", 1))
            suspicious_words = ["confidential", "restricted", "payroll", "salary", "credentials", "passwords", "top secret"]
            
            is_sensitive_title = any(w in doc_name for w in suspicious_words)
            if is_sensitive_title or pages >= 100:
                severity = "HIGH" if is_sensitive_title else "MEDIUM"
                alert_candidate = {
                    "title": f"Suspicious Print Activity: {payload.get('document_name')}",
                    "description": f"User '{event.username or device.current_user}' spooled print job '{payload.get('document_name')}' ({pages} pages) on printer '{payload.get('printer_name')}'.",
                    "severity": severity,
                    "mitre_tactic": "Exfiltration",
                    "mitre_technique_id": "T1052",
                    "mitre_technique_name": "Exfiltration via Physical Medium / Hard Copy",
                    "suggested_remediation": "Cross-reference with employee NDA clearance and verify with direct supervisor.",
                    "details": {"document": payload.get("document_name"), "pages": pages, "printer": payload.get("printer_name")}
                }

        # 4. BROWSER_VISIT Evaluation
        elif event_type == "BROWSER_VISIT":
            url = str(payload.get("url", "")).lower()
            title = str(payload.get("title", ""))
            for pattern, tech_id, tactic, tech_name, severity in SUSPICIOUS_DOMAINS:
                if re.search(pattern, url, re.IGNORECASE):
                    alert_candidate = {
                        "title": f"Phishing / Threat Navigation: {tech_name}",
                        "description": f"Endpoint visited flagged suspicious URL: {url[:160]} (Title: {title[:80]}).",
                        "severity": severity,
                        "mitre_tactic": tactic,
                        "mitre_technique_id": tech_id,
                        "mitre_technique_name": tech_name,
                        "suggested_remediation": "Block domain at border gateway/DNS sinkhole, flush local DNS cache, check for credential submission.",
                        "details": {"url": url, "browser": payload.get("browser")}
                    }
                    break

        # 5. AUTH_FAILURE / Repeated Anomaly Evaluation
        elif event_type == "AUTH_FAILURE":
            fail_count = int(payload.get("failure_count", 1))
            if fail_count >= 3:
                alert_candidate = {
                    "title": "Multiple Failed Authentication Attempts",
                    "description": f"Workstation recorded {fail_count} sequential failed logon attempts for user '{event.username}'. Automated camera snapshot requested.",
                    "severity": "HIGH",
                    "mitre_tactic": "Credential Access",
                    "mitre_technique_id": "T1110.001",
                    "mitre_technique_name": "Brute Force: Password Guessing",
                    "suggested_remediation": "Review workstation camera snapshot, temporarily lock domain account, contact physical security.",
                    "details": {"failure_count": fail_count, "target_user": event.username}
                }

        # 6. CAMERA_ALERT / SNAPSHOT CAPTURED
        elif event_type == "CAMERA_ALERT":
            alert_candidate = {
                "title": "Anomaly-Triggered Camera Snapshot Logged",
                "description": f"Physical presence verified via webcam following trigger event: {payload.get('reason', 'Security Anomaly')}.",
                "severity": "MEDIUM",
                "mitre_tactic": "Collection",
                "mitre_technique_id": "T1125",
                "mitre_technique_name": "Video Capture / Chain of Custody Verification",
                "suggested_remediation": "Verify physical workstation occupant in the audit console.",
                "details": {"snapshot_path": payload.get("snapshot_path"), "reason": payload.get("reason")}
            }

        # Create alert if candidate triggered
        if alert_candidate:
            alert = Alert(
                title=alert_candidate["title"],
                description=alert_candidate["description"],
                severity=alert_candidate["severity"],
                mitre_tactic=alert_candidate.get("mitre_tactic"),
                mitre_technique_id=alert_candidate.get("mitre_technique_id"),
                mitre_technique_name=alert_candidate.get("mitre_technique_name"),
                device_id=device.id,
                username=event.username or device.current_user,
                status="OPEN",
                suggested_remediation=alert_candidate.get("suggested_remediation"),
                detected_at=datetime.now(timezone.utc),
                event_id=event.id,
                details=alert_candidate.get("details", {})
            )
            db.add(alert)

            # Update device risk score and status
            severity_points = {"LOW": 10, "MEDIUM": 25, "HIGH": 50, "CRITICAL": 85}
            device.risk_score = min(100, device.risk_score + severity_points.get(alert.severity, 20))
            if alert.severity in ["HIGH", "CRITICAL"]:
                device.status = "COMPROMISED"
            
            await db.flush()

            # Broadcast live alert via WebSocket
            await ws_manager.broadcast_json({
                "type": "NEW_ALERT",
                "alert": {
                    "id": alert.id,
                    "title": alert.title,
                    "description": alert.description,
                    "severity": alert.severity,
                    "mitre_tactic": alert.mitre_tactic,
                    "mitre_technique_id": alert.mitre_technique_id,
                    "mitre_technique_name": alert.mitre_technique_name,
                    "device_id": device.id,
                    "hostname": device.hostname,
                    "username": alert.username,
                    "branch_name": device.branch_name,
                    "detected_at": alert.detected_at.isoformat(),
                    "suggested_remediation": alert.suggested_remediation
                }
            })

            # Dispatch to external channels (Discord / Slack / SIEM)
            try:
                from app.services.webhook_dispatcher import webhook_dispatcher
                await webhook_dispatcher.dispatch_alert(db, alert, device)
            except Exception as e:
                logger.error(f"Failed to dispatch alert to external webhooks: {e}")

            return alert

        return None


detection_engine = DetectionEngine()
