"""
ARGUS Spatial Intelligence & Hardware Motion Telemetry API Router
-----------------------------------------------------------------
Endpoints for:
- Google Places API (New) Nearby Search (surrounding building intelligence)
- Google Routes API v2 navigation polylines with predictive traffic
- Real-time native device motion telemetry ingestion (m/s to MPH conversion,
  moving vs stationary state classification, and target proximity geofencing).
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from app.services.spatial_intelligence import spatial_service

router = APIRouter()


class NearbyPlacesRequest(BaseModel):
    latitude: float = Field(..., description="WGS84 latitude coordinate")
    longitude: float = Field(..., description="WGS84 longitude coordinate")
    radius_meters: float = Field(default=500.0, ge=10.0, le=5000.0, description="Search radius in meters")
    included_types: Optional[List[str]] = Field(default=None, description="Optional Google Places types filter")
    max_results: int = Field(default=15, ge=1, le=20, description="Maximum number of places to retrieve")


class RouteCalculationRequest(BaseModel):
    origin_lat: float = Field(..., description="Origin latitude")
    origin_lng: float = Field(..., description="Origin longitude")
    dest_lat: float = Field(..., description="Destination latitude")
    dest_lng: float = Field(..., description="Destination longitude")
    departure_time_iso: Optional[str] = Field(
        default=None,
        description="ISO 8601 UTC timestamp for departure window (predictive historical traffic)"
    )


class MotionTelemetryRequest(BaseModel):
    device_id: str = Field(..., description="Target device identifier")
    latitude: float = Field(..., description="Current latitude from GPS/Fused Location")
    longitude: float = Field(..., description="Current longitude from GPS/Fused Location")
    speed_mps: float = Field(..., ge=0.0, description="Raw hardware speed in meters per second (m/s)")
    target_lat: Optional[float] = Field(default=None, description="Latitude of target structure or incident")
    target_lng: Optional[float] = Field(default=None, description="Longitude of target structure or incident")
    altitude: Optional[float] = Field(default=None, description="Altitude in meters above sea level")
    accuracy: Optional[float] = Field(default=None, description="Horizontal accuracy in meters")
    heading: Optional[float] = Field(default=None, description="Bearing/heading in degrees (0-360)")
    floor_level: Optional[int] = Field(default=None, description="Indoor building floor level if available")


@router.post("/nearby-places", summary="Search buildings and venues surrounding target coordinate")
async def get_nearby_places(req: NearbyPlacesRequest):
    """
    Proxies Google Places API (New) Nearby Search securely to extract
    spatial building intelligence, primary place types, and coordinate geometry.
    """
    result = await spatial_service.search_nearby_buildings(
        latitude=req.latitude,
        longitude=req.longitude,
        radius_meters=req.radius_meters,
        included_types=req.included_types,
        max_results=req.max_results
    )
    if not result.get("success") and "API key" in result.get("error", ""):
        raise HTTPException(status_code=503, detail=result.get("error"))
    return result


@router.post("/route", summary="Calculate real-time polyline with predictive traffic")
async def calculate_route(req: RouteCalculationRequest):
    """
    Calculates navigation routes with predictive traffic polylines via Routes API v2.
    Supports departure time windows for dynamic ETA modeling.
    """
    result = await spatial_service.compute_predictive_route(
        origin_lat=req.origin_lat,
        origin_lng=req.origin_lng,
        dest_lat=req.dest_lat,
        dest_lng=req.dest_lng,
        departure_time_iso=req.departure_time_iso
    )
    if not result.get("success") and "API key" in result.get("error", ""):
        raise HTTPException(status_code=503, detail=result.get("error"))
    return result


@router.post("/telemetry/motion", summary="Process native device motion telemetry & evaluate state")
async def process_motion_telemetry(req: MotionTelemetryRequest):
    """
    Ingests native hardware location updates (from Android FusedLocationProviderClient or iOS CoreLocation),
    converts meters/second to MPH (speed * 2.23694), and evaluates contextual motion state:
    - MOVING: In transit (speed >= threshold)
    - STATIONARY: At rest (speed < threshold)
    - TARGET_PROXIMITY_LOCKED: Stationary within target radius (triggers contextual investigation)
    """
    speed_mph = spatial_service.convert_speed_mps_to_mph(req.speed_mps)

    state_analysis = spatial_service.evaluate_motion_state(
        speed_mph=speed_mph,
        current_lat=req.latitude,
        current_lng=req.longitude,
        target_lat=req.target_lat,
        target_lng=req.target_lng
    )

    return {
        "device_id": req.device_id,
        "telemetry": {
            "latitude": req.latitude,
            "longitude": req.longitude,
            "altitude": req.altitude,
            "accuracy": req.accuracy,
            "heading": req.heading,
            "floor_level": req.floor_level,
            "speed_mps": req.speed_mps,
            "speed_mph": speed_mph
        },
        "motion_analysis": state_analysis
    }
