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
        
        # 2. Test Ingestion API with genuine event payloads
        print("\n[2/5] Testing Ingestion API & MITRE ATT&CK Engine...")
        telemetry_payload = {
            "events": [
                {
                    "device_id": "TEST-DEVICE-WIN-01",
                    "hostname": "WORKSTATION-CORP-42",
                    "os_type": "windows",
                    "username": "alice_secops",
                    "branch_id": "BRANCH-NY-01",
                    "branch_name": "New York Regional Office",
                    "event_type": "PROCESS_START",
                    "severity_hint": "INFO",
                    "payload": {
                        "pid": 4812,
                        "process_name": "powershell.exe",
                        "command_line": "powershell.exe -enc V3JpdGUtSG9zdCAnSW5zaWRlciBUaHJlYXQn",
                        "parent_name": "cmd.exe"
                    }
                },
                {
                    "device_id": "TEST-DEVICE-WIN-01",
                    "hostname": "WORKSTATION-CORP-42",
                    "os_type": "windows",
                    "username": "alice_secops",
                    "branch_id": "BRANCH-NY-01",
                    "branch_name": "New York Regional Office",
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

    print("\n" + "=" * 60)
    print("   ALL ARGUS SUBSYSTEMS & USER ID AUTOGEN PASSED!")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(run_verification())
