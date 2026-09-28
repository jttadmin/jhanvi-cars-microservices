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
  dropoffLocation: string;
  scheduledAt: string;
  status: BookingStatus;
  fare: number;
}
