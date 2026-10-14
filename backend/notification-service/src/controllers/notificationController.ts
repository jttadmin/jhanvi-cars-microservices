import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";

import {
  notificationService
} from "../services/notificationService";

const channelSchema =
  z.enum(["EMAIL", "SMS", "PUSH"]);

const statusSchema =
  z.enum([
    "PENDING",
    "SENT",
    "FAILED",
    "READ"
  ]);

const createNotificationSchema = z.object({
  userId: z.string().min(1),
  bookingId: z.string().min(1).nullable().optional(),
  channel: channelSchema,
  title: z.string().min(1).max(200),
  message: z.string().min(1).max(5000),
  status: statusSchema.default("PENDING"),
  recipient: z.string().min(1).max(320),
  idempotencyKey: z.string().min(1).max(200).optional()
});

const updateNotificationSchema = z.object({
  userId: z.string().min(1),
  bookingId: z.string().min(1).nullable().optional(),
  channel: channelSchema,
  title: z.string().min(1).max(2000),
  message: z.string().min(1).max(5000),
  recipient: z.string().min(1).max(320)
});

const updateStatusSchema = z.object({
  status: statusSchema
});

export const notificationController = {

  health: async (_req: Request, res: Response) => {
    res.json({
      service: "notification-service",
      status: "UP",
      database: "UP"
    });
  },

  getAll: async (
    req: Request,
    res: Response
  ) => {
    const userId = req.auth?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    const notifications =
      await notificationService.getAll();

    return res.json(
      notifications.filter(
        notification =>
          notification.userId === userId
      )
    );
  },

  getById: async (
    req: Request,
    res: Response
  ) => {
    const userId = req.auth?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    const notification =
      await notificationService.getById(
        String(req.params.id)
      );

    if (
      notification.userId !== userId
    ) {
      return res.status(404).json({
        message: "Notification not found"
      });
    }

    return res.json(notification);
  },

  create: async (
    req: Request,
    res: Response
  ) => {
    const parsed =
      createNotificationSchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    const notification =
      await notificationService.create({
        id: randomUUID(),
        ...parsed.data
      });

    return res.status(201).json(notification);
  },

  update: async (
    req: Request,
    res: Response
  ) => {
    const parsed =
      updateNotificationSchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    return res.json(
      await notificationService.update(
        String(req.params.id),
        parsed.data
      )
    );
  },

  updateStatus: async (
    req: Request,
    res: Response
  ) => {
    const parsed =
      updateStatusSchema.safeParse(
        req.body
      );

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    return res.json(
      await notificationService.updateStatus(
        String(req.params.id),
        parsed.data.status
      )
    );
  }
};
