import { BookingStatus } from "../types/booking";

const allowedTransitions: Record<
  BookingStatus,
  BookingStatus[]
> = {
  PENDING: [
    "CONFIRMED",
    "CANCELLED"
  ],

  CONFIRMED: [
    "ONGOING",
    "CANCELLED"
  ],

  ONGOING: [
    "COMPLETED"
  ],

  COMPLETED: [],

  CANCELLED: []
};

export function validateBookingStatusTransition(
  currentStatus: BookingStatus,
  nextStatus: BookingStatus
): void {

  if (currentStatus === nextStatus) {
    const error = new Error(
      `Booking is already ${currentStatus}`
    );

    (error as any).statusCode = 409;

    throw error;
  }

  const allowed =
    allowedTransitions[currentStatus]
      .includes(nextStatus);

  if (!allowed) {
    const error = new Error(
      `Invalid booking status transition: ` +
      `${currentStatus} -> ${nextStatus}`
    );

    (error as any).statusCode = 409;

    throw error;
  }
}
