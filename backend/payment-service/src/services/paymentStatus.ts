import { PaymentStatus } from "../types/payment";

const allowedTransitions: Record<
  PaymentStatus,
  PaymentStatus[]
> = {
  PENDING: [
    "AUTHORIZED",
    "PAID",
    "FAILED"
  ],

  AUTHORIZED: [
    "PAID",
    "FAILED"
  ],

  PAID: [
    "REFUNDED"
  ],

  FAILED: [],

  REFUNDED: []
};

export function validatePaymentStatusTransition(
  currentStatus: PaymentStatus,
  nextStatus: PaymentStatus
): void {

  if (currentStatus === nextStatus) {
    const error = new Error(
      `Payment is already ${currentStatus}`
    );

    (error as any).statusCode = 409;

    throw error;
  }

  const allowed =
    allowedTransitions[currentStatus]
      .includes(nextStatus);

  if (!allowed) {
    const error = new Error(
      `Invalid payment status transition: ` +
      `${currentStatus} -> ${nextStatus}`
    );

    (error as any).statusCode = 409;

    throw error;
  }
}
