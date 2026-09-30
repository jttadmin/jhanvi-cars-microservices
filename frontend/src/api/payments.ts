import { apiRequest } from './client';
export interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  transactionId?: string | null;
}

export interface RazorpayOrder {
  paymentId: string;
  orderId: string;
  amount: number;
  currency: string;
  keyId: string;
}

export interface RazorpayVerification {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  method: string;
  status: string;
  transactionId?: string | null;
}

export async function createPayment(input: {
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  method: 'CASH' | 'CARD' | 'UPI' | 'WALLET';
}): Promise<Payment> {
  return apiRequest<Payment>('/payments', {
    method: 'POST',
    body: input,
  });
}

export async function createRazorpayOrder(
  paymentId: string,
): Promise<RazorpayOrder> {
  return apiRequest<RazorpayOrder>(
    `/payments/${paymentId}/razorpay-order`,
    {
      method: 'POST',
    },
  );
}

export async function verifyRazorpayPayment(
  paymentId: string,
  input: {
    razorpayOrderId: string;
    razorpayPaymentId: string;
    razorpaySignature: string;
  },
): Promise<RazorpayVerification> {
  return apiRequest<RazorpayVerification>(
    `/payments/${paymentId}/razorpay-verify`,
    {
      method: 'POST',
      body: input,
    },
  );
}
