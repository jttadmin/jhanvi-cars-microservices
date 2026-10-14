const notificationServiceUrl =
  process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:3007";

async function sendBookingEmail(
  userId: string,
  bookingId: string,
  title: string,
  message: string,
  event: string
): Promise<void> {
  const token = process.env.INTERNAL_SERVICE_TOKEN;

  if (!token) {
    throw new Error("INTERNAL_SERVICE_TOKEN is missing");
  }
  const authServiceUrl =
    process.env.AUTH_SERVICE_URL ?? "http://localhost:3001";

  const userResponse = await fetch(
    `${authServiceUrl}/auth/internal/users/${encodeURIComponent(userId)}`,
    {
      headers: { "x-internal-service-token": token }
    }
  );

  if (!userResponse.ok) {
    throw new Error(`Auth Service returned ${userResponse.status}`);
  }

  const result = await userResponse.json() as {
    success: boolean;
    data?: { user?: { email?: string } };
  };

  const email = result.data?.user?.email?.trim();

  if (!result.success || !email) {
    throw new Error("Customer email was not returned by Auth Service");
  }

  const response = await fetch(`${notificationServiceUrl}/notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-service-token": token
    },
    body: JSON.stringify({
      userId,
      bookingId,
      channel: "EMAIL",
      title,
      message,
      recipient: email,
      idempotencyKey: `booking:${bookingId}:${event}`
    })
  });

  if (!response.ok) {
    throw new Error(`Notification Service returned ${response.status}`);
  }
}

export async function notifyBookingCreated(
  userId: string,
  bookingId: string
): Promise<void> {
  return sendBookingEmail(
    userId, bookingId,
    "Booking request received",
    `We have received your booking request ${bookingId}. We will notify you when its status changes.`,
    "CREATED"
  );
}

export async function notifyBookingStatus(
  userId: string,
  bookingId: string,
  status: string
): Promise<void> {
  const messages: Record<string, { title: string; message: string }> = {
    CONFIRMED: {
      title: "Booking confirmed",
      message: `Your booking ${bookingId} has been confirmed.`
    },
    CANCELLED: {
      title: "Booking cancelled",
      message: `Your booking ${bookingId} has been cancelled. Check your booking details for any applicable refund status.`
    },
    ONGOING: {
      title: "Your trip has started",
      message: `Your trip for booking ${bookingId} has started.`
    },
    COMPLETED: {
      title: "Your trip is complete",
      message: `Your trip for booking ${bookingId} has been completed. Thank you for travelling with Jhanvi Cars.`
    }
  };

  const notification = messages[status];
  if (!notification) return;

  return sendBookingEmail(
    userId, bookingId,
    notification.title,
    notification.message,
    status
  );
}
