import psutil
import time
import os
import sys

class SystemMonitor:
    @staticmethod
    def get_system_health():
        health = {
            "cpu": {
                "per_core": psutil.cpu_percent(percpu=True, interval=0.1),
                "overall": psutil.cpu_percent(interval=None)
            },
            "ram": {},
            "disk": [],
            "network": {},
            "uptime": 0,
            "top_processes": []
        }

        # RAM
        try:
            mem = psutil.virtual_memory()
            health["memory"] = {
                "total": mem.total,
                "used": mem.used,
                "available": mem.available,
                "percent": mem.percent
            }
        except Exception:
            health["memory"] = {"total": 0, "used": 0, "available": 0, "percent": 0}

        # Disks
        health["disks"] = []
        try:
            for part in psutil.disk_partitions(all=False):
                try:
                    usage = psutil.disk_usage(part.mountpoint)
                    health["disks"].append({
                        "device": part.device,
                        "mountpoint": part.mountpoint,
                        "fstype": part.fstype,
                        "total": usage.total,
                        "used": usage.used,
                        "free": usage.free,
                        "percent": usage.percent
                    })
                except PermissionError:
                    continue
        except Exception:
            pass
            
        # Network I/O
        try:
            net = psutil.net_io_counters()
            health["network"] = {
                "bytes_sent": net.bytes_sent,
                "bytes_recv": net.bytes_recv,
                "packets_sent": net.packets_sent,
                "packets_recv": net.packets_recv
            }
        except Exception:
            health["network"] = {"bytes_sent": 0, "bytes_recv": 0, "packets_sent": 0, "packets_recv": 0}

        # Uptime
        try:
            health["uptime_seconds"] = int(time.time() - psutil.boot_time())
        except Exception:
            health["uptime_seconds"] = 0

        # Top 15 processes
        health["processes"] = []
        try:
            for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info', 'status', 'username']):
                try:
                    p_info = p.info
                    mem_mb = round((p_info.get('memory_info').rss / (1024 * 1024)), 1) if p_info.get('memory_info') else 0
                    health["processes"].append({
                        "pid": p_info.get("pid", 0),
                        "name": p_info.get("name") or "Unknown",
                        "cpu_percent": p.cpu_percent() or 0.0,
                        "memory_mb": mem_mb,
                        "status": p_info.get("status") or "running",
                        "username": p_info.get("username") or ""
                    })
                except (psutil.NoSuchProcess, psutil.AccessDenied, psutil.ZombieProcess):
                    pass
            health["processes"] = sorted(health["processes"], key=lambda x: x.get('cpu_percent', 0), reverse=True)[:15]
        except Exception:
            pass

        health["timestamp"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        return health

    @staticmethod
    def get_network_connections(status=None, protocol=None):
        connections = []
        try:
            for conn in psutil.net_connections(kind='all'):
                # Filter by status if provided
                if status and conn.status.lower() != status.lower():
                    continue
                    
                # Protocol filtering mapping (very basic)
                proto_map = {1: 'TCP', 2: 'UDP', 3: 'TCP6', 4: 'UDP6'}
                conn_proto = proto_map.get(conn.type, str(conn.type))
                
                if protocol and conn_proto.lower() != protocol.lower():
                    continue

                proc_name = "Unknown"
                if conn.pid:
                    try:
                        proc_name = psutil.Process(conn.pid).name()
                    except (psutil.NoSuchProcess, psutil.AccessDenied):
                        pass

                connections.append({
                    "protocol": conn_proto,
                    "local_address": conn.laddr.ip if conn.laddr else "",
                    "local_port": conn.laddr.port if conn.laddr else 0,
                    "remote_address": conn.raddr.ip if conn.raddr else "",
                    "remote_port": conn.raddr.port if conn.raddr else 0,
                    "status": conn.status or "NONE",
                    "pid": conn.pid or 0,
                    "process_name": proc_name
                })
        except Exception:
            pass
        return connections

    @staticmethod
    def get_usb_history():
        if sys.platform != "win32":
            return [{"error": "USB history parsing via registry is only supported on Windows."}]
            
        import winreg
        history = []
        
        # 1. Enumerate HKLM\SYSTEM\CurrentControlSet\Enum\USB
        try:
            usb_key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Enum\USB")
            for i in range(winreg.QueryInfoKey(usb_key)[0]):
                try:
                    vid_pid = winreg.EnumKey(usb_key, i)
                    vid_pid_key = winreg.OpenKey(usb_key, vid_pid)
                    
                    for j in range(winreg.QueryInfoKey(vid_pid_key)[0]):
                        serial = winreg.EnumKey(vid_pid_key, j)
                        instance_key = winreg.OpenKey(vid_pid_key, serial)
                        
                        try:
                            friendly_name, _ = winreg.QueryValueEx(instance_key, "FriendlyName")
                        except OSError:
                            friendly_name = "Unknown"
                            
                        try:
                            service, _ = winreg.QueryValueEx(instance_key, "Service")
                        except OSError:
                            service = "Unknown"
                            
                        vid, pid = "", ""
                        parts = vid_pid.split('&')
                        for part in parts:
                            if part.startswith('VID_'): vid = part
                            elif part.startswith('PID_'): pid = part
                                
                        history.append({
                            "vid": vid,
                            "pid": pid,
                            "serial": serial,
                            "friendly_name": friendly_name,
                            "device_class": "USB",
                            "service": service,
                            "first_installed": None,
                            "last_connected": None
                        })
                        winreg.CloseKey(instance_key)
                    winreg.CloseKey(vid_pid_key)
                except OSError:
                    continue
            winreg.CloseKey(usb_key)
        except OSError:
            pass

        # 2. Enumerate HKLM\SYSTEM\CurrentControlSet\Enum\USBSTOR
        try:
            usbstor_key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Enum\USBSTOR")
            for i in range(winreg.QueryInfoKey(usbstor_key)[0]):
                device_type = winreg.EnumKey(usbstor_key, i)
                device_type_key = winreg.OpenKey(usbstor_key, device_type)
                
                for j in range(winreg.QueryInfoKey(device_type_key)[0]):
                    serial = winreg.EnumKey(device_type_key, j)
                    instance_key = winreg.OpenKey(device_type_key, serial)
                    
                    try:
                        friendly_name, _ = winreg.QueryValueEx(instance_key, "FriendlyName")
                    except OSError:
                        friendly_name = "Unknown"
                        
                    try:
                        service, _ = winreg.QueryValueEx(instance_key, "Service")
                    except OSError:
                        service = "Unknown"
                        
                    try:
                        hardware_id, _ = winreg.QueryValueEx(instance_key, "HardwareID")
                        vid, pid = "", ""
                        if hardware_id and len(hardware_id) > 0:
                            parts = hardware_id[0].split('&')
                            for part in parts:
                                if part.startswith('VID_'): vid = part
                                elif part.startswith('PID_'): pid = part
                    except OSError:
                        vid, pid = "Unknown", "Unknown"
                        
                    history.append({
                        "vid": vid,
                        "pid": pid,
                        "serial": serial,
                        "friendly_name": friendly_name,
                        "device_class": "USBSTOR",
                        "service": service,
                        "first_installed": None,
                        "last_connected": None
                    })
                    winreg.CloseKey(instance_key)
                winreg.CloseKey(device_type_key)
            winreg.CloseKey(usbstor_key)
        except OSError:
            pass
            
        return history
