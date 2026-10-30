import type { RideType } from '../utils/fare';

const vehicleImages: Record<RideType, string> = {
  AUTO: '/vehicles/auto-podium.webp',
  ECONOMY: '/vehicles/economy-podium.webp',
  COMFORT: '/vehicles/comfort-podium.webp',
  COMFORT_PLUS: '/vehicles/comfort-plus-podium.webp',
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
