import { apiRequest } from './client';
import type { Booking } from '../types';
import type { RideType } from '../utils/fare';

export async function createBooking(input: {
  pickupLocation: string;
  dropoffLocation: string;
  fare: number;
  scheduledAt: string;
  vehicleType: RideType;
}): Promise<Booking> {
  return apiRequest<Booking>('/bookings', { method: 'POST', body: input });
}

/**
 * Returns the caller's own rides. For a CUSTOMER that's rides they booked;
 * for a DRIVER we're assuming the same endpoint returns rides assigned to
 * them when called with a driver JWT. If your backend instead exposes a
 * separate route for driver-assigned bookings, point DriverDashboard at
 * that route here rather than changing this function's contract.
 */
export async function getBookings(): Promise<Booking[]> {
  return apiRequest<Booking[]>('/bookings');
}

export async function acceptBooking(id: string): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}/accept`, { method: 'PATCH' });
}

export async function startBooking(id: string): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}/start`, { method: 'PATCH' });
}

export async function completeBooking(id: string): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}/complete`, { method: 'PATCH' });
}

// Cancellation isn't wired up: the brief mentions it but no endpoint was
// given (no PATCH /api/bookings/:id/cancel in the contract). Add it here
// once the backend exposes one — don't invent the path in the meantime.
