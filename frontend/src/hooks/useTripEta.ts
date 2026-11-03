import { useEffect, useRef, useState } from 'react';
import { computeRoute, geocodeAddress } from '../api/googleMaps';
import type { RideTracking } from '../api/bookings';
import type { Booking } from '../types';
import { distanceM, type LatLng } from '../utils/geo';

export interface TripEta {
  /** Where the vehicle is heading: the pickup before the ride, the drop-off during it. */
  phase: 'TO_PICKUP' | 'TO_DROPOFF';
  target: LatLng;
  durationMin: number;
  distanceKm: number;
  /** Encoded road path from the vehicle to the target. */
  polyline: string;
}

// Re-route when the vehicle has moved this far, or this long has passed
// (traffic changes), so the Routes API is called sparingly.
const REROUTE_AFTER_M = 150;
const REROUTE_AFTER_MS = 45_000;

/*
 * Live ETA and route line from the vehicle to the pickup or drop-off,
 * like ride-hailing apps show ("Arriving in 4 min").
 */
export function useTripEta(
  tracking: RideTracking | null,
  ride: Booking | undefined,
): TripEta | null {
  const [eta, setEta] = useState<(TripEta & { key: string }) | null>(null);
  const [target, setTarget] = useState<{ key: string; point: LatLng } | null>(null);
  const lastRouted = useRef<{ key: string; from: LatLng; at: number } | null>(null);
  const inFlight = useRef(false);

  const phase: TripEta['phase'] | null =
    tracking?.status === 'CONFIRMED' ? 'TO_PICKUP' : tracking?.status === 'ONGOING' ? 'TO_DROPOFF' : null;
  const knownTarget = phase === 'TO_PICKUP' ? tracking?.pickup : phase === 'TO_DROPOFF' ? tracking?.dropoff : null;
  const address = phase === 'TO_PICKUP' ? ride?.pickupLocation : phase === 'TO_DROPOFF' ? ride?.dropoffLocation : undefined;
  const targetKey = phase && tracking ? `${tracking.bookingId}:${phase}` : null;

  // Resolve the target point: saved coordinates, or geocode the address for older bookings.
  useEffect(() => {
    if (!targetKey) return;
    let active = true;
    const resolve = knownTarget
      ? Promise.resolve<LatLng | null>(knownTarget)
      : address
        ? geocodeAddress(address)
        : Promise.resolve(null);
    resolve.then((point) => {
      if (active) setTarget(point ? { key: targetKey, point } : null);
    });
    return () => {
      active = false;
    };
  }, [targetKey, knownTarget?.lat, knownTarget?.lng, address]); // eslint-disable-line react-hooks/exhaustive-deps

  const from = tracking?.location ? { lat: tracking.location.lat, lng: tracking.location.lng } : null;

  useEffect(() => {
    if (!phase || !from || !target || target.key !== targetKey || inFlight.current) return;

    const last = lastRouted.current;
    const due =
      !last ||
      last.key !== targetKey ||
      distanceM(last.from, from) > REROUTE_AFTER_M ||
      Date.now() - last.at > REROUTE_AFTER_MS;
    if (!due) return;

    const key = targetKey!;
    inFlight.current = true;
    lastRouted.current = { key, from, at: Date.now() };

    computeRoute(
      { address: '', lat: from.lat, lng: from.lng },
      { address: '', lat: target.point.lat, lng: target.point.lng },
    )
      .then((route) =>
        setEta({
          key,
          phase,
          target: target.point,
          durationMin: route.durationMin,
          distanceKm: route.distanceKm,
          polyline: route.polyline,
        }),
      )
      .catch(() => {
        // Try again on the next position update.
        lastRouted.current = null;
      })
      .finally(() => {
        inFlight.current = false;
      });
  }, [phase, targetKey, target, from?.lat, from?.lng]); // eslint-disable-line react-hooks/exhaustive-deps

  return eta && eta.key === targetKey ? eta : null;
}
