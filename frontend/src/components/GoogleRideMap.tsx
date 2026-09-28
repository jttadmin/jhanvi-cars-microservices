import { useEffect, useRef, useState } from 'react';
import { loadGoogleMaps, onMapsAuthFailure } from '../api/googleMaps';
import type { LocationPoint, RouteResult } from '../types';

interface GoogleRideMapProps {
  pickup: LocationPoint | null;
  destination: LocationPoint | null;
  route: RouteResult | null;
}

const DEFAULT_CENTER = { lat: 12.9716, lng: 77.5946 }; // fallback until a pickup point is set

const MAP_STYLE: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#f3efe4' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#5b6070' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#fbf9f4' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#ffffff' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#e7e1d2' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#ffe6ab' }] },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#c9e4dc' }] },
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
          scale: 7,
          fillColor: '#1f6f5c',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#fff',
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
          path: google.maps.SymbolPath.CIRCLE,
          scale: 7,
          fillColor: '#14171f',
          fillOpacity: 1,
          strokeWeight: 2,
          strokeColor: '#fff',
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
      strokeColor: '#ffc53d',
      strokeWeight: 5,
      strokeOpacity: 0.95,
    });

    const bounds = new google.maps.LatLngBounds();
    path.forEach((point) => bounds.extend(point));
    mapRef.current.fitBounds(bounds, 60);
  }, [route]);

  return (
    <div className="ride-map-wrap">
      <div ref={containerRef} className="ride-map-canvas" />
      {!ready && !mapError && <div className="map-overlay-text">Loading map…</div>}
      {mapError && <div className="map-overlay-text error-text">{mapError}</div>}
    </div>
  );
}
