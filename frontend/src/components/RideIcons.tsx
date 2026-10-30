import type { RideType } from '../utils/fare';

const vehicleImages: Record<RideType, string> = {
  AUTO: '/vehicles/auto.svg',
  ECONOMY: '/vehicles/economy.svg',
  COMFORT: '/vehicles/comfort.svg',
  COMFORT_PLUS: '/vehicles/comfort-plus.svg',
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
