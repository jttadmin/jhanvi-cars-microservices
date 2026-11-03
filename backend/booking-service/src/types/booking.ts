export type BookingStatus =
  | "PENDING"
  | "CONFIRMED"
  | "ONGOING"
  | "COMPLETED"
  | "CANCELLED";

export interface Booking {
  id: string;
  userId: string;
  driverId?: string | null;
  pickupLocation: string;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  dropoffLocation: string;
  dropoffLatitude?: number | null;
  dropoffLongitude?: number | null;
  scheduledAt: string;
  status: BookingStatus;
  fare: number;
  /** Trip distance the fare was calculated from. */
  distanceKm?: number | null;
  vehicleType?: "AUTO" | "ECONOMY" | "COMFORT" | "COMFORT_PLUS";
  /** Start-ride code. Only included in responses to the booking's customer. */
  startOtp?: string | null;
}
