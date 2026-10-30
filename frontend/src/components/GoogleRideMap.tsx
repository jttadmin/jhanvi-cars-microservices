import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, onMapsAuthFailure } from '../api/googleMaps';
import type { LocationPoint, RouteResult } from '../types';

interface GoogleRideMapProps {
  pickup: LocationPoint | null;
  destination: LocationPoint | null;
  route: RouteResult | null;
}

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

export default function GoogleRideMap({ pickup, destination, route }: GoogleRideMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const destMarkerRef = useRef<google.maps.Marker | null>(null);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);

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

  return (
    <div className="ride-map-wrap">
      <div ref={containerRef} className="ride-map-canvas" />
      {!ready && !mapError && <div className="map-overlay-text">Loading map…</div>}
      {mapError && <div className="map-overlay-text error-text">{mapError}</div>}
    </div>
  );
}
