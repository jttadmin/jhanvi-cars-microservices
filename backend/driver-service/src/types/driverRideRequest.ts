export type DriverRideRequestStatus =
  | "OFFERED"
  | "ACCEPTED"
  | "REJECTED"
  | "EXPIRED"
  | "CANCELLED";

export interface DriverRideRequest {
  id: string;
  bookingId: string;
  driverId: string;
  pickupLatitude: number;
  pickupLongitude: number;
  status: DriverRideRequestStatus;
  createdAt: Date;
  expiresAt: Date;
  respondedAt?: Date | null;
}
