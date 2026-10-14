import db from "../database";
import { Payment, PaymentMethod, PaymentStatus } from "../types/payment";

type PaymentRow = {
  id: string;
  booking_id: string;
  user_id: string;
  amount: string | number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transaction_id: string | null;
  refund_id: string | null;
  refund_request_id: string | null;
  refund_status: string | null;
  created_at?: Date | string;
  updated_at?: Date | string;
};

const mapRow = (row: PaymentRow): Payment => ({
  id: row.id,
  bookingId: row.booking_id,
  userId: row.user_id,
  amount: Number(row.amount),
  currency: row.currency,
  method: row.method,
  status: row.status,
  transactionId: row.transaction_id,
  refundId: row.refund_id,
  refundRequestId: row.refund_request_id,
  refundStatus: row.refund_status,
  createdAt: row.created_at?.toString(),
  updatedAt: row.updated_at?.toString()
});

export const paymentRepository = {
  async findAll() {
    const rows = await db<PaymentRow>("payments")
      .select("*")
      .orderBy("created_at", "desc");

    return rows.map(mapRow);
  },

  async findById(id: string) {
    const row = await db<PaymentRow>("payments")
      .where({ id })
      .first();

    return row ? mapRow(row) : null;
  },

  async findByBookingId(bookingId: string) {
    const row = await db<PaymentRow>("payments")
      .where({ booking_id: bookingId })
      .orderBy("created_at", "desc")
      .first();

    return row ? mapRow(row) : null;
  },

  async create(payment: Payment) {
    const [row] = await db<PaymentRow>("payments")
      .insert({
        id: payment.id,
        booking_id: payment.bookingId,
        user_id: payment.userId,
        amount: payment.amount,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        transaction_id: payment.transactionId ?? null
      })
      .returning("*");

    return mapRow(row);
  },

  async update(id: string, data: Omit<Payment, "id" | "status" | "createdAt" | "updatedAt">) {
    const [row] = await db<PaymentRow>("payments")
      .where({ id })
      .update({
        booking_id: data.bookingId,
        user_id: data.userId,
        amount: data.amount,
        currency: data.currency,
        method: data.method,
        transaction_id: data.transactionId ?? null,
        updated_at: db.fn.now()
      })
      .returning("*");

    return row ? mapRow(row) : null;
  },

  async updateTransactionId(
    id: string,
    transactionId: string
  ) {
    const [row] = await db<PaymentRow>("payments")
      .where({ id })
      .update({
        transaction_id: transactionId,
        updated_at: db.fn.now()
      })
      .returning("*");

    return row ? mapRow(row) : null;
  },

  async claimRefund(id: string, requestId: string) {
    const [row] = await db<PaymentRow>("payments")
      .where({ id, status: "PAID" })
      .whereNull("refund_status")
      .update({
        refund_request_id: requestId,
        refund_status: "REQUESTED",
        updated_at: db.fn.now()
      })
      .returning("*");

    return row ? mapRow(row) : null;
  },

  async updateRefundDetails(
    id: string,
    details: {
      refundId?: string | null;
      refundStatus: string;
    }
  ) {
    const [row] = await db<PaymentRow>("payments")
      .where({ id })
      .update({
        ...(details.refundId !== undefined
          ? { refund_id: details.refundId }
          : {}),
        refund_status: details.refundStatus,
        updated_at: db.fn.now()
      })
      .returning("*");

    return row ? mapRow(row) : null;
  },

  async updateStatus(id: string, status: PaymentStatus) {
    const [row] = await db<PaymentRow>("payments")
      .where({ id })
      .update({
        status,
        updated_at: db.fn.now()
      })
      .returning("*");

    return row ? mapRow(row) : null;
  }
};
