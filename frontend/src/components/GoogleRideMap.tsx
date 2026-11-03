import { useEffect, useMemo, useRef, useState } from 'react';
import { loadGoogleMaps, onMapsAuthFailure } from '../api/googleMaps';
import type { LocationPoint, RouteResult } from '../types';
import type { RideType } from '../utils/fare';
import { vehicleMarkerIcon } from '../utils/mapIcons';
import { bearing, distanceM, snapToPath } from '../utils/geo';

export interface LiveDriver {
  lat: number;
  lng: number;
  /** Booked category: an auto icon for AUTO, a car for the rest. */
  vehicleType: RideType | null;
}

interface GoogleRideMapProps {
  pickup: LocationPoint | null;
  destination: LocationPoint | null;
  route: RouteResult | null;
  /** The assigned driver's live position during a ride. */
  driver?: LiveDriver | null;
  /** Encoded road path from the driver to the pickup or drop-off. */
  driverPath?: string | null;
}

const GLIDE_MS = 1200;

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }; // fallback until a pickup point is set

// Muted grayscale map so the route and markers stand out (Uber-style).
const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f2f2f2' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#6b6b6b' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#f8f8f8' }] },
  { featureType: 'administrative.land_parcel', stylers: [{ visibility: 'off' }] },
  { featureType: 'landscape.man_made', elementType: 'geometry', stylers: [{ color: '#ebebeb' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ visibility: 'on' }, { color: '#dfeedd' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e3e3e3' }] },
  { featureType: 'road.arterial', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#dadada' }] },
  { featureType: 'road.highway', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road.local', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9d6e2' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
];

export default function GoogleRideMap({ pickup, destination, route, driver = null, driverPath = null }: GoogleRideMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const driverPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const headingRef = useRef(0);
  const glideRef = useRef<number | null>(null);
  const zoomedToDriverRef = useRef(false);
  const tripLineRef = useRef<google.maps.Polyline | null>(null);
  const fittedTripRef = useRef<string | null>(null);

  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

  const isTracking = driver != null;

  // Init map once.
  useEffect(() => {
    let cancelled = false;
    onMapsAuthFailure(() => setMapError('Google Maps API key is invalid or restricted.'));

    loadGoogleMaps()
      .then((googleNs) => {
        if (cancelled || !containerRef.current) return;
        mapRef.current = new googleNs.maps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 13,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: googleNs.maps.ControlPosition.RIGHT_BOTTOM },
          clickableIcons: false,
          gestureHandling: 'greedy',
          styles: MAP_STYLE,
        });
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setMapError('Could not load Google Maps. Check your connection.');
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Pickup marker.
  useEffect(() => {
    if (!mapRef.current) return;
    if (!pickup) {
      pickupMarkerRef.current?.setMap(null);
      pickupMarkerRef.current = null;
      return;
    }
    if (!pickupMarkerRef.current) {
      pickupMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: '#ffffff',
          fillOpacity: 1,
          strokeWeight: 5,
          strokeColor: '#000000',
        },
      });
    }
    pickupMarkerRef.current.setPosition({ lat: pickup.lat, lng: pickup.lng });
    // While a vehicle is being tracked, the tracking camera decides the view.
    if (!destination && !isTracking) mapRef.current.panTo({ lat: pickup.lat, lng: pickup.lng });
  }, [pickup, destination, isTracking]);

  // Destination marker.
  useEffect(() => {
    if (!mapRef.current) return;
    if (!destination) {
      destMarkerRef.current?.setMap(null);
      destMarkerRef.current = null;
      return;
    }
    if (!destMarkerRef.current) {
      destMarkerRef.current = new google.maps.Marker({
        map: mapRef.current,
        icon: {
          path: 'M -7 -7 L 7 -7 L 7 7 L -7 7 Z',
          scale: 1,
          fillColor: '#000000',
          fillOpacity: 1,
          strokeWeight: 3,
          strokeColor: '#ffffff',
        },
      });
    }
    destMarkerRef.current.setPosition({ lat: destination.lat, lng: destination.lng });
  }, [destination]);

  // Real route polyline from the Routes API response, fit to bounds.
  useEffect(() => {
    if (!mapRef.current) return;
    routeLineRef.current?.setMap(null);
    routeLineRef.current = null;

    if (!route?.polyline) return;

    const path = google.maps.geometry.encoding.decodePath(route.polyline);

    routeLineRef.current = new google.maps.Polyline({
      path,
      map: mapRef.current,
      strokeColor: '#000000',
      strokeWeight: 5,
      strokeOpacity: 1,
    });

    const bounds = new google.maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    const desktop = window.matchMedia('(min-width: 768px)').matches;
    mapRef.current.fitBounds(
      bounds,
      desktop
        ? { top: 80, right: 80, bottom: 80, left: 480 } // keep clear of the booking panel
        : { top: 40, right: 40, bottom: 40, left: 40 },
    );
  }, [route]);

  // Live driver marker, Uber-style:
  // - snapped onto the road line to the pickup/drop-off and facing along it,
  // - glides between GPS fixes,
  // - the road line behind the vehicle is trimmed away,
  // - the camera fits the whole trip once, then only follows the vehicle
  //   when it is about to leave the screen.
  const driverLat = driver?.lat;
  const driverLng = driver?.lng;
  const driverType = driver?.vehicleType ?? null;

  const tripPath = useMemo(
    () => (ready && driverPath ? google.maps.geometry.encoding.decodePath(driverPath).map((p) => ({ lat: p.lat(), lng: p.lng() })) : []),
    [ready, driverPath],
  );

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    if (driverLat === undefined || driverLng === undefined) {
      if (glideRef.current) cancelAnimationFrame(glideRef.current);
      driverMarkerRef.current?.setMap(null);
      driverMarkerRef.current = null;
      tripLineRef.current?.setMap(null);
      tripLineRef.current = null;
      driverPosRef.current = null;
      zoomedToDriverRef.current = false;
      fittedTripRef.current = null;
      return;
    }

    const raw = { lat: driverLat, lng: driverLng };
    const snapped = tripPath.length > 1 ? snapToPath(raw, tripPath) : null;
    const target = snapped ? snapped.point : raw;
    const from = driverPosRef.current;

    if (snapped) {
      headingRef.current = snapped.heading;
    } else if (from && distanceM(from, target) > 5) {
      // Off the planned road: face the way it's actually moving, ignoring jitter.
      headingRef.current = bearing(from, target);
    }

    if (!driverMarkerRef.current) {
      driverMarkerRef.current = new google.maps.Marker({
        map,
        position: target,
        zIndex: 1000,
        optimized: false,
        title: driverType === 'AUTO' ? 'Your auto' : 'Your car',
      });
    }
    driverMarkerRef.current.setIcon(vehicleMarkerIcon(driverType, headingRef.current));

    // Road line still ahead of the vehicle.
    if (tripPath.length > 1) {
      const ahead = snapped ? [snapped.point, ...tripPath.slice(snapped.index + 1)] : tripPath;
      if (!tripLineRef.current) {
        tripLineRef.current = new google.maps.Polyline({
          map,
          strokeColor: '#000000',
          strokeWeight: 5,
          strokeOpacity: 0.9,
          zIndex: 10,
        });
      }
      tripLineRef.current.setPath(ahead);
    } else {
      tripLineRef.current?.setMap(null);
      tripLineRef.current = null;
    }

    // Camera: leave it alone while the customer plans a new trip.
    if (!route) {
      if (tripPath.length > 1 && fittedTripRef.current !== driverPath) {
        const bounds = new google.maps.LatLngBounds();
        tripPath.forEach((pt) => bounds.extend(pt));
        bounds.extend(target);
        const desktop = window.matchMedia('(min-width: 768px)').matches;
        map.fitBounds(
          bounds,
          desktop
            ? { top: 100, right: 80, bottom: 80, left: 480 }
            : { top: 90, right: 40, bottom: 320, left: 40 },
        );
        fittedTripRef.current = driverPath ?? null;
        zoomedToDriverRef.current = true;
      } else if (tripPath.length < 2 && !zoomedToDriverRef.current) {
        map.setZoom(16);
        map.panTo(target);
        zoomedToDriverRef.current = true;
      } else {
        const view = map.getBounds();
        if (view && !view.contains(target)) map.panTo(target);
      }
    }

    if (glideRef.current) cancelAnimationFrame(glideRef.current);

    if (!from) {
      driverMarkerRef.current.setPosition(target);
      driverPosRef.current = target;
      return;
    }

    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / GLIDE_MS);
      const ease = t * (2 - t);
      const pos = {
        lat: from.lat + (target.lat - from.lat) * ease,
        lng: from.lng + (target.lng - from.lng) * ease,
      };
      driverMarkerRef.current?.setPosition(pos);
      driverPosRef.current = pos;
      if (t < 1) glideRef.current = requestAnimationFrame(step);
    };
    glideRef.current = requestAnimationFrame(step);
  }, [ready, driverLat, driverLng, driverType, route, tripPath, driverPath]);

  useEffect(
    () => () => {
      if (glideRef.current) cancelAnimationFrame(glideRef.current);
      tripLineRef.current?.setMap(null);
    },
    [],
  );

  return (
    <div className="ride-map-wrap">
      <div ref={containerRef} className="ride-map-canvas" />
      {!ready && !mapError && <div className="map-overlay-text">Loading map…</div>}
      {mapError && <div className="map-overlay-text error-text">{mapError}</div>}
    </div>
  );
}
