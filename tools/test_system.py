import os
import sys
import asyncio
from pathlib import Path

# Add backend directory to sys.path
backend_dir = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(backend_dir))

from httpx import AsyncClient, ASGITransport
from app.main import app
from app.core.database import init_db
from app.services.signer import signer


async def run_verification():
    print("=" * 60)
    print("   ARGUS CYBERSECOPS - END-TO-END VERIFICATION SUITE")
    print("=" * 60)

    # 1. Initialize Database Schema
    print("[1/5] Initializing Database...")
    await init_db()
    print("      [OK] Database tables verified.")

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        
        # 2. Test Ingestion API & MITRE ATT&CK Engine with real host environment
        print("\n[2/5] Testing Ingestion API & MITRE ATT&CK Engine...")
        import socket
        import getpass
        import platform
        real_host = socket.gethostname()
        real_user = getpass.getuser()
        real_os = platform.system().lower()
        dev_id = f"ARGUS-{real_host.upper()}"

        telemetry_payload = {
            "events": [
                {
                    "device_id": dev_id,
                    "hostname": real_host,
                    "os_type": real_os,
                    "username": real_user,
                    "branch_id": "BRANCH-HQ-01",
                    "branch_name": "Headquarters - Tech Center",
                    "event_type": "PROCESS_START",
                    "severity_hint": "INFO",
                    "payload": {
                        "pid": os.getpid(),
                        "process_name": "powershell.exe",
                        "command_line": "powershell.exe -enc V3JpdGUtSG9zdCAnSW5zaWRlciBUaHJlYXQn",
                        "parent_name": "cmd.exe"
                    }
                },
                {
                    "device_id": dev_id,
                    "hostname": real_host,
                    "os_type": real_os,
                    "username": real_user,
                    "branch_id": "BRANCH-HQ-01",
                    "branch_name": "Headquarters - Tech Center",
                    "event_type": "CLIPBOARD_SYNC",
                    "severity_hint": "INFO",
                    "payload": {
                        "content": "AKIAIOSFODNN7EXAMPLETEST_SECRET_KEY",
                        "length": 35
                    }
                }
            ]
        }
        res = await client.post("/api/v1/telemetry/batch", json=telemetry_payload)
        assert res.status_code == 200, f"Ingestion failed: {res.text}"
        data = res.json()
        print(f"      [OK] Ingested {data['ingested']} events.")
        print(f"      [OK] Detection engine triggered {data['triggered_alerts']} alerts.")
        print(f"      [OK] Server dispatched commands: {data['commands']}")

        # 3. Test Alerts API
        print("\n[3/5] Querying Active Alerts & Threat Matrix...")
        alerts_res = await client.get("/api/v1/alerts")
        assert alerts_res.status_code == 200
        alerts = alerts_res.json()
        print(f"      [OK] Total active alerts in SOC: {len(alerts)}")
        for a in alerts[:2]:
            print(f"          - [{a['severity']}] {a['title']} (MITRE: {a.get('mitre_technique_id')} - {a.get('mitre_technique_name')})")

        # 4. Test Signed Incident PDF Report Generation
        print("\n[4/5] Generating Signed Incident PDF Report...")
        report_req = {
            "title": "Automated SOC End-to-End Threat & Incident Report",
            "report_type": "ANALYST"
        }
        rep_res = await client.post("/api/v1/reports/generate", json=report_req)
        assert rep_res.status_code == 200, f"Report generation failed: {rep_res.text}"
        report_data = rep_res.json()
        print(f"      [OK] Report generated: {report_data['title']}")
        print(f"      [OK] Cryptographic SHA-256 Checksum: {report_data['sha256_hash']}")
        print(f"      [OK] Ed25519 Signature: {report_data['signature_hex'][:40]}...")

        # Verify signature validity
        download_res = await client.get(report_data['download_url'])
        assert download_res.status_code == 200
        pdf_bytes = download_res.content
        calculated_sha = signer.calculate_sha256(pdf_bytes)
        assert calculated_sha == report_data['sha256_hash'], "Checksum mismatch!"
        print("      [OK] PDF file downloaded and SHA-256 integrity strictly verified.")

        # 5. Test Audit Trail
        print("\n[5/6] Auditing Access Logs...")
        audit_res = await client.get("/api/v1/audit")
        assert audit_res.status_code == 200
        logs = audit_res.json()
        print(f"      [OK] Audit trail recorded {len(logs)} compliance entries.")
        for l in logs[:2]:
            print(f"          - [{l['actor_username']}] {l['action']} on {l['target_resource']} at {l['timestamp']}")

        # 6. Test User ID Autogeneration & Organization Multi-Tenancy
        print("\n[6/6] Testing User ID Autogeneration (AG-ORG01-0001 format)...")
        # Ensure clean state for CBZ and Bizmark test entries
        from app.core.database import AsyncSessionLocal
        from app.models.models import Organization, User
        from sqlalchemy import delete
        async with AsyncSessionLocal() as db:
            await db.execute(delete(User).where(User.email.in_(["t.moyo@cbz.co.zw", "c.ndlovu@cbz.co.zw", "d.mutasa@bizmarktech.com"])))
            await db.execute(delete(Organization).where(Organization.code.in_(["CBZ", "BZT"])))
            await db.commit()

        me_res = await client.get("/api/v1/users/me")
        assert me_res.status_code == 200
        me_data = me_res.json()
        print(f"      [OK] Default SOC Lead: {me_data['full_name']} -> User ID: {me_data['user_id']}")
        assert me_data['user_id'] == "AG-ARG01-0001", f"Expected AG-ARG01-0001, got {me_data['user_id']}"

        # Register user in CBZ
        cbz_res = await client.post("/api/v1/users/register", json={
            "full_name": "Tafadzwa Moyo",
            "email": "t.moyo@cbz.co.zw",
            "organization_name": "Commercial Bank of Zimbabwe (CBZ)",
            "role": "analyst"
        })
        assert cbz_res.status_code == 200, f"CBZ registration failed: {cbz_res.text}"
        cbz_user = cbz_res.json()["user"]
        print(f"      [OK] 1st User in CBZ: {cbz_user['full_name']} -> User ID: {cbz_user['user_id']}")
        assert cbz_user['user_id'] == "AG-CBZ02-0001", f"Expected AG-CBZ02-0001, got {cbz_user['user_id']}"

        # Register 2nd user in CBZ
        cbz2_res = await client.post("/api/v1/users/register", json={
            "full_name": "Chipo Ndlovu",
            "email": "c.ndlovu@cbz.co.zw",
            "organization_name": "Commercial Bank of Zimbabwe",
            "role": "analyst"
        })
        assert cbz2_res.status_code == 200
        cbz2_user = cbz2_res.json()["user"]
        print(f"      [OK] 2nd User in CBZ: {cbz2_user['full_name']} -> User ID: {cbz2_user['user_id']}")
        assert cbz2_user['user_id'] == "AG-CBZ02-0002", f"Expected AG-CBZ02-0002, got {cbz2_user['user_id']}"

        # Register user in Bizmark Technology
        bzt_res = await client.post("/api/v1/users/register", json={
            "full_name": "David Mutasa",
            "email": "d.mutasa@bizmarktech.com",
            "organization_name": "Bizmark Technology",
            "role": "analyst"
        })
        assert bzt_res.status_code == 200
        bzt_user = bzt_res.json()["user"]
        print(f"      [OK] 1st User in Bizmark Technology: {bzt_user['full_name']} -> User ID: {bzt_user['user_id']}")
        assert bzt_user['user_id'] == "AG-BZT03-0001", f"Expected AG-BZT03-0001, got {bzt_user['user_id']}"

        # Check organizations list
        orgs_res = await client.get("/api/v1/users/organizations")
        assert orgs_res.status_code == 200
        orgs = orgs_res.json()
        print(f"      [OK] Registered Organizations ({len(orgs)}):")
        for o in orgs:
            print(f"          - Org #{o['org_index']:02d} [{o['code']}]: {o['name']} ({o['user_counter']} users)")

        # 7. Test Remediation Directives & Command Pipeline
        print("\n[7/10] Testing Threat Remediation & Command Queue Pipeline...")
        cmd_req = {
            "command_type": "ISOLATE_NETWORK",
            "parameters": {"reason": "Containment verification"},
            "issued_by": "analyst"
        }
        cmd_res = await client.post(f"/api/v1/devices/{dev_id}/command", json=cmd_req)
        assert cmd_res.status_code == 200, f"Command queue failed: {cmd_res.text}"
        cmd_data = cmd_res.json()
        print(f"      [OK] Dispatched command: {cmd_data['command_type']} (ID: {cmd_data['id']})")

        dev_check = await client.get(f"/api/v1/devices/{dev_id}")
        assert dev_check.status_code == 200
        assert dev_check.json()['device']['status'] == "QUARANTINED"
        print(f"      [OK] Endpoint status transitioned to: QUARANTINED")

        # Test agent ACK
        ack_res = await client.post(f"/api/v1/devices/{dev_id}/command-ack", json={
            "command_id": cmd_data['id'],
            "status": "COMPLETED",
            "result_summary": "Firewall rules applied; SOC channel preserved."
        })
        assert ack_res.status_code == 200, f"ACK failed: {ack_res.text}"
        print("      [OK] Command ACK recorded successfully.")

        # Test restore command
        restore_res = await client.post(f"/api/v1/devices/{dev_id}/command", json={
            "command_type": "RESTORE_NETWORK",
            "parameters": {}
        })
        assert restore_res.status_code == 200
        dev_check2 = await client.get(f"/api/v1/devices/{dev_id}")
        assert dev_check2.json()['device']['status'] == "ONLINE"
        print("      [OK] Endpoint network restored to ONLINE status.")

        # 8. Test Threat Hunting Search Engine & CSV/JSON Streaming
        print("\n[8/10] Testing Threat Hunting Search & Streaming Export...")
        search_res = await client.get("/api/v1/telemetry/search?q=powershell&time_range=24h")
        assert search_res.status_code == 200
        search_data = search_res.json()
        print(f"      [OK] Search returned {search_data['total']} matches for 'powershell'.")

        csv_res = await client.get("/api/v1/telemetry/export?format=csv&time_range=24h")
        assert csv_res.status_code == 200
        assert "text/csv" in csv_res.headers.get("content-type", "")
        print("      [OK] CSV streaming export verified.")

        json_res = await client.get("/api/v1/telemetry/export?format=json&time_range=24h")
        assert json_res.status_code == 200
        assert "application/json" in json_res.headers.get("content-type", "")
        print("      [OK] JSON streaming export verified.")

        # 9. Test MITRE ATT&CK Attack Chain Reconstruction
        print("\n[9/10] Testing MITRE ATT&CK Attack Chain & Kill-Chain API...")
        if alerts:
            chain_res = await client.get(f"/api/v1/alerts/{alerts[0]['id']}/attack-chain")
            assert chain_res.status_code == 200, f"Attack chain failed: {chain_res.text}"
            chain_data = chain_res.json()
            print(f"      [OK] Kill chain mapped across {len(chain_data['stages'])} standard MITRE tactics.")
            print(f"      [OK] Correlated timeline events: {len(chain_data['timeline'])}")

        # 10. Test Enterprise Webhook Alert Forwarding
        print("\n[10/10] Testing Webhook Alert Forwarding Management...")
        wh_create_res = await client.post("/api/v1/alerts/webhooks", json={
            "name": "SOC Verification Discord",
            "url": "https://discord.com/api/webhooks/12345/test",
            "webhook_type": "DISCORD",
            "min_severity": "HIGH",
            "is_enabled": True
        })
        assert wh_create_res.status_code == 200, f"Webhook create failed: {wh_create_res.text}"
        wh_data = wh_create_res.json()
        print(f"      [OK] Registered webhook: {wh_data['name']} (ID: {wh_data['id']})")

        wh_list_res = await client.get("/api/v1/alerts/webhooks")
        assert wh_list_res.status_code == 200
        assert any(w['id'] == wh_data['id'] for w in wh_list_res.json())
        print("      [OK] Webhook verified in active configuration list.")

        wh_del_res = await client.delete(f"/api/v1/alerts/webhooks/{wh_data['id']}")
        assert wh_del_res.status_code == 200
        print("      [OK] Webhook deleted successfully.")

        # Cleanup verification test records so live SOC dashboard remains clean
        from app.models.models import Alert, TelemetryEvent, Device, DeviceCommand, WebhookConfig
        async with AsyncSessionLocal() as db:
            await db.execute(delete(DeviceCommand).where(DeviceCommand.device_id == dev_id))
            await db.execute(delete(Alert).where(Alert.device_id == dev_id))
            await db.execute(delete(TelemetryEvent).where(TelemetryEvent.device_id == dev_id))
            await db.execute(delete(Device).where(Device.id == dev_id))
            await db.commit()

    print("\n" + "=" * 60)
    print("   ALL ARGUS SUBSYSTEMS & USER ID AUTOGEN PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_verification())
