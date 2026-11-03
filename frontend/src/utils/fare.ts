import type { RouteResult } from '../types';

export type RideType = 'AUTO' | 'ECONOMY' | 'COMFORT' | 'COMFORT_PLUS';

export interface FareRule {
  vehicleType: RideType;
  minFare: number;
  minKm: number;
  perKm: number;
  nightStart: string;
  nightEnd: string;
  nightSurchargePercent: number;
  gstPercent: number;
  source?: string | null;
  updatedBy?: string | null;
  updatedAt?: string;
}

/*
 * Government of Karnataka rates, used only until the live rates load.
 * The admin-managed rates from the server always win, and the server
 * calculates the fare that is actually charged.
 */
export const DEFAULT_FARE_RULES: Record<RideType, FareRule> = {
  AUTO: { vehicleType: 'AUTO', minFare: 36, minKm: 2, perKm: 18, nightStart: '22:00', nightEnd: '05:00', nightSurchargePercent: 50, gstPercent: 0 },
  ECONOMY: { vehicleType: 'ECONOMY', minFare: 100, minKm: 4, perKm: 24, nightStart: '00:00', nightEnd: '06:00', nightSurchargePercent: 10, gstPercent: 5 },
  COMFORT: { vehicleType: 'COMFORT', minFare: 115, minKm: 4, perKm: 28, nightStart: '00:00', nightEnd: '06:00', nightSurchargePercent: 10, gstPercent: 5 },
  COMFORT_PLUS: { vehicleType: 'COMFORT_PLUS', minFare: 130, minKm: 4, perKm: 32, nightStart: '00:00', nightEnd: '06:00', nightSurchargePercent: 10, gstPercent: 5 },
};

const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

function indiaMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return get('hour') * 60 + get('minute');
}

export function isNightTime(rule: FareRule, at: Date = new Date()): boolean {
  const start = toMinutes(rule.nightStart);
  const end = toMinutes(rule.nightEnd);
  if (start === end) return false;
  const now = indiaMinutes(at);
  return start < end ? now >= start && now < end : now >= start || now < end;
}

/** Same formula as booking-service's fareCalculator. */
export function estimateFare(
  route: Pick<RouteResult, 'distanceKm'>,
  rideType: RideType = 'ECONOMY',
  rules: Partial<Record<RideType, FareRule>> = DEFAULT_FARE_RULES,
  at: Date = new Date(),
): number {
  const rule = rules[rideType] ?? DEFAULT_FARE_RULES[rideType];
  const km = Math.max(0, route.distanceKm);
  const base = rule.minFare + Math.max(0, km - rule.minKm) * rule.perKm;
  const night = isNightTime(rule, at) ? base * (rule.nightSurchargePercent / 100) : 0;
  const beforeTax = base + night;
  return Math.round(beforeTax + beforeTax * (rule.gstPercent / 100));
}

export function rulesByType(list: FareRule[]): Record<RideType, FareRule> {
  const map = { ...DEFAULT_FARE_RULES };
  for (const rule of list) map[rule.vehicleType] = rule;
  return map;
}
