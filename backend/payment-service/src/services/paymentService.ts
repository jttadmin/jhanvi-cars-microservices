import { paymentRepository } from "../repositories/paymentRepository";
import { Payment, PaymentStatus } from "../types/payment";
import { validatePaymentBooking } from "../clients/booking.client";
import { createPaymentNotification } from "../clients/notification.client";
import { confirmBooking } from "../clients/booking-status.client";
import { validatePaymentStatusTransition } from "./paymentStatus";

export const paymentService = {
  getAll: () => paymentRepository.findAll(),

  getById: async (id: string) => {
    const payment = await paymentRepository.findById(id);

    if (!payment) {
      const error = new Error("Payment not found");
      (error as any).statusCode = 404;
      throw error;
    }

    return payment;
  },

  getByBookingId: async (bookingId: string) => {
    return paymentRepository.findByBookingId(bookingId);
  },

  create: async (payment: Payment) => {
    await validatePaymentBooking(payment);

    return paymentRepository.create({
      ...payment,
      status: "PENDING"
    });
  },

  update: async (
    id: string,
    data: Omit<
      Payment,
      "id" | "status" | "createdAt" | "updatedAt"
    >
  ) => {
    const payment =
      await paymentRepository.update(id, data);

    if (!payment) {
      const error = new Error("Payment not found");
      (error as any).statusCode = 404;
      throw error;
    }

    return payment;
  },

  updateStatus: async (
    id: string,
    status: PaymentStatus
  ) => {
    const existing =
      await paymentRepository.findById(id);

    if (!existing) {
      const error = new Error("Payment not found");
      (error as any).statusCode = 404;
      throw error;
    }

    validatePaymentStatusTransition(
      existing.status,
      status
    );

    const payment =
      await paymentRepository.updateStatus(
        id,
        status
      );

    if (!payment) {
      const error = new Error("Payment not found");
      (error as any).statusCode = 404;
      throw error;
    }

    if (status === "PAID") {

      /*
       * Payment has successfully completed.
       * Confirm the associated booking.
       */
      try {
        await confirmBooking(
          payment.bookingId
        );

        console.log(
          `Booking ${payment.bookingId} confirmed ` +
          `after payment ${payment.id}`
        );
      } catch (error) {
        console.error(
          `Failed to confirm booking ` +
          `${payment.bookingId} after payment ` +
          `${payment.id}`,
          error
        );
      }

      /*
       * Create payment-success notification.
       */
      try {
        await createPaymentNotification(
          payment
        );

        console.log(
          `Payment notification created ` +
          `for payment ${payment.id}`
        );
      } catch (error) {
        console.error(
          `Failed to create payment notification ` +
          `for payment ${payment.id}`,
          error
        );
      }
    }

    return payment;
  }
};
