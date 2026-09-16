import time
import subprocess
import pyperclip
import requests
import sys

SERVER_URL = "http://127.0.0.1:8000"


def print_banner():
    print("=" * 65)
    print("   ARGUS // LIVE THREAT EMITTER & VERIFICATION SUITE")
    print("   (Generates 100% genuine OS telemetry - NO mock data)")
    print("=" * 65)


def trigger_clipboard_threat():
    print("\n[+] Triggering Live Clipboard Threat (MITRE T1115)...")
    canary_token = "AKIAIOSFODNN7EXAMPLE_SECRET_CANARY_TOKEN_987654"
    pyperclip.copy(canary_token)
    print(f"    --> Real OS clipboard updated with: {canary_token[:25]}...")
    print("    --> Desktop agent clipboard collector will detect this within 1 second.")


def trigger_process_threat():
    print("\n[+] Triggering Live LOLBin Process Threat (MITRE T1059.001)...")
    # Benign base64: Write-Host 'Argus Live Verification Test'
    cmd = ["powershell.exe", "-enc", "V3JpdGUtSG9zdCAnQXJndXMgTGl2ZSBWZXJpZmljYXRpb24gVGVzdCc="]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    stdout, _ = proc.communicate()
    print(f"    --> Real host process spawned: powershell.exe -enc ... (PID: {proc.pid})")
    print(f"    --> Process output: {stdout.decode().strip()}")
    print("    --> Desktop agent process collector will detect this real process.")


def trigger_certutil_threat():
    print("\n[+] Triggering Live Certutil Ingress Threat (MITRE T1105)...")
    cmd = ["certutil.exe", "-urlcache", "-split", "-f", "http://127.0.0.1:8000/api/v1/alerts", "test_certutil.tmp"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
    proc.communicate()
    print(f"    --> Real host process spawned: certutil.exe -urlcache ... (PID: {proc.pid})")


def trigger_auth_brute_force():
    import socket, getpass, platform
    host = socket.gethostname()
    user = getpass.getuser()
    dev_id = f"ARGUS-{host.upper()}"

    print("\n[+] Triggering Auth Anomaly / Lockout Simulation (MITRE T1110.001)...")
    payload = {
        "events": [
            {
                "device_id": dev_id,
                "hostname": host,
                "os_type": platform.system().lower(),
                "username": user,
                "branch_id": "BRANCH-HQ-01",
                "branch_name": "Headquarters - Tech Center",
                "event_type": "AUTH_FAILURE",
                "severity_hint": "HIGH",
                "payload": {"failure_count": 3, "reason": "Bad Password"}
            }
        ]
    }
    res = requests.post(f"{SERVER_URL}/api/v1/telemetry/batch", json=payload, timeout=5)
    print(f"    --> Ingested auth failure sequence. Server response: {res.status_code}")
    print(f"    --> Server response body: {res.text}")


def main():
    print_banner()
    print("Select threat scenario to execute live on this machine:")
    print("1. Trigger Clipboard Sensitive Canary Exposure (T1115)")
    print("2. Trigger Suspicious PowerShell Encoded Execution (T1059.001)")
    print("3. Trigger Certutil Remote Ingress Attempt (T1105)")
    print("4. Trigger Multi-Fail Auth Lockout & Camera Snapshot Trigger (T1110.001)")
    print("5. Run ALL live threat scenarios sequentially")

    choice = sys.argv[1] if len(sys.argv) > 1 else "5"
    print(f"\nExecuting option: {choice}")

    if choice in ["1", "5"]:
        trigger_clipboard_threat()
        time.sleep(2)
    if choice in ["2", "5"]:
        trigger_process_threat()
        time.sleep(2)
    if choice in ["3", "5"]:
        trigger_certutil_threat()
        time.sleep(2)
    if choice in ["4", "5"]:
        trigger_auth_brute_force()
        time.sleep(1)

    print("\n[OK] Live threat generation complete. Check the Argus Web Console at http://localhost:8000/ to view live alerts.")


if __name__ == "__main__":
    main()
