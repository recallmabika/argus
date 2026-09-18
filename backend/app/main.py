import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Request
from fastapi.responses import HTMLResponse, FileResponse
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
from app.api.v1.spatial import router as spatial_router
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

# Mount Snapshots directory for evidence previews
if os.path.exists(settings.SNAPSHOTS_DIR):
    app.mount("/snapshots", StaticFiles(directory=settings.SNAPSHOTS_DIR), name="snapshots")

# React + TypeScript SPA dist directory
frontend_dist = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist"))
frontend_assets = os.path.join(frontend_dist, "assets")
if os.path.exists(frontend_assets):
    app.mount("/assets", StaticFiles(directory=frontend_assets), name="frontend-assets")

# Register API v1 Routers
app.include_router(telemetry_router, prefix=f"{settings.API_V1_STR}/telemetry", tags=["Telemetry"])
app.include_router(devices_router, prefix=f"{settings.API_V1_STR}/devices", tags=["Devices"])
app.include_router(alerts_router, prefix=f"{settings.API_V1_STR}/alerts", tags=["Alerts"])
app.include_router(reports_router, prefix=f"{settings.API_V1_STR}/reports", tags=["Reports"])
app.include_router(audit_router, prefix=f"{settings.API_V1_STR}/audit", tags=["Audit"])
app.include_router(users_router, prefix=f"{settings.API_V1_STR}/users", tags=["Users"])
app.include_router(forensics_router, prefix=f"{settings.API_V1_STR}/forensics", tags=["Digital Forensics"])
app.include_router(spatial_router, prefix=f"{settings.API_V1_STR}/spatial", tags=["Spatial Intelligence & Telemetry"])


@app.get("/favicon.ico", include_in_schema=False)
async def favicon():
    """Serves the ARTIS platform favicon directly at the root."""
    spa_favicon = os.path.join(frontend_dist, "favicon.svg")
    if os.path.exists(spa_favicon):
        return FileResponse(spa_favicon, media_type="image/svg+xml")
    favicon_path = os.path.join(static_dir, "img", "favicon.ico")
    if os.path.exists(favicon_path):
        return FileResponse(favicon_path, media_type="image/x-icon")
    return HTMLResponse(status_code=404)


def _render_spa_or_template(request: Request, template_name: str):
    spa_index = os.path.join(frontend_dist, "index.html")
    if os.path.exists(spa_index):
        return FileResponse(spa_index)
    return templates.TemplateResponse(request=request, name=template_name)


@app.get("/", response_class=HTMLResponse)
@app.get("/landing", response_class=HTMLResponse)
async def get_landing_page(request: Request):
    """Renders the executive landing page (React SPA or Jinja fallback)."""
    return _render_spa_or_template(request, "landing.html")


@app.get("/console", response_class=HTMLResponse)
@app.get("/dashboard", response_class=HTMLResponse)
async def get_dashboard(request: Request):
    """Renders the operational SOC dashboard (React SPA or Jinja fallback)."""
    return _render_spa_or_template(request, "index.html")


@app.get("/threats", response_class=HTMLResponse)
async def get_threats_page(request: Request):
    """Renders the dedicated real-time Threat Stream page (React SPA or Jinja fallback)."""
    return _render_spa_or_template(request, "threats.html")


# Legacy template routes
@app.get("/legacy", response_class=HTMLResponse)
@app.get("/legacy/landing", response_class=HTMLResponse)
async def get_legacy_landing(request: Request):
    return templates.TemplateResponse(request=request, name="landing.html")


@app.get("/legacy/dashboard", response_class=HTMLResponse)
@app.get("/legacy/console", response_class=HTMLResponse)
async def get_legacy_dashboard(request: Request):
    return templates.TemplateResponse(request=request, name="index.html")


@app.get("/legacy/threats", response_class=HTMLResponse)
async def get_legacy_threats(request: Request):
    return templates.TemplateResponse(request=request, name="threats.html")


@app.get("/{full_path:path}", response_class=HTMLResponse)
async def spa_catch_all(request: Request, full_path: str):
    """SPA catch-all to route any client-side paths to the React SPA index."""
    if full_path.startswith(("api/", "static/", "assets/", "ws")):
        return HTMLResponse(status_code=404)
    return _render_spa_or_template(request, "index.html")


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
