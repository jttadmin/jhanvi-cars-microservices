import { apiRequest } from './client';

export type PaymentMethod = 'CASH' | 'CARD' | 'UPI' | 'WALLET';

export type PaymentStatus =
  | 'PENDING'
  | 'AUTHORIZED'
  | 'PAID'
  | 'FAILED'
  | 'REFUNDED';

export interface AdminPayment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  method: PaymentMethod;
  status: PaymentStatus;
  transactionId?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export async function getAdminPayments(): Promise<AdminPayment[]> {
  return apiRequest<AdminPayment[]>('/payments');
}
