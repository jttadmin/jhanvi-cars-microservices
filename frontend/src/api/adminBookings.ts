import { apiRequest } from './client';

export type BookingStatus =
  | 'PENDING'
  | 'CONFIRMED'
  | 'ONGOING'
  | 'COMPLETED'
  | 'CANCELLED';

export interface AdminBooking {
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
  vehicleType?: 'AUTO' | 'ECONOMY' | 'COMFORT' | 'COMFORT_PLUS';
}

export async function getAdminBookings(): Promise<AdminBooking[]> {
  return apiRequest<AdminBooking[]>('/bookings');
}

export async function updateAdminBookingStatus(
  id: string,
  status: BookingStatus,
): Promise<AdminBooking> {
  return apiRequest<AdminBooking>(
    `/bookings/${encodeURIComponent(id)}/status`,
    {
      method: 'PATCH',
      body: { status },
    },
  );
}
