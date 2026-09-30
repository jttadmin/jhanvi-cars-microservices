import { paymentRepository } from "../repositories/paymentRepository";
import { Payment, PaymentStatus } from "../types/payment";
import { validatePaymentBooking } from "../clients/booking.client";
import { createPaymentNotification } from "../clients/notification.client";
import { confirmBooking } from "../clients/booking-status.client";
import { razorpayClient } from "../clients/razorpay.client";
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

  createRazorpayOrder: async (id: string) => {
    const payment =
      await paymentRepository.findById(id);

    if (!payment) {
      const error = new Error("Payment not found");
      (error as any).statusCode = 404;
      throw error;
    }

    if (payment.status !== "PENDING") {
      const error = new Error(
        `Payment is already ${payment.status}`
      );
      (error as any).statusCode = 409;
      throw error;
    }

    /*
     * Prevent creating a second Razorpay order
     * for the same payment.
     */
    if (
      payment.transactionId &&
      payment.transactionId.startsWith("order_")
    ) {
      return {
        paymentId: payment.id,
        orderId: payment.transactionId,
        amount: Math.round(payment.amount * 100),
        currency: payment.currency,
        keyId: process.env.RAZORPAY_KEY_ID
      };
    }

    const amountInPaise =
      Math.round(payment.amount * 100);

    if (amountInPaise <= 0) {
      const error = new Error(
        "Payment amount must be greater than zero"
      );
      (error as any).statusCode = 400;
      throw error;
    }

    const order =
      await razorpayClient.orders.create({
        amount: amountInPaise,
        currency: payment.currency,
        receipt: payment.id
      });

    const updatedPayment =
      await paymentRepository.update(
        payment.id,
        {
          bookingId: payment.bookingId,
          userId: payment.userId,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          transactionId: order.id
        }
      );

    if (!updatedPayment) {
      const error = new Error(
        "Failed to save Razorpay order"
      );
      (error as any).statusCode = 500;
      throw error;
    }

    return {
      paymentId: payment.id,
      orderId: order.id,
      amount: amountInPaise,
      currency: payment.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    };
  },

  verifyRazorpayPayment: async (
    id: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) => {
    const payment =
      await paymentRepository.findById(id);

    if (!payment) {
      const error = new Error("Payment not found");
      (error as any).statusCode = 404;
      throw error;
    }

    if (payment.status !== "PENDING") {
      const error = new Error(
        `Payment is already ${payment.status}`
      );
      (error as any).statusCode = 409;
      throw error;
    }

    /*
     * The order ID supplied by the browser must match
     * the Razorpay order previously created for this payment.
     */
    if (payment.transactionId !== razorpayOrderId) {
      const error = new Error(
        "Razorpay order does not match payment"
      );
      (error as any).statusCode = 400;
      throw error;
    }

    if (!razorpayPaymentId.startsWith("pay_")) {
      const error = new Error(
        "Invalid Razorpay payment ID"
      );
      (error as any).statusCode = 400;
      throw error;
    }

    if (!razorpaySignature) {
      const error = new Error(
        "Razorpay signature is required"
      );
      (error as any).statusCode = 400;
      throw error;
    }

    const crypto =
      await import("crypto");

    const keySecret =
      process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      const error = new Error(
        "RAZORPAY_KEY_SECRET is not configured"
      );
      (error as any).statusCode = 500;
      throw error;
    }

    const expectedSignature =
      crypto
        .createHmac("sha256", keySecret)
        .update(
          `${razorpayOrderId}|${razorpayPaymentId}`
        )
        .digest("hex");

    const expectedBuffer =
      Buffer.from(expectedSignature, "utf8");

    const receivedBuffer =
      Buffer.from(razorpaySignature, "utf8");

    if (
      expectedBuffer.length !==
      receivedBuffer.length ||
      !crypto.timingSafeEqual(
        expectedBuffer,
        receivedBuffer
      )
    ) {
      const error = new Error(
        "Invalid Razorpay payment signature"
      );
      (error as any).statusCode = 400;
      throw error;
    }

    /*
     * Signature is valid. Store the Razorpay payment ID
     * and transition the payment through the existing
     * PAID workflow.
     */
    const updatedPayment =
      await paymentRepository.update(
        payment.id,
        {
          bookingId: payment.bookingId,
          userId: payment.userId,
          amount: payment.amount,
          currency: payment.currency,
          method: payment.method,
          transactionId: razorpayPaymentId
        }
      );

    if (!updatedPayment) {
      const error = new Error(
        "Failed to update Razorpay payment"
      );
      (error as any).statusCode = 500;
      throw error;
    }

    return paymentService.updateStatus(
      payment.id,
      "PAID"
    );
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
