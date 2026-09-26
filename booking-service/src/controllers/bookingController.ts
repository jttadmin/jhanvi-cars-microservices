import {
  Request,
  Response
} from "express";

import {
  randomUUID
} from "crypto";

import {
  BookingService
} from "../services/bookingService";

import {
  createBookingSchema,
  updateBookingSchema,
  updateBookingStatusSchema
} from "../types/bookingSchema";
import {
  getDriverByUserId
} from "../clients/driverVehicle.client";
export class BookingController {

  constructor(
    private service:
      BookingService
  ) {}

  getAllBookings =
    async (
      req: Request,
      res: Response
    ) => {

      const bookings =
        await this.service
          .getAllBookings();

      if (
        req.internalService ||
        req.auth?.role === "ADMIN"
      ) {
        return res.json(bookings);
      }

      const userId =
        req.auth?.id;

      if (!userId) {
        return res
          .status(401)
          .json({
            message:
              "Unauthorized"
          });
      }

      return res.json(
        bookings.filter(
          booking =>
            booking.userId === userId
        )
      );
    };

  getBookingById =
    async (
      req: Request,
      res: Response
    ) => {

      const id =
        String(req.params.id);

      const booking =
        await this.service
          .getBookingById(id);

      if (!booking) {

        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      if (
        !req.internalService &&
        req.auth?.role !== "ADMIN" &&
        booking.userId !== req.auth?.id
      ) {
        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      return res.json(booking);
    };

  createBooking =
    async (
      req: Request,
      res: Response
    ) => {

      const result =
        createBookingSchema
          .safeParse(req.body);

      if (!result.success) {

        return res
          .status(400)
          .json({
            message:
              "Invalid booking data",

            errors:
              result.error.flatten()
          });
      }

      const userId =
        req.internalService
          ? result.data.userId
          : req.auth?.id;

      if (!userId) {

        return res
          .status(401)
          .json({
            message:
              "Unauthorized"
          });
      }

      const booking =
        await this.service
          .createBooking({

            id:
              randomUUID(),

            ...result.data,

            userId
          });

      return res
        .status(201)
        .json(booking);
    };

  updateBooking =
    async (
      req: Request,
      res: Response
    ) => {

      const id =
        String(req.params.id);

      const existing =
        await this.service
          .getBookingById(id);

      if (!existing) {

        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      if (
        !req.internalService &&
        req.auth?.role !== "ADMIN" &&
        existing.userId !== req.auth?.id
      ) {
        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      const result =
        updateBookingSchema
          .safeParse(req.body);

      if (!result.success) {

        return res
          .status(400)
          .json({
            message:
              "Invalid booking data",

            errors:
              result.error.flatten()
          });
      }

      const data =
        req.internalService
          ? result.data
          : {
              ...result.data,
              userId: existing.userId
            };

      const booking =
        await this.service
          .updateBooking(
            id,
            data
          );

      if (!booking) {

        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      return res.json(booking);
    };

  updateBookingStatus =
    async (
      req: Request,
      res: Response
    ) => {

      const id =
        String(req.params.id);

      const existing =
        await this.service
          .getBookingById(id);

      if (!existing) {

        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      if (
        !req.internalService &&
        req.auth?.role !== "ADMIN" &&
        existing.userId !== req.auth?.id
      ) {
        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      const result =
        updateBookingStatusSchema
          .safeParse(req.body);

      if (!result.success) {

        return res
          .status(400)
          .json({
            message:
              "Invalid booking status",

            errors:
              result.error.flatten()
          });
      }

      if (
        !req.internalService &&
        req.auth?.role !== "ADMIN" &&
        result.data.status !== "CANCELLED"
      ) {
        return res
          .status(403)
          .json({
            message:
              "Customers can only cancel bookings"
          });
      }

      const booking =
        await this.service
          .updateBookingStatus(
            id,
            result.data.status
          );

      if (!booking) {

        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      return res.json(booking);
    };

  acceptBooking =
    async (
      req: Request,
      res: Response
    ) => {

      if (req.auth?.role !== "DRIVER") {
        return res
          .status(403)
          .json({
            message:
              "Only drivers can accept bookings"
          });
      }

      const id =
        String(req.params.id);

      const booking =
        await this.service
          .getBookingById(id);

      if (!booking) {
        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      if (booking.status !== "PENDING") {
        return res
          .status(409)
          .json({
            message:
              `Booking cannot be accepted from ${booking.status} status`
          });
      }

      if (!booking.driverId) {
        return res
          .status(409)
          .json({
            message:
              "Booking has no assigned driver"
          });
      }

      const authenticatedDriverUserId =
        req.auth?.id;

      if (!authenticatedDriverUserId) {
        return res
          .status(401)
          .json({
            message:
              "Unauthorized"
          });
      }

      const driver =
        await getDriverByUserId(
          authenticatedDriverUserId
        );

      if (!driver) {
        return res
          .status(403)
          .json({
            message:
              "Authenticated driver is not registered"
          });
      }

      if (driver.id !== booking.driverId) {
        return res
          .status(403)
          .json({
            message:
              "Booking is assigned to another driver"
          });
      }

      if (!driver.isAvailable) {
        return res
          .status(409)
          .json({
            message:
              "Driver is not available"
          });
      }

      const updated =
        await this.service
          .updateBookingStatus(
            id,
            "CONFIRMED"
          );

      if (!updated) {
        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      return res.json(updated);
    };

  startBooking =
    async (
      req: Request,
      res: Response
    ) => {

      if (req.auth?.role !== "DRIVER") {
        return res
          .status(403)
          .json({
            message:
              "Only drivers can start bookings"
          });
      }

      const id =
        String(req.params.id);

      const booking =
        await this.service
          .getBookingById(id);

      if (!booking) {
        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      if (booking.status !== "CONFIRMED") {
        return res
          .status(409)
          .json({
            message:
              `Booking cannot be started from ${booking.status} status`
          });
      }

      if (!booking.driverId) {
        return res
          .status(409)
          .json({
            message:
              "Booking has no assigned driver"
          });
      }

      const authenticatedDriverUserId =
        req.auth?.id;

      if (!authenticatedDriverUserId) {
        return res
          .status(401)
          .json({
            message:
              "Unauthorized"
          });
      }

      const driver =
        await getDriverByUserId(
          authenticatedDriverUserId
        );

      if (!driver) {
        return res
          .status(403)
          .json({
            message:
              "Authenticated driver is not registered"
          });
      }

      if (driver.id !== booking.driverId) {
        return res
          .status(403)
          .json({
            message:
              "Booking is assigned to another driver"
          });
      }

      if (!driver.isAvailable) {
        return res
          .status(409)
          .json({
            message:
              "Driver is not available"
          });
      }

      const updated =
        await this.service
          .updateBookingStatus(
            id,
            "ONGOING"
          );

      if (!updated) {
        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      return res.json(updated);
    };

  completeBooking =
    async (
      req: Request,
      res: Response
    ) => {

      if (req.auth?.role !== "DRIVER") {
        return res
          .status(403)
          .json({
            message:
              "Only drivers can complete bookings"
          });
      }

      const id =
        String(req.params.id);

      const booking =
        await this.service
          .getBookingById(id);

      if (!booking) {
        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      if (booking.status !== "ONGOING") {
        return res
          .status(409)
          .json({
            message:
              `Booking cannot be completed from ${booking.status} status`
          });
      }

      if (!booking.driverId) {
        return res
          .status(409)
          .json({
            message:
              "Booking has no assigned driver"
          });
      }

      const authenticatedDriverUserId =
        req.auth?.id;

      if (!authenticatedDriverUserId) {
        return res
          .status(401)
          .json({
            message:
              "Unauthorized"
          });
      }

      const driver =
        await getDriverByUserId(
          authenticatedDriverUserId
        );

      if (!driver) {
        return res
          .status(403)
          .json({
            message:
              "Authenticated driver is not registered"
          });
      }

      if (driver.id !== booking.driverId) {
        return res
          .status(403)
          .json({
            message:
              "Booking is assigned to another driver"
          });
      }

      const updated =
        await this.service
          .updateBookingStatus(
            id,
            "COMPLETED"
          );

      if (!updated) {
        return res
          .status(404)
          .json({
            message:
              "Booking not found"
          });
      }

      return res.json(updated);
    };
}
