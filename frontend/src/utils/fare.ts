import type { RouteResult } from '../types';

export type RideType = 'AUTO' | 'ECONOMY' | 'COMFORT' | 'COMFORT_PLUS';

const FARE_CONFIG: Record<RideType, {
  baseFare: number;
  perKm: number;
  perMinute: number;
  minimumFare: number;
}> = {
  AUTO: {
    baseFare: 40,
    perKm: 10,
    perMinute: 1,
    minimumFare: 80,
  },
  ECONOMY: {
    baseFare: 50,
    perKm: 12,
    perMinute: 1.5,
    minimumFare: 100,
  },
  COMFORT: {
    baseFare: 70,
    perKm: 15,
    perMinute: 2,
    minimumFare: 130,
  },
  COMFORT_PLUS: {
    baseFare: 100,
    perKm: 18,
    perMinute: 2.5,
    minimumFare: 170,
  },
};

export function estimateFare(
  route: RouteResult,
  rideType: RideType = 'ECONOMY',
): number {
  const config = FARE_CONFIG[rideType];

  const calculated =
    config.baseFare +
    route.distanceKm * config.perKm +
    route.durationMin * config.perMinute;

  return Math.max(
    config.minimumFare,
    Math.round(calculated),
  );
}
