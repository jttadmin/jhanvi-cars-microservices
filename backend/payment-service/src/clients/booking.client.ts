import { Payment } from "../types/payment";

interface Booking {
  id: string;
  userId: string;
  driverId?: string | null;
  pickupLocation: string;
  dropoffLocation: string;
  scheduledAt: string;
  status: string;
  fare: number;
}

const bookingServiceUrl =
  process.env.BOOKING_SERVICE_URL ??
  "http://localhost:3004";

const internalHeaders = {
  "Content-Type": "application/json",
  "x-internal-service-token":
    process.env.INTERNAL_SERVICE_TOKEN ?? ""
};

async function getBooking(
  bookingId: string
): Promise<Booking | null> {

  let response: Response;

  try {
    response = await fetch(
      `${bookingServiceUrl}/bookings/${encodeURIComponent(bookingId)}`,
      {
        headers: internalHeaders
      }
    );
  } catch {
    const error = new Error(
      "Booking Service is unavailable"
    );

    (error as any).statusCode = 503;

    throw error;
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = new Error(
      `Booking Service returned HTTP ${response.status}`
    );

    (error as any).statusCode = 503;

    throw error;
  }

  return await response.json() as Booking;
}

export async function validatePaymentBooking(
  payment: Payment
): Promise<void> {

  const booking =
    await getBooking(payment.bookingId);

  if (!booking) {
    const error = new Error(
      "Booking not found"
    );

    (error as any).statusCode = 404;

    throw error;
  }

  if (
    booking.userId !== payment.userId
  ) {
    const error = new Error(
      "Payment user does not match booking user"
    );

    (error as any).statusCode = 409;

    throw error;
  }

  if (
    Number(booking.fare) !==
    Number(payment.amount)
  ) {
    const error = new Error(
      "Payment amount does not match booking fare"
    );

    (error as any).statusCode = 409;

    throw error;
  }

  if (
    booking.status === "CANCELLED"
  ) {
    const error = new Error(
      "Cannot pay for a cancelled booking"
    );

    (error as any).statusCode = 409;

    throw error;
  }
}
