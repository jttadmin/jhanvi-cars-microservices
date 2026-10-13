const internalHeaders = {
  "Content-Type": "application/json",
  "x-internal-service-token":
    process.env.INTERNAL_SERVICE_TOKEN ?? "",
};

export class BookingServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly isCompetingDriverConflict: boolean = false
  ) {
    super(message);
    this.name = "BookingServiceError";
  }
}

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
        body: JSON.stringify({ driverId }),
      }
    );
  } catch {
    throw new BookingServiceError(
      "Booking Service is unavailable"
    );
  }

  if (!response.ok) {
    const bodyText = await response.text();

    let responseBody: { message?: string; code?: string } = {};

    try {
      responseBody = JSON.parse(bodyText);
    } catch {
      // Use the fallback message for non-JSON responses.
    }

    const message =
      responseBody.message ||
      `Booking Service returned HTTP ${response.status}`;

    const isCompetingDriverConflict =
      response.status === 409 &&
      responseBody.code === "BOOKING_ALREADY_CLAIMED";

    throw new BookingServiceError(
      message,
      response.status,
      isCompetingDriverConflict
    );
  }
}

export async function getBookingAcceptanceState(
  bookingId: string
): Promise<{
  id: string;
  status: string;
  driverId?: string | null;
}> {
  const bookingBaseUrl =
    process.env.BOOKING_SERVICE_URL ??
    "http://localhost:3004";

  let response: Response;

  try {
    response = await fetch(
      `${bookingBaseUrl}/bookings/${encodeURIComponent(bookingId)}`,
      {
        method: "GET",
        headers: internalHeaders,
      }
    );
  } catch {
    throw new BookingServiceError(
      "Could not verify booking acceptance outcome"
    );
  }

  if (!response.ok) {
    throw new BookingServiceError(
      `Could not verify booking acceptance outcome (HTTP ${response.status})`,
      response.status
    );
  }

  return (await response.json()) as {
    id: string;
    status: string;
    driverId?: string | null;
  };
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
        body: JSON.stringify({ driverId }),
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

export async function notifyBookingExpired(
  bookingId: string,
  driverId: string
): Promise<void> {
  const bookingBaseUrl =
    process.env.BOOKING_SERVICE_URL ??
    "http://localhost:3004";

  let response: Response;

  try {
    response = await fetch(
      `${bookingBaseUrl}/bookings/internal/${bookingId}/driver-expired`,
      {
        method: "PATCH",
        headers: internalHeaders,
        body: JSON.stringify({ driverId }),
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

export async function getDriverRatingSummary(
  driverId: string
): Promise<{
  averageRating: number;
  totalRatings: number;
}> {
  const bookingBaseUrl =
    process.env.BOOKING_SERVICE_URL ??
    "http://localhost:3004";

  const response = await fetch(
    `${bookingBaseUrl}/bookings/internal/drivers/${driverId}/rating-summary`,
    {
      method: "GET",
      headers: internalHeaders,
    }
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Failed to get driver rating summary: ${response.status} ${body}`
    );
  }

  return response.json() as Promise<{
    averageRating: number;
    totalRatings: number;
  }>;
}

export async function getDriverEarnings(
  driverId: string
): Promise<{
  totalTrips: number;
  totalEarnings: number;
  todayTrips: number;
  todayEarnings: number;
  weekTrips: number;
  weekEarnings: number;
}> {
  const bookingBaseUrl =
    process.env.BOOKING_SERVICE_URL ??
    "http://localhost:3004";

  const response = await fetch(
    `${bookingBaseUrl}/bookings/internal/drivers/${driverId}/earnings`,
    {
      method: "GET",
      headers: internalHeaders,
    }
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Failed to get driver earnings: ${response.status} ${body}`
    );
  }

  return response.json() as Promise<{
    totalTrips: number;
    totalEarnings: number;
    todayTrips: number;
    todayEarnings: number;
    weekTrips: number;
    weekEarnings: number;
  }>;
}

export async function getDriverHistory(
  driverId: string
): Promise<Array<{
  id: string;
  userId: string;
  driverId?: string | null;
  pickupLocation: string;
  pickupLatitude?: number | null;
  pickupLongitude?: number | null;
  dropoffLocation: string;
  scheduledAt: string;
  status: string;
  fare: number;
  vehicleType?: "AUTO" | "ECONOMY" | "COMFORT" | "COMFORT_PLUS";
}>> {
  const bookingBaseUrl =
    process.env.BOOKING_SERVICE_URL ??
    "http://localhost:3004";

  const response = await fetch(
    `${bookingBaseUrl}/bookings/internal/drivers/${driverId}/history`,
    {
      method: "GET",
      headers: internalHeaders,
    }
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Failed to get driver history: ${response.status} ${body}`
    );
  }

  return response.json() as Promise<Array<{
    id: string;
    userId: string;
    driverId?: string | null;
    pickupLocation: string;
    pickupLatitude?: number | null;
    pickupLongitude?: number | null;
    dropoffLocation: string;
    scheduledAt: string;
    status: string;
    fare: number;
    vehicleType?: "AUTO" | "ECONOMY" | "COMFORT" | "COMFORT_PLUS";
  }>>;
}
