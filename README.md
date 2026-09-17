# ARTIS // Advanced Real-Time Incident Security
<div align="center">

# 🛡️ ARTIS // Advanced Real-Time Incident Security

**Real-Time Threat Detection • Multi-Branch Device Monitoring • Signed Chain-of-Custody Incident Reporting**

[![FastAPI](https://img.shields.io/badge/Backend-FastAPI-009688.svg?style=flat&logo=fastapi)](https://fastapi.tiangolo.com)
[![MITRE ATT&CK](https://img.shields.io/badge/Threat%20Model-MITRE%20ATT%26CK-red.svg)](https://attack.mitre.org)
[![Cryptography](https://img.shields.io/badge/Signature-Ed25519%20%2B%20SHA--256-blue.svg)](https://cryptography.io)
[![Telemetry](https://img.shields.io/badge/Telemetry-100%25%20Genuine%20OS-brightgreen.svg)]()

</div>

---

### Overview
**ARTIS** (**A**dvanced **R**eal-**T**ime **I**ncident **S**ecurity) is an enterprise CyberSecOps SOC and endpoint monitoring platform built for the **Cyberus Competitions (COSE)**. It unifies genuine host telemetry collection (processes, browser history, clipboard, print logs, and anomaly webcam capture) with a real-time MITRE ATT&CK detection engine, interactive branch geolocation mapping, and cryptographically verified, tamper-evident PDF incident response reports.

Entry for the CyberSecOps competition (Cyberus Competitions).

**ARTIS** provides unified threat detection, endpoint device monitoring across organization branches, real-time alerting, and tamper-evident signed PDF incident reports.

---

## Key Features & Competition Compliance

| Feature | Specification | Implementation in ARTIS |
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
                     |           ARTIS BACKEND           |
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

## 🔬 Digital Forensics & Hardware Device Bridge

ARTIS features an integrated **Digital Forensics Subsystem** enabling security administrators and forensic investigators to plug in hardware targets via cable (USB/ADB or mass storage) or pair wirelessly (Wi-Fi ADB / TCP/IP):

1. **Dynamic Hardware & Wireless Discovery:**
   - Detects attached USB mobile devices, flash drives, external forensic disks, and workstation endpoints via live hardware listeners.
   - Built-in wireless pairing dialogue (`adb connect <ip>:<port>`).

2. **Interactive Visual Remote Control & Screen Navigation:**
   - Streams live framebuffer displays from attached targets directly into the SOC console.
   - **Full PC Navigation:** Click on the screen to tap, drag across the canvas to swipe, navigate apps, and inspect target files.
   - **Hardware Key Emulator:** Emulate Android physical buttons: `BACK` (key 4), `HOME` (key 3), `RECENTS/APPS` (key 187), `POWER` (key 26), and volume controls.
   - **Remote Text & Keystroke Injection:** Send input directly into active device forms and passwords.

3. **Forensic Evidence File Acquisition:**
   - Deep file system browser for mobile storage (`/sdcard`, internal storage) and mounted volumes.
   - One-click extraction with automated **SHA-256** and **MD5** cryptographic digest calculation preserving courtroom chain of custody.

4. **Live System Triage & Forensic Shell:**
   - Extracts installed package manifests, active processes, and network routing tables.
   - Built-in interactive forensic terminal for direct command execution on target devices.

---

## Security & Cryptographic Verification

All incident reports generated through the Web Console or API are signed using an Ed25519 private key generated in `storage/keys/argus_ed25519.pem`.

To verify any report:
1. Click **Verify PDF** in the top navigation of the SOC Web Console.
2. Upload the exported PDF file.
3. The server computes the SHA-256 digest and validates the Ed25519 signature against the ARTIS public key, confirming document integrity and chain of custody.
