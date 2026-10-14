
import { randomUUID, createHmac, timingSafeEqual } from "crypto";
import { paymentRepository } from "../repositories/paymentRepository";
import { Payment, PaymentStatus } from "../types/payment";
import { validatePaymentStatusTransition } from "./paymentStatus";
import { validatePaymentBooking } from "../clients/booking.client";
import { confirmBooking } from "../clients/booking-status.client";
import { razorpayClient } from "../clients/razorpay.client";
import {
  createPaymentNotification,
  createPaymentFailedNotification,
  createRefundNotification
} from "../clients/notification.client";

function getStatusCodeError(message: string, statusCode: number): Error {
  const error = new Error(message) as Error & { statusCode?: number };
  error.statusCode = statusCode;
  return error;
}

async function notifySafely(
  label: string,
  payment: Payment,
  send: (payment: Payment) => Promise<unknown>
): Promise<void> {
  try {
    await send(payment);
    console.log(`${label} notification created for payment ${payment.id}`);
  } catch (error) {
    console.error(
      `Failed to create ${label.toLowerCase()} notification for payment ${payment.id}:`,
      error instanceof Error ? error.message : "Unknown error"
    );
  }
}

export const paymentService = {
  async getAll(): Promise<Payment[]> {
    return paymentRepository.findAll();
  },

  async getById(id: string): Promise<Payment> {
    const payment = await paymentRepository.findById(id);

    if (!payment) {
      throw getStatusCodeError("Payment not found", 404);
    }

    return payment;
  },

  async getByBookingId(bookingId: string): Promise<Payment | null> {
    return paymentRepository.findByBookingId(bookingId);
  },

  async create(
    input: Omit<Payment, "createdAt" | "updatedAt">
  ): Promise<Payment> {
    const payment: Payment = {
      ...input,
      id: input.id || randomUUID()
    };

    await validatePaymentBooking(payment);

    return paymentRepository.create(payment);
  },

  async update(
    id: string,
    data: Omit<Payment, "id" | "status" | "createdAt" | "updatedAt">
  ): Promise<Payment> {
    const existing = await this.getById(id);
    const updated = await paymentRepository.update(id, data);

    if (!updated) {
      throw getStatusCodeError("Payment not found", 404);
    }

    return {
      ...updated,
      status: existing.status
    };
  },

  async updateStatus(id: string, status: PaymentStatus): Promise<Payment> {
    const existing = await this.getById(id);

    validatePaymentStatusTransition(existing.status, status);

    const payment = await paymentRepository.updateStatus(id, status);

    if (!payment) {
      throw getStatusCodeError("Payment not found", 404);
    }

    if (status === "PAID") {
      try {
        await confirmBooking(payment.bookingId);
      } catch (error) {
        console.error(
          `Failed to confirm booking ${payment.bookingId} for payment ${payment.id}:`,
          error instanceof Error ? error.message : "Unknown error"
        );
      }

      await notifySafely(
        "Payment-success",
        payment,
        createPaymentNotification
      );
    }

    if (status === "FAILED") {
      await notifySafely(
        "Payment-failure",
        payment,
        createPaymentFailedNotification
      );
    }

    if (status === "REFUNDED") {
      await notifySafely(
        "Refund",
        payment,
        createRefundNotification
      );
    }

    return payment;
  },

  async refundPayment(id: string): Promise<Payment> {
    let payment = await this.getById(id);

    if (payment.status === "REFUNDED") {
      return payment;
    }

    if (payment.status !== "PAID") {
      throw getStatusCodeError(
        "Only paid payments can be refunded",
        409
      );
    }

    // A verified Razorpay payment ID starts with pay_. Never refund an order ID.
    if (!payment.transactionId?.startsWith("pay_")) {
      throw getStatusCodeError(
        "No verified Razorpay payment ID is available for this payment",
        409
      );
    }

    if (payment.refundStatus === "FAILED") {
      throw getStatusCodeError(
        "A previous refund attempt failed; manual reconciliation is required",
        409
      );
    }

    // If Razorpay processing was recorded but the local payment status
    // update failed, retry only the local status update. Never submit
    // another provider refund in this state.
    if (payment.refundStatus === "PROCESSED") {
      return this.updateStatus(id, "REFUNDED");
    }

    if (
      payment.refundStatus === "REQUESTED" ||
      payment.refundStatus === "PENDING"
    ) {
      // Reconcile the already-created request. Do not submit another refund.
      if (!payment.refundRequestId) {
        throw getStatusCodeError(
          "Refund state is ambiguous; manual reconciliation is required",
          409
        );
      }

      // Search paginated results for the original request. Never create
      // another refund merely because it is absent from the first page.
      const pageSize = 100;
      const maxPages = 10;
      let page = await razorpayClient.payments.fetchMultipleRefund(
        payment.transactionId,
        { count: pageSize, skip: 0 }
      );

      let refund = page.items.find(
        item => item.notes?.refundRequestId === payment.refundRequestId
      );
      let skip = page.items.length;
      let pagesChecked = 1;

      while (
        !refund &&
        page.items.length === pageSize &&
        pagesChecked < maxPages
      ) {
        page = await razorpayClient.payments.fetchMultipleRefund(
          payment.transactionId,
          { count: pageSize, skip }
        );

        refund = page.items.find(
          item => item.notes?.refundRequestId === payment.refundRequestId
        );

        skip += page.items.length;
        pagesChecked += 1;
      }

      if (!refund) {
        throw getStatusCodeError(
          "Refund outcome is not yet confirmed; no duplicate request was sent",
          409
        );
      }

      await paymentRepository.updateRefundDetails(id, {
        refundId: refund.id,
        refundStatus: String(refund.status).toUpperCase()
      });

      if (String(refund.status).toLowerCase() === "processed") {
        return this.updateStatus(id, "REFUNDED");
      }

      if (String(refund.status).toLowerCase() === "failed") {
        await paymentRepository.updateRefundDetails(id, {
          refundId: refund.id,
          refundStatus: "FAILED"
        });
        throw getStatusCodeError(
          "Razorpay reports that the refund failed",
          409
        );
      }

      return this.getById(id);
    }

    const requestId = randomUUID();
    const claimed = await paymentRepository.claimRefund(id, requestId);

    if (!claimed) {
      throw getStatusCodeError(
        "A refund is already being processed or the payment changed",
        409
      );
    }

    // Persist the request ID before calling the provider. If the network
    // response is lost, a later request reconciles rather than resubmitting.
    let refund;
    try {
      refund = await razorpayClient.payments.refund(
        payment.transactionId,
        {
          notes: {
            paymentId: payment.id,
            bookingId: payment.bookingId,
            refundRequestId: requestId
          }
        }
      );
    } catch (error) {
      console.error(
        `Razorpay refund outcome is uncertain for payment ${id}; ` +
        "the request was retained for reconciliation."
      );
      throw getStatusCodeError(
        "Refund outcome is uncertain; do not retry manually until reconciled",
        503
      );
    }

    const providerStatus = String(refund.status).toLowerCase();
    const storedStatus =
      providerStatus === "processed" ? "PROCESSED" :
      providerStatus === "failed" ? "FAILED" : "PENDING";

    await paymentRepository.updateRefundDetails(id, {
      refundId: refund.id,
      refundStatus: storedStatus
    });

    if (providerStatus === "processed") {
      return this.updateStatus(id, "REFUNDED");
    }

    if (providerStatus === "failed") {
      throw getStatusCodeError("Razorpay refund failed", 409);
    }

    // Keep payment PAID while Razorpay reports a pending refund.
    return this.getById(id);
  },

  async createRazorpayOrder(id: string) {
    const payment = await this.getById(id);

    if (payment.status !== "PENDING") {
      throw getStatusCodeError(
        "A Razorpay order can only be created for a pending payment",
        409
      );
    }

    await validatePaymentBooking(payment);

    const order = await razorpayClient.orders.create({
      amount: Math.round(payment.amount * 100),
      currency: payment.currency,
      receipt: payment.id,
      notes: {
        paymentId: payment.id,
        bookingId: payment.bookingId,
        userId: payment.userId
      }
    });

    const updated = await paymentRepository.updateTransactionId(
      payment.id,
      order.id
    );

    if (!updated) {
      throw getStatusCodeError(
        "Payment not found while saving Razorpay order",
        404
      );
    }

    return {
      paymentId: payment.id,
      razorpayOrderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId: process.env.RAZORPAY_KEY_ID
    };
  },

  async verifyRazorpayPayment(
    id: string,
    razorpayOrderId: string,
    razorpayPaymentId: string,
    razorpaySignature: string
  ): Promise<Payment> {
    const payment = await this.getById(id);

    if (payment.status !== "PENDING" && payment.status !== "AUTHORIZED") {
      throw getStatusCodeError(
        `Cannot verify a payment with status ${payment.status}`,
        409
      );
    }

    if (payment.transactionId !== razorpayOrderId) {
      throw getStatusCodeError(
        "Razorpay order does not match this payment",
        400
      );
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;

    if (!secret) {
      throw new Error("RAZORPAY_KEY_SECRET is not configured");
    }

    const expectedSignature = createHmac("sha256", secret)
      .update(`${razorpayOrderId}|${razorpayPaymentId}`)
      .digest("hex");

    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    const receivedBuffer = Buffer.from(razorpaySignature, "hex");

    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      throw getStatusCodeError("Invalid Razorpay payment signature", 400);
    }

    await paymentRepository.updateTransactionId(id, razorpayPaymentId);

    if (payment.status === "PENDING") {
      return this.updateStatus(id, "PAID");
    }

    return this.getById(id);
  }
};
