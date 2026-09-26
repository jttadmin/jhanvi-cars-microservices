export type NotificationChannel =
  | "EMAIL"
  | "SMS"
  | "PUSH";

export type NotificationStatus =
  | "PENDING"
  | "SENT"
  | "FAILED"
  | "READ";

export interface Notification {
  id: string;
  userId: string;
  bookingId?: string | null;
  channel: NotificationChannel;
  title: string;
  message: string;
  status: NotificationStatus;
  recipient: string;
  createdAt?: string;
  updatedAt?: string;
}
