import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, onMapsAuthFailure } from '../api/googleMaps';
import type { LocationPoint, RouteResult } from '../types';
import type { RideType } from '../utils/fare';
import { bearing, vehicleMarkerIcon } from '../utils/mapIcons';

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

export default function GoogleRideMap({ pickup, destination, route, driver = null }: GoogleRideMapProps) {
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

  const [ready, setReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);

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
    if (!destination) mapRef.current.panTo({ lat: pickup.lat, lng: pickup.lng });
  }, [pickup, destination]);

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

  // Live driver marker: glides between GPS fixes, faces where it's heading,
  // and the map follows it while no new trip is being planned.
  const driverLat = driver?.lat;
  const driverLng = driver?.lng;
  const driverType = driver?.vehicleType ?? null;

  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;

    if (driverLat === undefined || driverLng === undefined) {
      if (glideRef.current) cancelAnimationFrame(glideRef.current);
      driverMarkerRef.current?.setMap(null);
      driverMarkerRef.current = null;
      driverPosRef.current = null;
      zoomedToDriverRef.current = false;
      return;
    }

    const target = { lat: driverLat, lng: driverLng };
    const from = driverPosRef.current;

    if (from) {
      // Only turn for real movement (> ~5 m), not GPS jitter.
      const moved = Math.hypot(target.lat - from.lat, target.lng - from.lng);
      if (moved > 0.00005) headingRef.current = bearing(from, target);
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

    const follow = !route;
    if (follow) {
      if (!zoomedToDriverRef.current) {
        map.setZoom(16);
        zoomedToDriverRef.current = true;
      }
      map.panTo(target);
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
  }, [ready, driverLat, driverLng, driverType, route]);

  useEffect(
    () => () => {
      if (glideRef.current) cancelAnimationFrame(glideRef.current);
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
