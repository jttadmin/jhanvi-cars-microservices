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

export async function cancelBooking(id: string): Promise<Booking> {
  return apiRequest<Booking>(`/bookings/${id}/status`, {
    method: 'PATCH',
    body: {
      status: 'CANCELLED',
    },
  });
}


type BookingPaymentStatus = {
  status: 'PENDING' | 'AUTHORIZED' | 'PAID' | 'FAILED' | 'REFUNDED';
  refundStatus?: string | null;
};

const refundStatusCache = new Map<
  string,
  { value: BookingPaymentStatus | null; expiresAt: number; terminal: boolean }
>();

const REFUND_STATUS_CACHE_TTL_MS = 15_000;

/** Retrieve payment/refund status using the authenticated payment endpoint. */
export async function getBookingPaymentStatus(
  bookingId: string
): Promise<BookingPaymentStatus | null> {
  const cached = refundStatusCache.get(bookingId);

  if (
    cached &&
    (cached.terminal || cached.expiresAt > Date.now())
  ) {
    return cached.value;
  }

  try {
    const payment = await apiRequest<BookingPaymentStatus>(
      `/payments/booking/${encodeURIComponent(bookingId)}`
    );

    const terminal =
      payment.refundStatus === 'PROCESSED' ||
      payment.refundStatus === 'FAILED' ||
      payment.status === 'REFUNDED';

    refundStatusCache.set(bookingId, {
      value: payment,
      expiresAt: terminal ? Number.POSITIVE_INFINITY : Date.now() + REFUND_STATUS_CACHE_TTL_MS,
      terminal,
    });

    return payment;
  } catch {
    // Retry later; never interpret a lookup failure as a completed refund.
    refundStatusCache.set(bookingId, {
      value: null,
      expiresAt: Date.now() + REFUND_STATUS_CACHE_TTL_MS,
      terminal: false,
    });
    return null;
  }
}

/** Enrich cancelled rides with the current refund status. */
export async function getBookingsWithRefundStatus(): Promise<Booking[]> {
  const rides = await getBookings();
  return Promise.all(
    rides.map(async (ride) => {
      if (ride.status !== 'CANCELLED') return ride;
      const payment = await getBookingPaymentStatus(ride.id);
      return payment
        ? {
            ...ride,
            paymentStatus: payment.status,
            refundStatus: payment.refundStatus ?? null,
          }
        : ride;
    })
  );
}
