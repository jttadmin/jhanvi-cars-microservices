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
  scheduledAt: string;
  status: BookingStatus;
  fare: number;
  vehicleType?: "AUTO" | "ECONOMY" | "COMFORT" | "COMFORT_PLUS";
  /** Start-ride code. Only included in responses to the booking's customer. */
  startOtp?: string | null;
}
