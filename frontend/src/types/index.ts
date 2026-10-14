export type Role = 'CUSTOMER' | 'DRIVER' | 'ADMIN';

export interface AuthUser {
  id: string;
  role: Role;
  name?: string;
  email?: string;
  mobileNumber?: string;
  // Present for DRIVER accounts if /api/auth/me returns it. If your backend
  // exposes vehicle info from a different endpoint, wire that up in
  // api/drivers.ts instead of guessing at a new one here.
  vehicle?: {
    type: string;
    plateNumber: string;
  };
}

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
  placeId?: string;
}

export type BookingStatus = 'PENDING' | 'CONFIRMED' | 'ONGOING' | 'COMPLETED' | 'CANCELLED';

export interface Booking {
  id: string;
  pickupLocation: string;
  dropoffLocation: string;
  fare: number;
  vehicleType?: string;
  scheduledAt: string;
  status: BookingStatus;
  paymentStatus?: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED';
  refundStatus?: string | null;
  customerId?: string;
  driverId?: string;
  createdAt?: string;
}

export interface RouteResult {
  distanceKm: number;
  durationMin: number;
  /** Encoded polyline from the Routes API, decoded by GoogleRideMap. */
  polyline: string;
}
