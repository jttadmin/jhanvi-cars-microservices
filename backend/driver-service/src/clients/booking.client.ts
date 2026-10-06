const internalHeaders = {
  "Content-Type": "application/json",
  "x-internal-service-token":
    process.env.INTERNAL_SERVICE_TOKEN ?? "",
};

export async function notifyBookingAccepted(
  bookingId: string,
  driverId: string
): Promise<void> {
  const bookingBaseUrl =
    process.env.BOOKING_SERVICE_URL ??
    "http://localhost:3004";

  let response: Response;

  try {
    response = await fetch(
      `${bookingBaseUrl}/bookings/internal/${bookingId}/driver-accepted`,
      {
        method: "PATCH",
        headers: internalHeaders,
        body: JSON.stringify({
          driverId,
        }),
      }
    );
  } catch {
    throw new Error("Booking Service is unavailable");
  }

  if (!response.ok) {
    throw new Error(
      `Booking Service returned HTTP ${response.status}`
    );
  }
}

export async function notifyBookingRejected(
  bookingId: string,
  driverId: string
): Promise<void> {
  const bookingBaseUrl =
    process.env.BOOKING_SERVICE_URL ??
    "http://localhost:3004";

  let response: Response;

  try {
    response = await fetch(
      `${bookingBaseUrl}/bookings/internal/${bookingId}/driver-rejected`,
      {
        method: "PATCH",
        headers: internalHeaders,
        body: JSON.stringify({
          driverId,
        }),
      }
    );
  } catch {
    throw new Error("Booking Service is unavailable");
  }

  if (!response.ok) {
    throw new Error(
      `Booking Service returned HTTP ${response.status}`
    );
  }
}

