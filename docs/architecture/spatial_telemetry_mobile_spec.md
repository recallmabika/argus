# ARGUS Mobile Spatial Telemetry & Google Maps Architecture Specification

This specification provides the production architectural blueprint and reference implementations for native mobile hardware telemetry listeners (Android / iOS), Google Maps SDK interactive 3D vector maps, Indoor Maps event delegates, and the ARGUS Spatial Intelligence backend bridge.

---

## 1. Android Architecture (Kotlin)

### Dependencies (`build.gradle.kts`)
```kotlin
dependencies {
    // Google Play Services Location (Fused Location Provider)
    implementation("com.google.android.gms:play-services-location:21.3.0")
    // Google Maps SDK for Android (Vector Maps & Indoor)
    implementation("com.google.android.gms:play-services-maps:19.0.0")
    // OkHttp & Kotlin Coroutines for ARGUS API Bridge
    implementation("com.squareup.okhttp3:okhttp:4.12.0")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
}
```

### Telemetry & Motion Tracking Engine (`MotionTelemetryManager.kt`)
```kotlin
package com.argus.forensics.telemetry

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import com.google.android.gms.location.*
import kotlinx.coroutines.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

class MotionTelemetryManager(
    private val context: Context,
    private val deviceId: String,
    private val backendUrl: String,
    private val targetLat: Double? = null,
    private val targetLng: Double? = null
) {
    private val fusedLocationClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(context)
    private val httpClient = OkHttpClient()
    private val scope = CoroutineScope(Dispatchers.IO + SupervisorJob())

    // Motion State Tracking
    var currentSpeedMps: Float = 0.0f
        private set
    var currentSpeedMph: Float = 0.0f
        private set
    var isMoving: Boolean = false
        private set

    companion object {
        const val MPS_TO_MPH = 2.23694f
        const val STATIONARY_SPEED_THRESHOLD_MPH = 2.5f
    }

    private val locationCallback = object : LocationCallback() {
        override fun onLocationResult(result: LocationResult) {
            val location = result.lastLocation ?: return
            processHardwareLocation(location)
        }
    }

    @SuppressLint("MissingPermission")
    fun startMotionTracking() {
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY, 1000L // 1.0 second intervals
        ).apply {
            setMinUpdateIntervalMillis(500L)
            setMinUpdateDistanceMeters(0.5f)
        }.build()

        fusedLocationClient.requestLocationUpdates(
            locationRequest,
            locationCallback,
            Looper.getMainLooper()
        )
    }

    fun stopMotionTracking() {
        fusedLocationClient.removeLocationUpdates(locationCallback)
        scope.cancel()
    }

    private fun processHardwareLocation(location: Location) {
        // 1. Extract hardware speed (meters/second)
        currentSpeedMps = if (location.hasSpeed()) location.speed else 0.0f

        // 2. Convert meters/second to MPH (speed * 2.23694)
        currentSpeedMph = currentSpeedMps * MPS_TO_MPH

        // 3. Evaluate Moving vs Stationary threshold
        isMoving = currentSpeedMph >= STATIONARY_SPEED_THRESHOLD_MPH

        // 4. Dispatch telemetry payload to ARGUS Spatial Proxy
        scope.launch {
            dispatchTelemetryPayload(location, currentSpeedMps, currentSpeedMph)
        }
    }

    private fun dispatchTelemetryPayload(location: Location, speedMps: Float, speedMph: Float) {
        try {
            val payload = JSONObject().apply {
                put("device_id", deviceId)
                put("latitude", location.latitude)
                put("longitude", location.longitude)
                put("speed_mps", speedMps)
                if (location.hasAltitude()) put("altitude", location.altitude)
                if (location.hasAccuracy()) put("accuracy", location.accuracy)
                if (location.hasBearing()) put("heading", location.bearing)
                if (targetLat != null) put("target_lat", targetLat)
                if (targetLng != null) put("target_lng", targetLng)
            }

            val mediaType = "application/json; charset=utf-8".toMediaType()
            val body = payload.toString().toRequestBody(mediaType)
            val request = Request.Builder()
                .url("$backendUrl/api/v1/spatial/telemetry/motion")
                .post(body)
                .build()

            httpClient.newCall(request).execute().use { response ->
                if (response.isSuccessful) {
                    val respJson = JSONObject(response.body?.string() ?: "{}")
                    val analysis = respJson.optJSONObject("motion_analysis")
                    val state = analysis?.optString("state")
                    if (state == "TARGET_PROXIMITY_LOCKED") {
                        onTargetProximityLocked(location)
                    }
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    private fun onTargetProximityLocked(location: Location) {
        // Trigger contextual app states (e.g. switch to Indoor floor plan or Forensic Triage Deck)
    }
}
```

### Interactive 3D Vector Map & Indoor Maps Controller (`ArgusMapFragment.kt`)
```kotlin
package com.argus.forensics.ui

import android.os.Bundle
import android.view.View
import androidx.fragment.app.Fragment
import com.google.android.gms.maps.*
import com.google.android.gms.maps.model.*

class ArgusMapFragment : Fragment(), OnMapReadyCallback, GoogleMap.OnIndoorStateChangeListener {
    private lateinit var googleMap: GoogleMap

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        val mapFragment = childFragmentManager.findFragmentById(R.id.map) as? SupportMapFragment
        mapFragment?.getMapAsync(this)
    }

    override fun onMapReady(map: GoogleMap) {
        googleMap = map

        // 1. Configure Interactive Vector Map with 3D Building Outlines & POI Layers
        googleMap.mapType = GoogleMap.MAP_TYPE_NORMAL
        googleMap.isBuildingsEnabled = true // Renders extruded 3D building outlines when tilted
        googleMap.isIndoorEnabled = true    // Enables automatic floor-to-floor indoor navigation

        // 2. Set Camera Tilt to reveal 3D building geometry
        val targetPosition = LatLng(-17.824858, 31.053028)
        val cameraPosition = CameraPosition.Builder()
            .target(targetPosition)
            .zoom(18.5f)
            .tilt(45.0f) // 45-degree perspective for 3D extrusion
            .bearing(30.0f)
            .build()
        googleMap.animateCamera(CameraUpdateFactory.newCameraPosition(cameraPosition))

        // 3. Register Indoor Maps Floor-to-Floor State Change Listener
        googleMap.setOnIndoorStateChangeListener(this)
    }

    // GoogleMap.OnIndoorStateChangeListener Callbacks
    override fun onIndoorBuildingFocused() {
        val building: IndoorBuilding? = googleMap.focusedBuilding
        if (building != null) {
            val activeLevelIndex = building.activeLevelIndex
            val levels: List<IndoorLevel> = building.levels
            val currentLevelName = levels[activeLevelIndex].name
            // Notify ARGUS UI of focused structure
        }
    }

    override fun onIndoorLevelActivated(building: IndoorBuilding) {
        val currentLevel = building.levels[building.activeLevelIndex]
        // Automatic floor-to-floor switching (e.g., Level 1 -> Level 2 inside airport/mall)
        println("Active Indoor Floor Level: ${currentLevel.name} (${currentLevel.shortName})")
    }
}
```

---

## 2. iOS Architecture (Swift)

### Telemetry & Motion Tracking Engine (`MotionTelemetryManager.swift`)
```swift
import Foundation
import CoreLocation

protocol MotionTelemetryDelegate: AnyObject {
    func didUpdateMotionState(speedMph: Double, isMoving: Bool, state: String)
}

final class MotionTelemetryManager: NSObject, CLLocationManagerDelegate {
    private let locationManager = CLLocationManager()
    private let deviceId: String
    private let backendUrl: URL
    private let targetCoord: CLLocationCoordinate2D?
    weak var delegate: MotionTelemetryDelegate?

    private let mpsToMph: Double = 2.23694
    private let stationaryThresholdMph: Double = 2.5

    init(deviceId: String, backendUrl: URL, targetCoord: CLLocationCoordinate2D? = nil) {
        self.deviceId = deviceId
        self.backendUrl = backendUrl
        self.targetCoord = targetCoord
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBestForNavigation
        locationManager.distanceFilter = 1.0 // 1 meter updates
    }

    func startTracking() {
        locationManager.requestWhenInUseAuthorization()
        locationManager.startUpdatingLocation()
    }

    func stopTracking() {
        locationManager.stopUpdatingLocation()
    }

    // CLLocationManagerDelegate
    func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }

        // 1. Extract hardware speed (m/s)
        let rawSpeedMps = max(0.0, location.speed)

        // 2. Convert meters/second to MPH (speed * 2.23694)
        let speedMph = round(rawSpeedMps * mpsToMph * 100) / 100.0

        // 3. Evaluate Moving vs Stationary
        let isMoving = speedMph >= stationaryThresholdMph

        // 4. Dispatch to ARGUS backend proxy
        dispatchTelemetry(location: location, speedMps: rawSpeedMps, speedMph: speedMph)
    }

    private func dispatchTelemetry(location: CLLocation, speedMps: Double, speedMph: Double) {
        var payload: [String: Any] = [
            "device_id": deviceId,
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "speed_mps": speedMps
        ]
        if let target = targetCoord {
            payload["target_lat"] = target.latitude
            payload["target_lng"] = target.longitude
        }

        guard let jsonData = try? JSONSerialization.data(withJSONObject: payload) else { return }

        var request = URLRequest(url: backendUrl.appendingPathComponent("/api/v1/spatial/telemetry/motion"))
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = jsonData

        URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
            guard let data = data,
                  let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
                  let analysis = json["motion_analysis"] as? [String: Any],
                  let state = analysis["state"] as? String else { return }

            DispatchQueue.main.async {
                self?.delegate?.didUpdateMotionState(speedMph: speedMph, isMoving: (speedMph >= 2.5), state: state)
            }
        }.resume()
    }
}
```

### Google Maps iOS Vector Map & Indoor Display Delegate (`ArgusMapViewController.swift`)
```swift
import UIKit
import GoogleMaps

final class ArgusMapViewController: UIViewController, GMSIndoorDisplayDelegate {
    private var mapView: GMSMapView!

    override func viewDidLoad() {
        super.viewDidLoad()

        // 1. Initialize Vector Map with 3D Building Outlines & POI Layers
        let camera = GMSCameraPosition.camera(
            withLatitude: -17.824858,
            longitude: 31.053028,
            zoom: 18.5,
            bearing: 30.0,
            viewingAngle: 45.0 // Tilted perspective to render 3D building outlines
        )

        mapView = GMSMapView.map(withFrame: self.view.bounds, camera: camera)
        mapView.isBuildingsEnabled = true // Enable 3D building geometry
        mapView.isIndoorEnabled = true    // Enable built-in indoor plans
        mapView.indoorDisplay.delegate = self
        self.view.addSubview(mapView)
    }

    // GMSIndoorDisplayDelegate
    func didChangeActiveBuilding(_ building: GMSIndoorBuilding?) {
        guard let building = building else { return }
        print("Focused Indoor Structure with \(building.levels.count) floors.")
    }

    func didChangeActiveLevel(_ level: GMSIndoorLevel?) {
        guard let level = level else { return }
        print("Switched to Indoor Level: \(level.name) (\(level.shortName))")
    }
}
```

---

## 3. Web & Photorealistic 3D Tiles Hybrid Architecture

### Google Maps Platform Architecture Rule (`CF4`)
Photorealistic 3D Tiles are an OGC standard rendered using WebGL. Native mobile SDKs (`GoogleMap` / `GMSMapView`) render 2.5D building outlines, but full photorealistic textured meshes require a WebGL container.

In the ARGUS Web SOC console and hybrid mobile views, Photorealistic 3D Tiles and Advanced Markers are mounted via the Maps JavaScript API:

```javascript
// Source: Google Maps Platform Code Assist
// Mandatory Usage Attribution: gmp_git_agentskills_v1

async function initArgus3DMap() {
    // 1. Load Maps 3D Library
    const { Map3DElement } = await google.maps.importLibrary("maps3d");
    const { AdvancedMarkerElement, PinElement } = await google.maps.importLibrary("marker");

    // 2. Initialize Photorealistic 3D Element with 3D Tiles
    const map3d = new Map3DElement({
        center: { lat: -17.824858, lng: 31.053028, altitude: 250 },
        tilt: 65,
        heading: 25,
        range: 800
    });
    document.getElementById("map3dContainer").appendChild(map3d);

    // 3. Anchor Custom Animated HTML Marker to Building Coordinates
    const markerWrapper = document.createElement("div");
    markerWrapper.className = "argus-animated-marker";
    markerWrapper.innerHTML = `
        <div class="relative flex items-center justify-center">
            <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-cyan-400 opacity-75"></span>
            <span class="relative inline-flex rounded-full h-4 w-4 bg-cyan-500 border-2 border-white shadow-lg"></span>
            <div class="absolute bottom-6 px-2 py-0.5 rounded bg-slate-900/90 text-[10px] font-mono text-cyan-400 whitespace-nowrap border border-cyan-500/40 shadow-xl">
                TARGET BUILDING // STATIONARY
            </div>
        </div>
    `;

    // Attach to 3D Coordinates
    const targetMarker = new AdvancedMarkerElement({
        position: { lat: -17.824858, lng: 31.053028 },
        content: markerWrapper,
        title: "Target Structure Alpha"
    });
    map3d.append(targetMarker);
}
```
