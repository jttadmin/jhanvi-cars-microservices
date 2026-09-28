import { Payment } from "../types/payment";

const notificationServiceUrl =
  process.env.NOTIFICATION_SERVICE_URL ??
  "http://localhost:3007";

const internalHeaders = {
  "Content-Type": "application/json",
  "x-internal-service-token":
    process.env.INTERNAL_SERVICE_TOKEN ?? ""
};

interface CreateNotificationResponse {
  id: string;
  userId: string;
  bookingId?: string | null;
  channel: "EMAIL" | "SMS" | "PUSH";
  title: string;
  message: string;
  status: "PENDING" | "SENT" | "FAILED" | "READ";
  recipient: string;
}

export async function createPaymentNotification(
  payment: Payment
): Promise<CreateNotificationResponse> {

  const response = await fetch(
    `${notificationServiceUrl}/notifications`,
    {
      method: "POST",
      headers: internalHeaders,
      body: JSON.stringify({
        userId: payment.userId,
        bookingId: payment.bookingId,
        channel: "PUSH",
        title: "Payment successful",
        message:
          `Payment of ${payment.currency} ${payment.amount} ` +
          `for booking ${payment.bookingId} was successful.`,
        status: "PENDING",
        recipient: `user:${payment.userId}`
      })
    }
  );

  if (!response.ok) {
    const body = await response.text();

    throw new Error(
      `Notification Service returned ${response.status}: ${body}`
    );
  }

  return response.json() as Promise<CreateNotificationResponse>;
}
