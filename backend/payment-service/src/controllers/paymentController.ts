import { Request, Response } from "express";
import { randomUUID } from "crypto";
import { z } from "zod";
import { paymentService } from "../services/paymentService";

const paymentMethodSchema =
  z.enum(["CASH", "CARD", "UPI", "WALLET"]);

const paymentStatusSchema =
  z.enum([
    "PENDING",
    "AUTHORIZED",
    "PAID",
    "FAILED",
    "REFUNDED"
  ]);

const createPaymentSchema = z.object({
  bookingId: z.string().min(1),
  userId: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/).default("INR"),
  method: paymentMethodSchema,
  status: paymentStatusSchema.default("PENDING"),
  transactionId: z.string().min(1).nullable().optional()
});

const updatePaymentSchema = z.object({
  bookingId: z.string().min(1),
  userId: z.string().min(1),
  amount: z.number().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  method: paymentMethodSchema,
  transactionId: z.string().min(1).nullable().optional()
});

const updateStatusSchema = z.object({
  status: paymentStatusSchema
});

export const paymentController = {

  health: async (_req: Request, res: Response) => {
    res.json({
      service: "payment-service",
      status: "UP",
      database: "UP"
    });
  },

  getAll: async (req: Request, res: Response) => {
    const payments =
      await paymentService.getAll();

    if (
      req.internalService ||
      req.auth?.role === "ADMIN"
    ) {
      return res.json(payments);
    }

    const userId = req.auth?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    return res.json(
      payments.filter(
        payment => payment.userId === userId
      )
    );
  },

  getById: async (
    req: Request,
    res: Response
  ) => {

    const payment =
      await paymentService.getById(
        String(req.params.id)
      );

    if (
      !req.internalService &&
      req.auth?.role !== "ADMIN" &&
      payment.userId !== req.auth?.id
    ) {
      return res.status(404).json({
        message: "Payment not found"
      });
    }

    return res.json(payment);
  },

  getByBookingId: async (
    req: Request,
    res: Response
  ) => {

    const payment =
      await paymentService.getByBookingId(
        String(req.params.bookingId)
      );

    if (!payment) {
      return res.status(404).json({
        message: "Payment not found for booking"
      });
    }

    if (
      !req.internalService &&
      req.auth?.role !== "ADMIN" &&
      payment.userId !== req.auth?.id
    ) {
      return res.status(404).json({
        message: "Payment not found for booking"
      });
    }

    return res.json(payment);
  },

  create: async (
    req: Request,
    res: Response
  ) => {

    const parsed =
      createPaymentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    /*
     * Internal callers may provide the userId.
     *
     * External authenticated users cannot choose
     * another user's ID. Their JWT identity wins.
     */
    const userId =
      req.internalService
        ? parsed.data.userId
        : req.auth?.id;

    if (!userId) {
      return res.status(401).json({
        message: "Unauthorized"
      });
    }

    const payment =
      await paymentService.create({
        id: randomUUID(),
        ...parsed.data,
        userId
      });

    return res.status(201).json(payment);
  },

  createRazorpayOrder: async (
    req: Request,
    res: Response
  ) => {
    const id = String(req.params.id);

    const payment =
      await paymentService.getById(id);

    if (
      !req.internalService &&
      req.auth?.role !== "ADMIN" &&
      payment.userId !== req.auth?.id
    ) {
      return res.status(404).json({
        message: "Payment not found"
      });
    }

    const order =
      await paymentService.createRazorpayOrder(id);

    return res.status(201).json(order);
  },

  verifyRazorpayPayment: async (
    req: Request,
    res: Response
  ) => {
    const id = String(req.params.id);

    const payment =
      await paymentService.getById(id);

    /*
     * Customers can only verify their own payments.
     */
    if (
      !req.internalService &&
      req.auth?.role !== "ADMIN" &&
      payment.userId !== req.auth?.id
    ) {
      return res.status(404).json({
        message: "Payment not found"
      });
    }

    const {
      razorpayOrderId,
      razorpayPaymentId,
      razorpaySignature
    } = req.body;

    if (
      typeof razorpayOrderId !== "string" ||
      typeof razorpayPaymentId !== "string" ||
      typeof razorpaySignature !== "string"
    ) {
      return res.status(400).json({
        message:
          "razorpayOrderId, razorpayPaymentId and razorpaySignature are required"
      });
    }

    const verifiedPayment =
      await paymentService.verifyRazorpayPayment(
        id,
        razorpayOrderId,
        razorpayPaymentId,
        razorpaySignature
      );

    return res.json(verifiedPayment);
  },

  update: async (
    req: Request,
    res: Response
  ) => {

    const id =
      String(req.params.id);

    const existing =
      await paymentService.getById(id);

    if (
      !req.internalService &&
      req.auth?.role !== "ADMIN" &&
      existing.userId !== req.auth?.id
    ) {
      return res.status(404).json({
        message: "Payment not found"
      });
    }

    const parsed =
      updatePaymentSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    /*
     * Prevent normal users from transferring
     * ownership of a payment.
     */
    const data = {
      ...parsed.data,
      userId:
        req.internalService
          ? parsed.data.userId
          : existing.userId,
      transactionId:
        req.internalService
          ? parsed.data.transactionId
          : existing.transactionId
    };

    return res.json(
      await paymentService.update(
        id,
        data
      )
    );
  },

  updateStatus: async (
    req: Request,
    res: Response
  ) => {

    /*
     * Payment status changes are internal operations.
     * Customers must never be able to mark their own
     * payment as PAID or REFUNDED.
     */
    if (!req.internalService) {
      return res.status(403).json({
        message:
          "Payment status can only be changed by an internal service"
      });
    }

    const parsed =
      updateStatusSchema.safeParse(req.body);

    if (!parsed.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: parsed.error.flatten()
      });
    }

    return res.json(
      await paymentService.updateStatus(
        String(req.params.id),
        parsed.data.status
      )
    );
  }
};
