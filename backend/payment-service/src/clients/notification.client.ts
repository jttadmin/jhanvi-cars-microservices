
import { Payment } from "../types/payment";
import { getCustomerEmail } from "./auth.client";

const notificationServiceUrl =
  process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:3007";

const internalHeaders = {
  "Content-Type": "application/json",
  "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN ?? ""
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
  idempotencyKey?: string | null;
  attemptCount?: number;
  nextAttemptAt?: string | null;
}

async function sendPaymentEmail(
  payment: Payment,
  event: "PAID" | "FAILED" | "REFUNDED",
  title: string,
  message: string
): Promise<CreateNotificationResponse> {
  const customerEmail = await getCustomerEmail(payment.userId);

  const response = await fetch(`${notificationServiceUrl}/notifications`, {
    method: "POST",
    headers: internalHeaders,
    body: JSON.stringify({
      userId: payment.userId,
      bookingId: payment.bookingId,
      channel: "EMAIL",
      title,
      message,
      status: "PENDING",
      recipient: customerEmail,
      idempotencyKey: `payment:${payment.id}:${event}`
    })
  });

  if (!response.ok) {
    throw new Error(`Notification Service returned ${response.status}`);
  }

  return response.json() as Promise<CreateNotificationResponse>;
}

export function createPaymentNotification(
  payment: Payment
): Promise<CreateNotificationResponse> {
  return sendPaymentEmail(
    payment,
    "PAID",
    "Payment successful",
    `Payment of ${payment.currency} ${payment.amount} for booking ${payment.bookingId} was successful.`
  );
}

export function createPaymentFailedNotification(
  payment: Payment
): Promise<CreateNotificationResponse> {
  return sendPaymentEmail(
    payment,
    "FAILED",
    "Payment failed",
    `Your payment of ${payment.currency} ${payment.amount} for booking ${payment.bookingId} failed. Please review your payment details or try another payment method.`
  );
}

export function createRefundNotification(
  payment: Payment
): Promise<CreateNotificationResponse> {
  return sendPaymentEmail(
    payment,
    "REFUNDED",
    "Payment status updated",
    `The payment record for booking ${payment.bookingId}, amount ${payment.currency} ${payment.amount}, has been marked as refunded in Jhanvi Cars. Please contact support if you need confirmation of the actual refund transaction.`
  );
}
