import { apiRequest } from './client';

export interface CreatePaymentResponse {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  method: 'CASH' | 'CARD' | 'UPI' | 'WALLET';
  status: string;
  transactionId: string | null;
}

export interface RazorpayOrderResponse {
  paymentId: string;
  razorpayOrderId: string;
  amount: number;
  currency: string;
}

export interface RazorpayVerificationResponse {
  paymentId: string;
  bookingId: string;
  status: string;
  transactionId: string;
}

export async function createPayment(input: {
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  method: 'UPI';
}): Promise<CreatePaymentResponse> {
  return apiRequest<CreatePaymentResponse>('/payments', {
    method: 'POST',
    body: input,
  });
}

export async function createRazorpayOrder(
  paymentId: string,
): Promise<RazorpayOrderResponse> {
  return apiRequest<RazorpayOrderResponse>(
    `/payments/${paymentId}/razorpay/order`,
    {
      method: 'POST',
    },
  );
}

export async function verifyRazorpayPayment(
  paymentId: string,
  input: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  },
): Promise<RazorpayVerificationResponse> {
  return apiRequest<RazorpayVerificationResponse>(
    `/payments/${paymentId}/razorpay/verify`,
    {
      method: 'POST',
      body: input,
    },
  );
}
