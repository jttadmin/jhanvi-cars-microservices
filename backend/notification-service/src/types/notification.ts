export type NotificationChannel = "EMAIL" | "SMS" | "PUSH";

export type NotificationStatus = "PENDING" | "SENT" | "FAILED" | "READ";

export interface Notification {
  id: string;
  userId: string;
  bookingId?: string | null;
  channel: NotificationChannel;
  title: string;
  message: string;
  status: NotificationStatus;
  recipient: string;
  idempotencyKey?: string | null;
  attemptCount?: number;
  nextAttemptAt?: string | null;
  lastError?: string | null;
  createdAt?: string;
  updatedAt?: string;
}
