import {
  notificationRepository
} from "../repositories/notificationRepository";

import {
  Notification,
  NotificationStatus
} from "../types/notification";

export const notificationService = {

  getAll: () =>
    notificationRepository.findAll(),

  getById: async (id: string) => {
    const notification =
      await notificationRepository.findById(id);

    if (!notification) {
      const error = new Error("Notification not found");
      (error as any).statusCode = 404;
      throw error;
    }

    return notification;
  },

  create: (notification: Notification) =>
    notificationRepository.create(notification),

  update: async (
    id: string,
    data: Omit<
      Notification,
      "id" | "status" | "createdAt" | "updatedAt"
    >
  ) => {
    const notification =
      await notificationRepository.update(id, data);

    if (!notification) {
      const error = new Error("Notification not found");
      (error as any).statusCode = 404;
      throw error;
    }

    return notification;
  },

  updateStatus: async (
    id: string,
    status: NotificationStatus
  ) => {
    const notification =
      await notificationRepository.updateStatus(
        id,
        status
      );

    if (!notification) {
      const error = new Error("Notification not found");
      (error as any).statusCode = 404;
      throw error;
    }

    return notification;
  }
};
