import type { RideType } from './fare';

/*
 * Top-down vehicle markers for live tracking, drawn pointing north and
 * rotated to the direction of travel. Original artwork.
 */

const SIZE = 56;

// Pointing up in a 56x56 box, centred on (28, 28).
const CAR = `
  <rect x="19" y="10" width="18" height="36" rx="7" fill="#111"/>
  <rect x="17" y="16" width="3" height="7" rx="1.5" fill="#111"/>
  <rect x="36" y="16" width="3" height="7" rx="1.5" fill="#111"/>
  <rect x="17" y="33" width="3" height="7" rx="1.5" fill="#111"/>
  <rect x="36" y="33" width="3" height="7" rx="1.5" fill="#111"/>
  <path d="M21.5 19 Q28 15.5 34.5 19 L33.5 24 Q28 22.5 22.5 24 Z" fill="#9fb6c8"/>
  <path d="M22.5 37 Q28 38.5 33.5 37 L34 41 Q28 43 22 41 Z" fill="#9fb6c8"/>
  <rect x="22.5" y="25.5" width="11" height="10" rx="2" fill="#2a2a2a"/>
  <rect x="21" y="10.6" width="4" height="2" rx="1" fill="#ffe9a8"/>
  <rect x="31" y="10.6" width="4" height="2" rx="1" fill="#ffe9a8"/>
`;

const AUTO = `
  <rect x="26.5" y="8" width="3" height="6" rx="1.5" fill="#111"/>
  <rect x="15.5" y="34" width="3.5" height="8" rx="1.5" fill="#111"/>
  <rect x="37" y="34" width="3.5" height="8" rx="1.5" fill="#111"/>
  <path d="M23 13 Q28 9 33 13 L38 33 Q38 44 28 45 Q18 44 18 33 Z" fill="#1f8a3a"/>
  <path d="M21.5 22 Q28 18.5 34.5 22 L37 33.5 Q37 42 28 43 Q19 42 19 33.5 Z" fill="#f2c21b"/>
  <path d="M24 15 Q28 12.5 32 15 L33 19.5 Q28 17.5 23 19.5 Z" fill="#9fb6c8"/>
  <rect x="21" y="27" width="14" height="1.6" rx="0.8" fill="#d4a30e"/>
`;

function svg(body: string, headingDeg: number): string {
  const markup = `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
  <circle cx="28" cy="28" r="24" fill="#fff" fill-opacity="0.92" stroke="#000" stroke-opacity="0.12"/>
  <g transform="rotate(${Math.round(headingDeg)} 28 28)">${body}</g>
</svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(markup)}`;
}

export function vehicleMarkerIcon(
  vehicleType: RideType | null | undefined,
  headingDeg = 0,
): google.maps.Icon {
  return {
    url: svg(vehicleType === 'AUTO' ? AUTO : CAR, headingDeg),
    scaledSize: new google.maps.Size(SIZE, SIZE),
    anchor: new google.maps.Point(SIZE / 2, SIZE / 2),
  };
}

/** Compass bearing in degrees from a to b. */
export function bearing(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(b.lng - a.lng)) * Math.cos(toRad(b.lat));
  const x =
    Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) -
    Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(toRad(b.lng - a.lng));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}
