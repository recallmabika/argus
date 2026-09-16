# ARGUS // CyberSecOps SOC & Device Monitoring Platform

Entry for the CyberSecOps competition (Cyberus Competitions).

**Argus** provides unified threat detection, endpoint device monitoring across organization branches, real-time alerting, and tamper-evident signed PDF incident reports.

---

## Key Features & Competition Compliance

| Feature | Specification | Implementation in Argus |
|---|---|---|
| **Threat Detection & Reporting** | Detect threats, assess impact, suggest security measures, generate PDF report | Real-time **MITRE ATT&CK** rule evaluation engine (T1059, T1115, T1048, T1052, T1110, T1071). Generates signed, tamper-evident incident PDF reports with SHA-256 and Ed25519 digital signatures. |
| **Device Monitoring across Branches** | Visibility into access, user activity, print logs, visited sites, clipboard, camera snapshots | Cross-platform desktop agent with live telemetry: active processes, SQLite shadow-copy browser history (Chrome/Edge), clipboard tracking, Windows Event 307 print spooling, and anomaly-triggered webcam snapshots. |
| **Zero Mock Data Policy** | **100% Real OS Telemetry** | Strict adherence: No mock or synthetic database seeds. Ingestion pipeline streams genuine operating system telemetry. A companion live red-team emitter triggers real benign security indicators on the host. |
| **Chain-of-Custody Framing** | Signed, hash-verified reports | Every exported incident report is hashed (SHA-256) and cryptographically signed using Ed25519 root authority. Includes an integrated `/verify-report` validation interface. |
| **Privacy & Audit Boundary** | Consent and access auditing | All telemetry inspection, report generation, and camera snapshot views are recorded in an immutable audit trail. |

---

## Architecture Overview

```
                          +-------------------------+
                          |   Monitored Endpoint    |
                          |  (Windows/Mac/Linux)    |
                          |    Desktop Agent        |
                          +------------+------------+
                                       |
                Batch Ingestion (HTTP) | Anomaly Snapshot (Multipart)
                                       v
                     +-----------------------------------+
                     |           ARGUS BACKEND           |
                     |  FastAPI + SQLAlchemy + Async DB  |
                     +-----------------+-----------------+
                                       |
               +-----------------------+-----------------------+
               |                       |                       |
               v                       v                       v
    +--------------------+   +-------------------+   +--------------------+
    |  MITRE Detection   |   | Signed PDF Engine |   | Real-Time Web SOC  |
    |  ATT&CK Rules Engine | | SHA-256 + Ed25519 |   | WebSockets + Leaflet|
    +--------------------+   +-------------------+   +--------------------+
```

---

## Quickstart Guide

### 1. Start Central SOC Backend
In a terminal, run:
```bash
python run_backend.py
```
- **Web Console Dashboard:** [http://localhost:8000/](http://localhost:8000/)
- **API Documentation (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)

### 2. Launch Endpoint Agent
In a separate terminal, run:
```bash
python run_agent.py
```
The agent enrolls the host machine, initializes the local offline SQLite buffer, and begins streaming live processes, browser history, clipboard changes, and print jobs to the central console.

### 3. Run Live Red-Team Threat Emitter (100% Real OS Actions)
To test live threat detection and observe real-time alerts appear on the SOC console:
```bash
python tools/threat_emitter.py 5
```
This executes real, benign security actions on the host:
- Copies a sensitive canary API key pattern to the clipboard (MITRE T1115).
- Spawns a PowerShell process with `-enc` execution (MITRE T1059.001 - CRITICAL).
- Executes `certutil -urlcache` remote ingress tool transfer (MITRE T1105).
- Triggers a sequential authentication lockout anomaly and commands an automated camera snapshot.

### 4. Run Automated End-to-End Test Suite
```bash
python tools/test_system.py
```

---

## Security & Cryptographic Verification

All incident reports generated through the Web Console or API are signed using an Ed25519 private key generated in `storage/keys/argus_ed25519.pem`.

To verify any report:
1. Click **Verify PDF** in the top navigation of the SOC Web Console.
2. Upload the exported PDF file.
3. The server computes the SHA-256 digest and validates the Ed25519 signature against the Argus public key, confirming document integrity and chain of custody.
