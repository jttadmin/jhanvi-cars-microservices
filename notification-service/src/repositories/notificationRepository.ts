import db from "../database";
import {
  Notification,
  NotificationChannel,
  NotificationStatus
} from "../types/notification";

type NotificationRow = {
  id: string;
  user_id: string;
  booking_id: string | null;
  channel: NotificationChannel;
  title: string;
  message: string;
  status: NotificationStatus;
  recipient: string;
  created_at?: Date | string;
  updated_at?: Date | string;
};

const mapRow = (row: NotificationRow): Notification => ({
  id: row.id,
  userId: row.user_id,
  bookingId: row.booking_id,
  channel: row.channel,
  title: row.title,
  message: row.message,
  status: row.status,
  recipient: row.recipient,
  createdAt: row.created_at?.toString(),
  updatedAt: row.updated_at?.toString()
});

export const notificationRepository = {
  async findAll() {
    const rows = await db<NotificationRow>("notifications")
      .select("*")
      .orderBy("created_at", "desc");

    return rows.map(mapRow);
  },

  async findById(id: string) {
    const row = await db<NotificationRow>("notifications")
      .where({ id })
      .first();

    return row ? mapRow(row) : null;
  },

  async create(notification: Notification) {
    const [row] = await db<NotificationRow>("notifications")
      .insert({
        id: notification.id,
        user_id: notification.userId,
        booking_id: notification.bookingId ?? null,
        channel: notification.channel,
        title: notification.title,
        message: notification.message,
        status: notification.status,
        recipient: notification.recipient
      })
      .returning("*");

    return mapRow(row);
  },

  async update(
    id: string,
    data: Omit<
      Notification,
      "id" | "status" | "createdAt" | "updatedAt"
    >
  ) {
    const [row] = await db<NotificationRow>("notifications")
      .where({ id })
      .update({
        user_id: data.userId,
        booking_id: data.bookingId ?? null,
        channel: data.channel,
        title: data.title,
        message: data.message,
        recipient: data.recipient,
        updated_at: db.fn.now()
      })
      .returning("*");

    return row ? mapRow(row) : null;
  },

  async updateStatus(
    id: string,
    status: NotificationStatus
  ) {
    const [row] = await db<NotificationRow>("notifications")
      .where({ id })
      .update({
        status,
        updated_at: db.fn.now()
      })
      .returning("*");

    return row ? mapRow(row) : null;
  }
};
