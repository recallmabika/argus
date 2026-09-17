import os
import sys
import argparse

parser = argparse.ArgumentParser(description="ARGUS Desktop Telemetry Agent")
parser.add_argument("--server", help="ARGUS server URL (e.g. http://192.168.1.120:8000)", default=None)
parser.add_argument("--org", help="Organization name (e.g. CBZ, Argus)", default=None)
args, unknown = parser.parse_known_args()

if args.server:
    os.environ["ARGUS_SERVER_URL"] = args.server
if args.org:
    os.environ["ARGUS_BRANCH_NAME"] = args.org

# Ensure agent-desktop directory is in sys.path
sys.path.insert(0, os.path.abspath("agent-desktop"))

from agent import ArgusAgent

if __name__ == "__main__":
    server_target = os.environ.get("ARGUS_SERVER_URL", "http://127.0.0.1:8000")
    print("=" * 65)
    print("   Starting ARGUS Desktop Telemetry Agent")
    print(f"   Target Server: {server_target}")
    print("   Collecting Real Host Telemetry (Processes, Clipboard, Browser, Print)")
    print("=" * 65)
    agent = ArgusAgent()
    agent.start()

