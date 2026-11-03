export interface LatLng {
  lat: number;
  lng: number;
}

const EARTH_M = 6371000;
const rad = (d: number) => (d * Math.PI) / 180;

/** Distance in metres. */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_M * Math.asin(Math.sqrt(h));
}

/** Compass bearing in degrees from a to b. */
export function bearing(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export interface Snapped {
  point: LatLng;
  /** Direction of the road at that point. */
  heading: number;
  /** How far the raw GPS point was from the road, in metres. */
  offsetM: number;
  /** Index of the path segment the point snapped onto. */
  index: number;
}

/*
 * Snap a GPS fix onto the nearest point of a road path (the route line
 * from the Routes API), like ride-hailing apps do, so the vehicle stays on
 * the road instead of drifting through buildings. Returns null when the
 * fix is further than maxOffsetM from the path (driver took another road),
 * in which case the raw position should be shown.
 */
export function snapToPath(
  p: LatLng,
  path: LatLng[],
  maxOffsetM = 40,
): Snapped | null {
  if (path.length < 2) return null;

  // Local flat projection in metres around the point; accurate at city scale.
  const kx = EARTH_M * Math.cos(rad(p.lat)) * (Math.PI / 180);
  const ky = EARTH_M * (Math.PI / 180);
  const toXY = (q: LatLng) => ({ x: (q.lng - p.lng) * kx, y: (q.lat - p.lat) * ky });

  let best: Snapped | null = null;
  let bestD = Infinity;

  for (let i = 0; i < path.length - 1; i++) {
    const a = toXY(path[i]);
    const b = toXY(path[i + 1]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / len2));
    const cx = a.x + t * dx;
    const cy = a.y + t * dy;
    const d = Math.hypot(cx, cy);

    if (d < bestD) {
      bestD = d;
      best = {
        point: { lat: p.lat + cy / ky, lng: p.lng + cx / kx },
        heading: len2 === 0 ? 0 : bearing(path[i], path[i + 1]),
        offsetM: d,
        index: i,
      };
    }
  }

  return best && best.offsetM <= maxOffsetM ? best : null;
}
