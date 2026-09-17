"""
ARGUS Spatial Intelligence & Hardware Motion Telemetry Service
--------------------------------------------------------------
Coordinates real-time location telemetry, native hardware speed processing,
spatial intelligence queries via Google Places API (New), predictive traffic
routing via Google Routes API v2, and contextual motion state classification.

Adheres strictly to Google Maps Platform Solution Architecture:
- Attribution ID: gmp_git_agentskills_v1
- Precise FieldMask optimization
- 100% genuine math and real API endpoints (Zero mock data rule)
"""

import os
import math
import httpx
import logging
from typing import Dict, Any, List, Optional
from datetime import datetime

logger = logging.getLogger("argus.spatial")

# Attribution Solution ID for Google Maps Platform tracking & compliance
GMP_SOLUTION_ID = "gmp_git_agentskills_v1"

# Conversion constant: 1 meter per second = 2.23694 miles per hour
MPS_TO_MPH_FACTOR = 2.23694

# Default speed threshold distinguishing stationary vs moving state (in MPH)
DEFAULT_STATIONARY_THRESHOLD_MPH = 2.5

# Proximity threshold within which a stationary target triggers contextual alert (meters)
DEFAULT_TARGET_PROXIMITY_RADIUS_METERS = 50.0


def calculate_haversine_distance_meters(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Computes genuine great-circle distance between two geographic points
    on Earth using the Haversine formula.
    """
    earth_radius_m = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))

    return earth_radius_m * c


class SpatialIntelligenceService:
    def __init__(self, api_key: Optional[str] = None):
        # Resolve key from environment or parameter
        self.api_key = api_key or os.environ.get("GOOGLE_MAPS_API_KEY", "")

    def convert_speed_mps_to_mph(self, speed_mps: float) -> float:
        """Converts meters/second to MPH (speed * 2.23694)."""
        if speed_mps is None or speed_mps < 0:
            return 0.0
        return round(float(speed_mps) * MPS_TO_MPH_FACTOR, 2)

    def evaluate_motion_state(
        self,
        speed_mph: float,
        current_lat: Optional[float] = None,
        current_lng: Optional[float] = None,
        target_lat: Optional[float] = None,
        target_lng: Optional[float] = None,
        threshold_mph: float = DEFAULT_STATIONARY_THRESHOLD_MPH,
        proximity_radius_m: float = DEFAULT_TARGET_PROXIMITY_RADIUS_METERS
    ) -> Dict[str, Any]:
        """
        Evaluates physical motion telemetry to classify user operational state:
        - MOVING: speed >= threshold_mph
        - STATIONARY: speed < threshold_mph
        - TARGET_PROXIMITY_LOCKED: stationary within target proximity radius
        """
        is_moving = speed_mph >= threshold_mph
        distance_to_target_m = None
        near_target = False

        if (current_lat is not None and current_lng is not None and
            target_lat is not None and target_lng is not None):
            distance_to_target_m = round(
                calculate_haversine_distance_meters(current_lat, current_lng, target_lat, target_lng), 2
            )
            near_target = distance_to_target_m <= proximity_radius_m

        if not is_moving and near_target:
            state = "TARGET_PROXIMITY_LOCKED"
            context = f"Stationary near target structure ({distance_to_target_m}m). Contextual investigation unlocked."
        elif is_moving:
            state = "MOVING"
            context = f"In transit at {speed_mph} MPH."
        else:
            state = "STATIONARY"
            context = f"Stationary in field ({speed_mph} MPH)."

        return {
            "state": state,
            "is_moving": is_moving,
            "speed_mph": speed_mph,
            "near_target": near_target,
            "distance_to_target_m": distance_to_target_m,
            "context_message": context,
            "timestamp": datetime.utcnow().isoformat() + "Z"
        }

    async def search_nearby_buildings(
        self,
        latitude: float,
        longitude: float,
        radius_meters: float = 500.0,
        included_types: Optional[List[str]] = None,
        max_results: int = 15
    ) -> Dict[str, Any]:
        """
        Queries Google Places API (New) Nearby Search to dynamically extract
        structured building and venue metadata surrounding a target coordinate.
        """
        if not self.api_key:
            return {
                "success": False,
                "error": "Google Maps API key is not configured. Set GOOGLE_MAPS_API_KEY in environment.",
                "places": []
            }

        url = "https://places.googleapis.com/v1/places:searchNearby"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.location,places.types,places.primaryType,places.formattedAddress",
            "X-Goog-Maps-Solution-ID": GMP_SOLUTION_ID
        }

        payload: Dict[str, Any] = {
            "maxResultCount": min(max(1, max_results), 20),
            "locationRestriction": {
                "circle": {
                    "center": {
                        "latitude": latitude,
                        "longitude": longitude
                    },
                    "radius": float(radius_meters)
                }
            }
        }

        if included_types:
            payload["includedTypes"] = included_types

        async with httpx.AsyncClient(timeout=10.0) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    places = data.get("places", [])
                    return {
                        "success": True,
                        "center": {"latitude": latitude, "longitude": longitude},
                        "radius_meters": radius_meters,
                        "count": len(places),
                        "places": places
                    }
                else:
                    return {
                        "success": False,
                        "status_code": response.status_code,
                        "error": response.text,
                        "places": []
                    }
            except Exception as e:
                logger.error(f"Places API Nearby Search error: {e}")
                return {
                    "success": False,
                    "error": str(e),
                    "places": []
                }

    async def compute_predictive_route(
        self,
        origin_lat: float,
        origin_lng: float,
        dest_lat: float,
        dest_lng: float,
        departure_time_iso: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Calculates real-time navigation polylines with predictive traffic using Routes API v2.
        Supports departure windows for historical/predictive transit duration calculations.
        """
        if not self.api_key:
            return {
                "success": False,
                "error": "Google Maps API key is not configured. Set GOOGLE_MAPS_API_KEY in environment.",
                "routes": []
            }

        url = "https://routes.googleapis.com/directions/v2:computeRoutes"
        headers = {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": self.api_key,
            "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline,routes.description,routes.travelAdvisory",
            "X-Goog-Maps-Solution-ID": GMP_SOLUTION_ID
        }

        payload: Dict[str, Any] = {
            "origin": {
                "location": {
                    "latLng": {
                        "latitude": origin_lat,
                        "longitude": origin_lng
                    }
                }
            },
            "destination": {
                "location": {
                    "latLng": {
                        "latitude": dest_lat,
                        "longitude": dest_lng
                    }
                }
            },
            "travelMode": "DRIVE",
            "routingPreference": "TRAFFIC_AWARE_OPTIMAL",
            "computeAlternativeRoutes": False,
            "routeModifiers": {
                "avoidTolls": False,
                "avoidHighways": False,
                "avoidFerries": True
            }
        }

        if departure_time_iso:
            payload["departureTime"] = departure_time_iso

        async with httpx.AsyncClient(timeout=12.0) as client:
            try:
                response = await client.post(url, json=payload, headers=headers)
                if response.status_code == 200:
                    data = response.json()
                    routes = data.get("routes", [])
                    return {
                        "success": True,
                        "count": len(routes),
                        "routes": routes
                    }
                else:
                    return {
                        "success": False,
                        "status_code": response.status_code,
                        "error": response.text,
                        "routes": []
                    }
            except Exception as e:
                logger.error(f"Routes API v2 computeRoutes error: {e}")
                return {
                    "success": False,
                    "error": str(e),
                    "routes": []
                }


spatial_service = SpatialIntelligenceService()
