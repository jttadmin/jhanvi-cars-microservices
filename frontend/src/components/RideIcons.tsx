import type { RideType } from '../utils/fare';

const vehicleImages: Record<RideType, string> = {
  AUTO: '/vehicles/auto-photo3d.webp',
  ECONOMY: '/vehicles/economy-photo3d.webp',
  COMFORT: '/vehicles/comfort-photo3d.webp',
  COMFORT_PLUS: '/vehicles/comfort-plus-photo3d.webp',
};

export function RideIcon({ type }: { type: RideType }) {
  return (
    <img
      className="ride-vehicle-image"
      src={vehicleImages[type]}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
