import crypto from "crypto";
import { paymentRepository } from "../repositories/paymentRepository";
import { Payment, PaymentStatus } from "../types/payment";
import { validatePaymentBooking } from "../clients/booking.client";
import { createPaymentNotification } from "../clients/notification.client";
import { validatePaymentStatusTransition } from "./paymentStatus";
import { razorpay } from "../clients/razorpay.client";

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
    const payment = await paymentRepository.findById(id);

    if (!payment) {
      const error = new Error("Payment not found");
      (error as any).statusCode = 404;
      throw error;
    }

    if (payment.status !== "PENDING") {
      const error = new Error(
        `Cannot create Razorpay order for payment in ${payment.status} status`
      );
      (error as any).statusCode = 409;
      throw error;
    }

    await validatePaymentBooking(payment);

    const existingTransactionId = payment.transactionId;

    if (existingTransactionId?.startsWith("order_")) {
      return {
        payment,
        razorpayOrderId: existingTransactionId
      };
    }

    const amountInPaise = Math.round(
      Number(payment.amount) * 100
    );

    if (!Number.isSafeInteger(amountInPaise) || amountInPaise <= 0) {
      const error = new Error(
        "Invalid payment amount for Razorpay"
      );
      (error as any).statusCode = 400;
      throw error;
    }

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: payment.currency,
      receipt: payment.id
    });

    const updatedPayment =
      await paymentRepository.updateTransactionId(
        payment.id,
        order.id
      );

    if (!updatedPayment) {
      const error = new Error(
        "Failed to save Razorpay order"
      );
      (error as any).statusCode = 500;
      throw error;
    }

    return {
      payment: updatedPayment,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency
    };
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
       *
       * IMPORTANT:
       * Payment success does NOT mean that a driver
       * has accepted the booking.
       *
       * The booking remains PENDING until a driver
       * explicitly accepts it through the booking service.
       */

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
  },

  verifyRazorpayPayment: async (
    id: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ) => {
    const payment = await paymentRepository.findById(id);

    if (!payment) {
      const error = new Error("Payment not found");
      (error as any).statusCode = 404;
      throw error;
    }

    if (payment.status === "PAID") {
      return payment;
    }

    if (payment.status !== "PENDING") {
      const error = new Error(
        `Cannot verify Razorpay payment for payment in ${payment.status} status`
      );
      (error as any).statusCode = 409;
      throw error;
    }

    const storedOrderId = payment.transactionId;

    if (
      !storedOrderId ||
      !storedOrderId.startsWith("order_")
    ) {
      const error = new Error(
        "Razorpay order is not associated with this payment"
      );
      (error as any).statusCode = 409;
      throw error;
    }

    if (storedOrderId !== razorpayOrderId) {
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

    const keySecret = process.env.RAZORPAY_KEY_SECRET;

    if (!keySecret) {
      const error = new Error(
        "RAZORPAY_KEY_SECRET is not configured"
      );
      (error as any).statusCode = 500;
      throw error;
    }

    const payload =
      `${storedOrderId}|${razorpayPaymentId}`;

    const expectedSignature =
      crypto
        .createHmac("sha256", keySecret)
        .update(payload)
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

    const updatedPayment =
      await paymentRepository.updateTransactionId(
        payment.id,
        razorpayPaymentId
      );

    if (!updatedPayment) {
      const error = new Error(
        "Failed to save Razorpay payment ID"
      );
      (error as any).statusCode = 500;
      throw error;
    }

    return paymentService.updateStatus(
      payment.id,
      "PAID"
    );
  },
};
