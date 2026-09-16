import os
import sys

# Ensure agent-desktop directory is in sys.path
sys.path.insert(0, os.path.abspath("agent-desktop"))

from agent import ArgusAgent

if __name__ == "__main__":
    print("=" * 65)
    print("   Starting ARGUS Desktop Telemetry Agent")
    print("   Collecting Real Host Telemetry (Processes, Clipboard, Browser, Print)")
    print("=" * 65)
    agent = ArgusAgent()
    agent.start()
