import { FareQuote, FareRule } from "../types/fareRule";

const FARE_TIME_ZONE = "Asia/Kolkata";

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Minutes past midnight in India for the given instant. */
function localMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: FARE_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);

  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? 0);
  return hour * 60 + minute;
}

export function isNightTime(rule: FareRule, at: Date): boolean {
  const start = toMinutes(rule.nightStart);
  const end = toMinutes(rule.nightEnd);
  const now = localMinutes(at);

  if (start === end) {
    return false;
  }

  // e.g. 22:00-05:00 crosses midnight.
  return start < end
    ? now >= start && now < end
    : now >= start || now < end;
}

const rupees = (value: number) => Math.round(value * 100) / 100;

/*
 * Government-notified meter fare:
 *   minimum fare for the first minKm, then perKm for each km after,
 *   plus the night surcharge in the night window, plus GST.
 * No surge: Karnataka's cab fare order does not allow it.
 */
export function calculateFare(
  rule: FareRule,
  distanceKm: number,
  at: Date = new Date()
): FareQuote {
  const km = Math.max(0, Number(distanceKm) || 0);
  const extraKm = Math.max(0, km - rule.minKm);

  const minFare = rupees(rule.minFare);
  const distanceFare = rupees(extraKm * rule.perKm);
  const night = isNightTime(rule, at);
  const nightSurcharge = night
    ? rupees((minFare + distanceFare) * (rule.nightSurchargePercent / 100))
    : 0;
  const beforeTax = minFare + distanceFare + nightSurcharge;
  const gst = rupees(beforeTax * (rule.gstPercent / 100));

  return {
    vehicleType: rule.vehicleType,
    distanceKm: rupees(km),
    minFare,
    distanceFare,
    nightSurcharge,
    gst,
    // Customers pay whole rupees.
    total: Math.round(beforeTax + gst),
    isNight: night,
  };
}
