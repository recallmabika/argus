import uvicorn
import os
import sys

# Ensure backend directory is in sys.path
sys.path.insert(0, os.path.abspath("backend"))

if __name__ == "__main__":
    print("=" * 65)
    print("   Starting ARGUS CyberSecOps Central SOC & Ingestion API")
    print("   Web Console: http://localhost:8000/")
    print("   API Docs:    http://localhost:8000/docs")
    print("=" * 65)
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=False)
