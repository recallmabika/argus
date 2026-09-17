import asyncio
import logging
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional
import httpx
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.models import WebhookConfig, Alert, Device

logger = logging.getLogger("artis.webhooks")


class WebhookDispatcher:
    """
    Automated dispatch service for routing high-priority SOC threat detections
    to external enterprise channels (Discord, Slack, SIEM / Generic JSON Webhooks).
    """

    SEVERITY_WEIGHT = {
        "LOW": 1,
        "MEDIUM": 2,
        "HIGH": 3,
        "CRITICAL": 4,
        "ALL": 0,
    }

    def _should_send(self, alert_severity: str, min_severity: str) -> bool:
        if min_severity.upper() == "ALL":
            return True
        alert_w = self.SEVERITY_WEIGHT.get(alert_severity.upper(), 1)
        min_w = self.SEVERITY_WEIGHT.get(min_severity.upper(), 3)
        return alert_w >= min_w

    def _format_payload(self, webhook_type: str, alert: Alert, device: Optional[Device] = None) -> Dict[str, Any]:
        hostname = device.hostname if device else "Unknown Host"
        os_type = device.os_type if device else "Unknown OS"
        device_id = device.id if device else alert.device_id

        if webhook_type.upper() == "DISCORD":
            color_int = 0xFF0000 if alert.severity == "CRITICAL" else 0xFF8800 if alert.severity == "HIGH" else 0xFFFFFF
            return {
                "username": "ARTIS EDR Defender",
                "embeds": [
                    {
                        "title": f"🚨 [{alert.severity}] {alert.title}",
                        "description": alert.description or "Automated behavioral intrusion detection triggered.",
                        "color": color_int,
                        "fields": [
                            {"name": "MITRE ATT&CK", "value": f"`{alert.mitre_tactic}` ({alert.mitre_technique})", "inline": True},
                            {"name": "Host / OS", "value": f"`{hostname}` ({os_type})", "inline": True},
                            {"name": "Status", "value": f"`{alert.status}`", "inline": True},
                            {"name": "Device ID", "value": f"`{device_id}`", "inline": False},
                            {"name": "Timestamp", "value": alert.detected_at.isoformat() if alert.detected_at else datetime.now(timezone.utc).isoformat(), "inline": False},
                        ],
                        "footer": {
                            "text": "ARTIS Enterprise SOC Security Core"
                        }
                    }
                ]
            }

        elif webhook_type.upper() == "SLACK":
            return {
                "text": f"🚨 *[{alert.severity}] {alert.title}* on `{hostname}`",
                "attachments": [
                    {
                        "color": "#e01e5a" if alert.severity == "CRITICAL" else "#ecb22e",
                        "blocks": [
                            {
                                "type": "section",
                                "text": {
                                    "type": "mrkdwn",
                                    "text": f"*{alert.title}*\n{alert.description}\n\n*MITRE Technique:* `{alert.mitre_technique}` ({alert.mitre_tactic})\n*Host:* `{hostname}` | *Status:* `{alert.status}`"
                                }
                            }
                        ]
                    }
                ]
            }

        else:
            # GENERIC_JSON / SIEM webhook
            return {
                "source": "ARTIS_EDR",
                "alert_id": alert.id,
                "title": alert.title,
                "description": alert.description,
                "severity": alert.severity,
                "status": alert.status,
                "mitre_tactic": alert.mitre_tactic,
                "mitre_technique": alert.mitre_technique,
                "device": {
                    "id": device_id,
                    "hostname": hostname,
                    "os_type": os_type,
                },
                "detected_at": alert.detected_at.isoformat() if alert.detected_at else datetime.now(timezone.utc).isoformat(),
            }

    async def dispatch_alert(self, db: AsyncSession, alert: Alert, device: Optional[Device] = None):
        """
        Dispatches an alert to all active webhooks meeting the minimum severity threshold.
        Runs non-blocking via asyncio.
        """
        try:
            res = await db.execute(select(WebhookConfig).where(WebhookConfig.is_enabled == True))
            webhooks = res.scalars().all()
            if not webhooks:
                return

            tasks = []
            for wh in webhooks:
                if self._should_send(alert.severity, wh.min_severity):
                    payload = self._format_payload(wh.webhook_type, alert, device)
                    tasks.append(self._send_http(wh.url, payload))

            if tasks:
                await asyncio.gather(*tasks, return_exceptions=True)
        except Exception as e:
            logger.error(f"Error during webhook dispatch: {e}")

    async def _send_http(self, url: str, payload: Dict[str, Any]) -> bool:
        try:
            async with httpx.AsyncClient(timeout=6.0) as client:
                resp = await client.post(url, json=payload)
                if resp.is_success:
                    logger.info(f"Successfully posted alert to webhook: {url}")
                    return True
                else:
                    logger.warning(f"Webhook {url} returned status {resp.status_code}")
                    return False
        except Exception as e:
            logger.error(f"Failed to post to webhook {url}: {e}")
            return False

    async def test_webhook(self, webhook: WebhookConfig) -> Tuple[bool, int, str]:
        """
        Sends a live test notification payload to verify webhook destination connectivity.
        """
        test_payload = {
            "source": "ARTIS_EDR_TEST",
            "message": f"Verification test dispatch for {webhook.name} from ARTIS EDR console.",
            "webhook_type": webhook.webhook_type,
            "min_severity": webhook.min_severity,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        if webhook.webhook_type.upper() == "DISCORD":
            body = {
                "username": "ARTIS EDR Defender",
                "embeds": [
                    {
                        "title": "✅ ARTIS Webhook Integration Test",
                        "description": f"Webhook `{webhook.name}` successfully verified and connected to ARTIS SOC.",
                        "color": 0xFFFFFF,
                        "fields": [
                            {"name": "Destination Type", "value": f"`{webhook.webhook_type}`", "inline": True},
                            {"name": "Min Severity", "value": f"`{webhook.min_severity}`", "inline": True},
                            {"name": "Timestamp", "value": test_payload["timestamp"], "inline": False}
                        ],
                        "footer": {"text": "ARTIS SOC Notification Pipeline"}
                    }
                ]
            }
        elif webhook.webhook_type.upper() == "SLACK":
            body = {
                "text": f"✅ *ARTIS Webhook Integration Test*: Channel `{webhook.name}` verified successfully."
            }
        else:
            body = test_payload

        try:
            async with httpx.AsyncClient(timeout=8.0) as client:
                resp = await client.post(webhook.url, json=body)
                if resp.is_success:
                    return True, resp.status_code, "Connected successfully"
                else:
                    return False, resp.status_code, f"Destination returned HTTP {resp.status_code}: {resp.text[:150]}"
        except Exception as e:
            return False, 0, str(e)


webhook_dispatcher = WebhookDispatcher()
