const bookingServiceUrl =
  process.env.BOOKING_SERVICE_URL ??
  "http://localhost:3004";

const internalHeaders = {
  "Content-Type": "application/json",
  "x-internal-service-token":
    process.env.INTERNAL_SERVICE_TOKEN ?? ""
};

export async function confirmBooking(
  bookingId: string
) {
  const response = await fetch(
    `${bookingServiceUrl}/bookings/${bookingId}/status`,
    {
      method: "PATCH",
      headers: internalHeaders,
      body: JSON.stringify({
        status: "CONFIRMED"
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Booking Service returned ${response.status}: ${body}`
    );
  }

  return response.json();
}
