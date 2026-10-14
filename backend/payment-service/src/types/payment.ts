export type PaymentMethod = "CASH" | "CARD" | "UPI" | "WALLET";

export type PaymentStatus =
  | "PENDING"
  | "AUTHORIZED"
  | "PAID"
  | "FAILED"
  | "REFUNDED";

export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string | null;
  refundId?: string | null;
  refundRequestId?: string | null;
  refundStatus?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
