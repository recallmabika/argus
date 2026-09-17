import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.core.database import init_db
from app.api.v1.telemetry import router as telemetry_router
from app.api.v1.devices import router as devices_router
from app.api.v1.alerts import router as alerts_router
from app.api.v1.reports import router as reports_router
from app.api.v1.audit import router as audit_router
from app.api.v1.users import router as users_router
from app.api.v1.forensics import router as forensics_router
from app.services.websocket_manager import ws_manager


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables on startup
    await init_db()
    yield


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Template engine & Static files
templates_dir = os.path.join(os.path.dirname(__file__), "templates")
templates = Jinja2Templates(directory=templates_dir)

static_dir = os.path.join(os.path.dirname(__file__), "static")
app.mount("/static", StaticFiles(directory=static_dir), name="static")

# Register API v1 Routers
app.include_router(telemetry_router, prefix=f"{settings.API_V1_STR}/telemetry", tags=["Telemetry"])
app.include_router(devices_router, prefix=f"{settings.API_V1_STR}/devices", tags=["Devices"])
app.include_router(alerts_router, prefix=f"{settings.API_V1_STR}/alerts", tags=["Alerts"])
app.include_router(reports_router, prefix=f"{settings.API_V1_STR}/reports", tags=["Reports"])
app.include_router(audit_router, prefix=f"{settings.API_V1_STR}/audit", tags=["Audit"])
app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["Users"])
app.include_router(forensics_router, prefix=f"{settings.API_V1_STR}/forensics", tags=["Digital Forensics"])


@app.get("/", response_class=HTMLResponse)
async def get_dashboard(request: Request):
    """Renders the SOC web console dashboard."""
    return templates.TemplateResponse(request=request, name="index.html")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Real-time WebSocket feed for threat alerts and device updates."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keepalive listener
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception:
        ws_manager.disconnect(websocket)
