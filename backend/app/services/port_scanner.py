import socket
import time
import concurrent.futures
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone

# Standard ports with security risk taxonomy
PORT_DEFINITIONS = {
    21: {"service": "FTP", "risk": "MEDIUM", "description": "File Transfer Protocol (Cleartext authentication)"},
    22: {"service": "SSH", "risk": "LOW", "description": "Secure Shell Remote Administration"},
    23: {"service": "TELNET", "risk": "CRITICAL", "description": "Unencrypted Telnet Remote Terminal (Cleartext credentials)"},
    25: {"service": "SMTP", "risk": "MEDIUM", "description": "Simple Mail Transfer Protocol"},
    53: {"service": "DNS", "risk": "LOW", "description": "Domain Name System Server"},
    80: {"service": "HTTP", "risk": "LOW", "description": "Unencrypted Hypertext Transfer Protocol"},
    110: {"service": "POP3", "risk": "MEDIUM", "description": "Post Office Protocol v3 (Cleartext)"},
    135: {"service": "MSRPC", "risk": "HIGH", "description": "Microsoft RPC Endpoint Mapper (Lateral Movement target)"},
    139: {"service": "NETBIOS-SSN", "risk": "HIGH", "description": "NetBIOS Session Service (SMB legacy)"},
    143: {"service": "IMAP", "risk": "MEDIUM", "description": "Internet Message Access Protocol"},
    443: {"service": "HTTPS", "risk": "LOW", "description": "TLS/SSL Encrypted Web Traffic"},
    445: {"service": "MICROSOFT-DS", "risk": "CRITICAL", "description": "Direct Host SMB (Target for EternalBlue / WannaCry)"},
    993: {"service": "IMAPS", "risk": "LOW", "description": "IMAP over SSL/TLS"},
    995: {"service": "POP3S", "risk": "LOW", "description": "POP3 over SSL/TLS"},
    1433: {"service": "MSSQL", "risk": "HIGH", "description": "Microsoft SQL Server Database Instance"},
    1521: {"service": "ORACLE-TNS", "risk": "HIGH", "description": "Oracle Database TNS Listener"},
    2049: {"service": "NFS", "risk": "HIGH", "description": "Network File System mount (Access Control check required)"},
    3306: {"service": "MYSQL", "risk": "HIGH", "description": "MySQL Relational Database Service"},
    3389: {"service": "MS-WBT-SERVER", "risk": "HIGH", "description": "Microsoft Remote Desktop Protocol (Brute-force exposure)"},
    5432: {"service": "POSTGRESQL", "risk": "HIGH", "description": "PostgreSQL Relational Database Service"},
    5900: {"service": "VNC", "risk": "HIGH", "description": "Virtual Network Computing Remote Desktop"},
    6379: {"service": "REDIS", "risk": "CRITICAL", "description": "Redis Key-Value Cache (Commonly unauthenticated RCE risk)"},
    8000: {"service": "HTTP-ALT", "risk": "LOW", "description": "Common development or application web server"},
    8080: {"service": "HTTP-PROXY", "risk": "LOW", "description": "Common HTTP proxy / alternative Apache or Tomcat port"},
    8443: {"service": "HTTPS-ALT", "risk": "LOW", "description": "Alternative HTTPS / Management Portal"},
    9200: {"service": "ELASTICSEARCH", "risk": "HIGH", "description": "Elasticsearch REST API (Cluster data exposure)"},
    27017: {"service": "MONGODB", "risk": "HIGH", "description": "MongoDB NoSQL Database Server"}
}


class PortScannerService:
    def __init__(self):
        self._history: List[Dict[str, Any]] = []

    def _grab_banner(self, target_ip: str, port: int, timeout: float = 0.7) -> str:
        """Attempts to grab a service banner or HTTP header from an open socket."""
        banner = ""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(timeout)
                s.connect((target_ip, port))
                
                # If HTTP/HTTPS port, send basic HEAD probe
                if port in (80, 8080, 8000, 8443):
                    try:
                        s.sendall(b"HEAD / HTTP/1.0\r\nHost: target\r\n\r\n")
                        data = s.recv(256).decode('utf-8', errors='ignore')
                        for line in data.split('\r\n'):
                            if line.lower().startswith('server:'):
                                return line.strip()
                    except Exception:
                        pass
                
                # Standard read for SSH, FTP, SMTP
                try:
                    data = s.recv(256).decode('utf-8', errors='ignore').strip()
                    if data:
                        return data[:80]
                except Exception:
                    pass
        except Exception:
            pass
        return banner

    def _scan_port(self, target_ip: str, port: int, timeout: float = 0.6) -> Optional[Dict[str, Any]]:
        """Scans a single TCP port using standard socket connect."""
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(timeout)
                result = s.connect_ex((target_ip, port))
                if result == 0:
                    meta = PORT_DEFINITIONS.get(port, {
                        "service": "UNKNOWN",
                        "risk": "INFO",
                        "description": "Unregistered application port"
                    })
                    banner = self._grab_banner(target_ip, port)
                    return {
                        "port": port,
                        "protocol": "TCP",
                        "state": "OPEN",
                        "service": meta["service"],
                        "risk": meta["risk"],
                        "description": meta["description"],
                        "banner": banner
                    }
        except Exception:
            pass
        return None

    def scan_target(self, target: str, custom_ports: Optional[List[int]] = None, timeout: float = 0.6) -> Dict[str, Any]:
        """
        Executes a fast concurrent socket port scan against target IP or hostname.
        Uses ThreadPoolExecutor for high throughput.
        """
        # Resolve hostname to IP
        resolved_ip = target.strip()
        try:
            resolved_ip = socket.gethostbyname(target.strip())
        except socket.gaierror:
            pass

        ports_to_scan = custom_ports if custom_ports else sorted(list(PORT_DEFINITIONS.keys()))
        start_time = time.time()
        open_ports: List[Dict[str, Any]] = []

        # Concurrently scan ports
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(40, len(ports_to_scan))) as executor:
            future_to_port = {
                executor.submit(self._scan_port, resolved_ip, port, timeout): port
                for port in ports_to_scan
            }
            for future in concurrent.futures.as_completed(future_to_port):
                res = future.result()
                if res:
                    open_ports.append(res)

        elapsed_ms = round((time.time() - start_time) * 1000, 2)
        open_ports.sort(key=lambda x: x["port"])

        # Calculate security posture score
        risk_weights = {"CRITICAL": 35, "HIGH": 20, "MEDIUM": 10, "LOW": 2, "INFO": 0}
        total_risk = sum(risk_weights.get(p["risk"], 0) for p in open_ports)
        security_score = max(0, 100 - total_risk)

        scan_record = {
            "id": f"scan_{int(time.time())}_{target.replace('.', '_')}",
            "target": target,
            "resolved_ip": resolved_ip,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ports_scanned": len(ports_to_scan),
            "open_ports_count": len(open_ports),
            "open_ports": open_ports,
            "duration_ms": elapsed_ms,
            "security_score": security_score,
            "status": "COMPLETED"
        }

        # Keep last 50 scans
        self._history.insert(0, scan_record)
        if len(self._history) > 50:
            self._history.pop()

        return scan_record

    def get_scan_history(self) -> List[Dict[str, Any]]:
        return self._history

    def get_scan_by_id(self, scan_id: str) -> Optional[Dict[str, Any]]:
        for s in self._history:
            if s["id"] == scan_id:
                return s
        return None


port_scanner = PortScannerService()
