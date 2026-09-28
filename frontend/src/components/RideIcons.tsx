import type { RideType } from '../utils/fare';

const vehicleImages: Record<RideType, string> = {
  AUTO: '/vehicles/auto.webp',
  ECONOMY: '/vehicles/economy.webp',
  COMFORT: '/vehicles/comfort.webp',
  COMFORT_PLUS: '/vehicles/comfort-plus.webp',
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
