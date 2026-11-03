
import { randomInt } from "crypto";

import {
  Booking,
  BookingStatus
} from "../types/booking";

import {
  BookingRepository
} from "../repositories/bookingRepository";

import { FareService } from "./fareService";

import {
  validateDriverAndVehicle,
  validateDriverAndVehicleForAssignment,
  syncDriverVehicleForBooking,
  findNearbyDrivers,
  createRideRequest,
  getRideRequestDriverIds
} from "../clients/driverVehicle.client";

import {
  getPaymentByBookingId,
  refundPayment
} from "../clients/payment.client";

import {
  notifyBookingCreated,
  notifyBookingStatus
} from "../clients/notification.client";

import {
  validateBookingStatusTransition
} from "./bookingStatus";

import { BookingError } from "../errors/BookingError";

export class BookingService {
  constructor(
    private repository: BookingRepository,
    private fareService?: FareService
  ) {}

  /*
   * The fare always comes from the admin-managed fare rules, never from
   * the client: minimum fare + per-km beyond the minimum distance, night
   * surcharge and GST for the booked category and pickup time.
   */
  private async priceBooking(
    booking: Booking,
    trustClientFare: boolean
  ): Promise<Pick<Booking, "fare" | "distanceKm">> {
    // Internal services and admins may still book at an explicit fare
    // (e.g. smoke tests, manual corporate bookings) when no distance is given.
    const explicitFare =
      trustClientFare &&
      booking.distanceKm == null &&
      typeof booking.fare === "number";

    if (!this.fareService || explicitFare) {
      return { fare: booking.fare, distanceKm: booking.distanceKm ?? null };
    }

    if (!booking.vehicleType) {
      throw new BookingError(400, "vehicleType is required", "VEHICLE_TYPE_REQUIRED");
    }

    if (!(Number(booking.distanceKm) > 0)) {
      throw new BookingError(
        400,
        "distanceKm is required to calculate the fare",
        "DISTANCE_REQUIRED"
      );
    }

    const quote = await this.fareService.quote(
      booking.vehicleType,
      Number(booking.distanceKm),
      new Date(booking.scheduledAt)
    );

    return { fare: quote.total, distanceKm: quote.distanceKm };
  }

  private async sendNotificationSafely(
    action: string,
    userId: string,
    bookingId: string,
    status?: string
  ): Promise<void> {
    try {
      if (status) {
        await notifyBookingStatus(userId, bookingId, status);
      } else {
        await notifyBookingCreated(userId, bookingId);
      }
    } catch (error) {
      console.error(
        `${action} notification failed:`,
        error instanceof Error ? error.message : "Unknown error"
      );
    }
  }

  async getAllBookings(): Promise<Booking[]> {
    return this.repository.findAll();
  }

  async getBookingById(id: string): Promise<Booking | undefined> {
    return this.repository.findById(id);
  }

  /*
   * Adds the start-ride OTP to bookings the customer still needs it for.
   * Only call this for responses going to the booking's own customer.
   */
  async withStartOtpForCustomer(
    bookings: Booking[]
  ): Promise<Booking[]> {
    const needsOtp = bookings.filter((b) =>
      OTP_VISIBLE_STATUSES.includes(b.status)
    );

    const otps = await this.repository.getStartOtps(
      needsOtp.map((b) => b.id)
    );

    // Bookings created before OTPs existed get one the first time
    // the customer looks at them.
    for (const booking of needsOtp) {
      if (!otps.has(booking.id)) {
        const otp = generateStartOtp();
        await this.repository.setStartOtp(booking.id, otp);
        otps.set(booking.id, otp);
      }
    }

    return bookings.map((b) =>
      otps.has(b.id) && OTP_VISIBLE_STATUSES.includes(b.status)
        ? { ...b, startOtp: otps.get(b.id) }
        : b
    );
  }

  async verifyStartOtp(
    bookingId: string,
    otp: unknown
  ): Promise<void> {
    if (typeof otp !== "string" || !/^\d{4}$/.test(otp.trim())) {
      throw new BookingError(
        400,
        "Enter the 4-digit OTP from the customer",
        "START_OTP_REQUIRED"
      );
    }

    const result = await this.repository.checkStartOtp(
      bookingId,
      otp.trim(),
      MAX_START_OTP_ATTEMPTS,
      generateStartOtp
    );

    if (result === "OK") {
      return;
    }

    if (result === "MISSING") {
      throw new BookingError(
        409,
        "The customer has no OTP yet. Ask them to open their ride in the app, then try again.",
        "START_OTP_MISSING"
      );
    }

    if (result === "ROTATED") {
      throw new BookingError(
        400,
        "Too many wrong attempts. A new OTP has been sent to the customer's app. Ask them for the new code.",
        "START_OTP_ROTATED"
      );
    }

    throw new BookingError(
      400,
      "Incorrect OTP. Check the code with the customer.",
      "START_OTP_INVALID"
    );
  }

  async getBookingsByDriverId(driverId: string): Promise<Booking[]> {
    return this.repository.findByDriverId(driverId);
  }

  async getDriverEarnings(driverId: string): Promise<{
    totalTrips: number;
    totalEarnings: number;
    todayTrips: number;
    todayEarnings: number;
    weekTrips: number;
    weekEarnings: number;
  }> {
    return this.repository.getDriverEarnings(driverId);
  }

  async createBooking(
    booking: Booking,
    options: { trustClientFare?: boolean } = {}
  ): Promise<Booking> {
    if (booking.driverId) {
      await validateDriverAndVehicle(booking.driverId);
    }

    const createdBooking = await this.repository.create({
      ...booking,
      ...(await this.priceBooking(booking, options.trustClientFare === true)),
      status: "PENDING",
      startOtp: generateStartOtp()
    });

    if (
      !createdBooking.driverId &&
      createdBooking.pickupLatitude != null &&
      createdBooking.pickupLongitude != null
    ) {
      const nearbyDrivers = await findNearbyDrivers(
        createdBooking.pickupLatitude,
        createdBooking.pickupLongitude,
        5,
        10
      );

      const nearestDriver = nearbyDrivers[0];

      if (nearestDriver) {
        await createRideRequest(
          createdBooking.id,
          nearestDriver.driverId,
          createdBooking.pickupLatitude,
          createdBooking.pickupLongitude,
          300
        );
      }
    }

    await this.sendNotificationSafely(
      "Booking-created",
      createdBooking.userId,
      createdBooking.id
    );

    return createdBooking;
  }

  async updateBooking(
    id: string,
    data: Omit<Booking, "id" | "status">
  ): Promise<Booking | undefined> {
    const existing = await this.repository.findById(id);

    if (!existing) {
      return undefined;
    }

    /*
     * A confirmed or active booking must not lose or change
     * its assigned driver through the generic update endpoint.
     */
    if (
      ["CONFIRMED", "ONGOING", "COMPLETED"].includes(existing.status) &&
      data.driverId !== existing.driverId
    ) {
      throw new BookingError(
        409,
        "Cannot change the assigned driver for a confirmed or active booking",
        "DRIVER_REASSIGNMENT_NOT_ALLOWED"
      );
    }

    if (data.driverId) {
      await validateDriverAndVehicle(data.driverId);
    }

    return this.repository.update(id, {
      id,
      ...data,
      distanceKm: data.distanceKm ?? existing.distanceKm ?? null,
      status: existing.status
    });
  }

  async confirmBookingFromDriver(
    bookingId: string,
    driverId: string
  ): Promise<Booking | undefined> {
    const existing = await this.repository.findById(bookingId);

    if (!existing) {
      return undefined;
    }

    /*
     * Repeated acceptance by the same driver is idempotent.
     */
    if (
      existing.status === "CONFIRMED" &&
      existing.driverId === driverId
    ) {
      return existing;
    }

    if (existing.status !== "PENDING") {
      throw new BookingError(
        409,
        `Booking cannot be confirmed from status ${existing.status}`,
        "BOOKING_NOT_PENDING"
      );
    }

    await validateDriverAndVehicleForAssignment(driverId);

    const claimed = await this.repository.claimPendingBooking(
      bookingId,
      driverId
    );

    if (claimed === undefined) {
      const latest = await this.repository.findById(bookingId);

      if (
        latest?.status === "CONFIRMED" &&
        latest.driverId === driverId
      ) {
        return latest;
      }

      throw new BookingError(
        409,
        "Booking has already been claimed by another driver",
        "BOOKING_ALREADY_CLAIMED"
      );
    }

    await this.sendNotificationSafely(
      "Booking-confirmed",
      claimed.userId,
      claimed.id,
      claimed.status
    );

    return claimed;
  }

  private async dispatchNextDriver(
    booking: Booking,
    excludedDriverId: string
  ): Promise<void> {
    if (
      booking.pickupLatitude == null ||
      booking.pickupLongitude == null
    ) {
      return;
    }

    const previouslyOffered = await getRideRequestDriverIds(booking.id);

    const nearbyDrivers = await findNearbyDrivers(
      booking.pickupLatitude,
      booking.pickupLongitude,
      5,
      10
    );

    const nextDriver = nearbyDrivers.find(
      driver =>
        !previouslyOffered.includes(driver.driverId) &&
        driver.driverId !== excludedDriverId
    );

    if (!nextDriver) {
      return;
    }

    await createRideRequest(
      booking.id,
      nextDriver.driverId,
      booking.pickupLatitude,
      booking.pickupLongitude,
      300
    );
  }

  async handleDriverRejected(
    bookingId: string,
    driverId: string
  ): Promise<Booking | undefined> {
    return this.repository.withDispatchLock(
      bookingId,
      async () => {
        const existing = await this.repository.findById(bookingId);

        if (!existing || existing.status !== "PENDING") {
          return existing;
        }

        await this.dispatchNextDriver(existing, driverId);
        return existing;
      }
    );
  }

  async handleDriverExpired(
    bookingId: string,
    driverId: string
  ): Promise<Booking | undefined> {
    return this.repository.withDispatchLock(
      bookingId,
      async () => {
        const existing = await this.repository.findById(bookingId);

        if (!existing || existing.status !== "PENDING") {
          return existing;
        }

        await this.dispatchNextDriver(existing, driverId);
        return existing;
      }
    );
  }

  async updateBookingStatus(
    id: string,
    status: BookingStatus
  ): Promise<Booking | undefined> {
    const existing = await this.repository.findById(id);

    if (!existing) {
      return undefined;
    }

    if (status === "CONFIRMED" && !existing.driverId) {
      throw new BookingError(
        409,
        "Cannot confirm a booking without an assigned driver",
        "DRIVER_ASSIGNMENT_REQUIRED"
      );
    }

    validateBookingStatusTransition(existing.status, status);

    /*
     * Refund a paid payment before cancelling a confirmed booking.
     */
    if (
      existing.status === "CONFIRMED" &&
      status === "CANCELLED"
    ) {
      const payment = await getPaymentByBookingId(id);

      if (payment && payment.status === "PAID") {
        await refundPayment(payment.id);
      }
    }

    if (
      existing.status === "CONFIRMED" &&
      status === "ONGOING" &&
      existing.driverId
    ) {
      await syncDriverVehicleForBooking(
        id,
        existing.driverId,
        "START_TRIP"
      );
    }

    if (
      existing.status === "ONGOING" &&
      status === "COMPLETED" &&
      existing.driverId
    ) {
      await syncDriverVehicleForBooking(
        id,
        existing.driverId,
        "END_TRIP"
      );
    }

    if (
      existing.status === "CONFIRMED" &&
      status === "CANCELLED" &&
      existing.driverId
    ) {
      await syncDriverVehicleForBooking(
        id,
        existing.driverId,
        "CANCEL_TRIP"
      );
    }

    const updatedBooking = await this.repository.update(id, {
      ...existing,
      status
    });

    if (
      updatedBooking &&
      updatedBooking.status !== existing.status
    ) {
      await this.sendNotificationSafely(
        `Booking-${updatedBooking.status.toLowerCase()}`,
        updatedBooking.userId,
        updatedBooking.id,
        updatedBooking.status
      );
    }

    return updatedBooking;
  }
}

const MAX_START_OTP_ATTEMPTS = 5;

const OTP_VISIBLE_STATUSES: BookingStatus[] = ["PENDING", "CONFIRMED"];

function generateStartOtp(): string {
  return randomInt(0, 10000).toString().padStart(4, "0");
}
