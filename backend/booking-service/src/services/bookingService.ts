import {
  Booking,
  BookingStatus
} from "../types/booking";

import {
  BookingRepository
} from "../repositories/bookingRepository";

import {
  validateDriverAndVehicle,
  validateDriverAndVehicleForAssignment,
  syncDriverVehicleForBooking,
  findNearbyDrivers,
  createRideRequest,
  getRideRequestDriverIds
} from "../clients/driverVehicle.client";

import {
  validateBookingStatusTransition
} from "./bookingStatus";

import {
  getPaymentByBookingId,
  refundPayment
} from "../clients/payment.client";

import { BookingError } from "../errors/BookingError";

export class BookingService {

  constructor(
    private repository:
      BookingRepository
  ) {}

  async getAllBookings():
    Promise<Booking[]> {

    return this.repository
      .findAll();
  }

  async getBookingById(
    id: string
  ):
    Promise<
      Booking | undefined
    > {

    return this.repository
      .findById(id);
  }

  async getBookingsByDriverId(
    driverId: string
  ): Promise<Booking[]> {

    return this.repository
      .findByDriverId(driverId);
  }

  async getDriverEarnings(
    driverId: string
  ): Promise<{
    totalTrips: number;
    totalEarnings: number;
    todayTrips: number;
    todayEarnings: number;
    weekTrips: number;
    weekEarnings: number;
  }> {

    return this.repository
      .getDriverEarnings(driverId);
  }

  async createBooking(
    booking: Booking
  ): Promise<Booking> {

    if (booking.driverId) {
      await validateDriverAndVehicle(
        booking.driverId
      );
    }

    const createdBooking =
      await this.repository.create({
        ...booking,
        status: "PENDING"
      });

    if (
      !createdBooking.driverId &&
      createdBooking.pickupLatitude != null &&
      createdBooking.pickupLongitude != null
    ) {
      const nearbyDrivers =
        await findNearbyDrivers(
          createdBooking.pickupLatitude,
          createdBooking.pickupLongitude,
          5,
          10
        );

      const nearestDriver =
        nearbyDrivers[0];

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

    return createdBooking;
  }

  async updateBooking(
    id: string,

    data: Omit<
      Booking,
      "id" | "status"
    >
  ):
    Promise<
      Booking | undefined
    > {

    const existing =
      await this.repository
        .findById(id);

    if (!existing) {
      return undefined;
    }

    /*
     * A confirmed or active booking must not lose or change
     * its assigned driver through the generic update endpoint.
     * Reassignment requires a dedicated, coordinated workflow.
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
      await validateDriverAndVehicle(
        data.driverId
      );
    }

    return this.repository.update(
      id,
      {
        id,

        ...data,

        status:
          existing.status
      }
    );
  }

  async confirmBookingFromDriver(
    bookingId: string,
    driverId: string
  ): Promise<Booking | undefined> {

    const existing =
      await this.repository.findById(bookingId);

    if (!existing) {
      return undefined;
    }

    /*
     * Idempotency:
     * if the same driver callback is delivered again
     * after confirmation, return the already-confirmed booking.
     */
    if (
      existing.status === "CONFIRMED" &&
      existing.driverId === driverId
    ) {
      return existing;
    }

    /*
     * Only a pending booking can be claimed by
     * the driver acceptance workflow.
     */
    if (existing.status !== "PENDING") {
      throw new BookingError(
        409,
        `Booking cannot be confirmed from status ${existing.status}`,
        "BOOKING_NOT_PENDING"
      );
    }

    /*
     * Validate the driver before assigning the booking.
     */
    await validateDriverAndVehicleForAssignment(
      driverId
    );

    const claimed =
      await this.repository.claimPendingBooking(
        bookingId,
        driverId
      );

    if (claimed === undefined) {
      // Another acceptance may have claimed the booking
      // after our initial read.
      const latest =
        await this.repository.findById(bookingId);

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

    const previouslyOffered =
      await getRideRequestDriverIds(booking.id);

    const nearbyDrivers =
      await findNearbyDrivers(
        booking.pickupLatitude,
        booking.pickupLongitude,
        5,
        10
      );

    const nextDriver =
      nearbyDrivers.find(
        (driver) =>
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
        // Re-read after locking so concurrent callbacks see the latest state.
        const existing =
          await this.repository.findById(bookingId);

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
        // Re-read after locking so concurrent callbacks see the latest state.
        const existing =
          await this.repository.findById(bookingId);

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
  ):
    Promise<
      Booking | undefined
    > {

    const existing =
      await this.repository
        .findById(id);

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

    validateBookingStatusTransition(
      existing.status,
      status
    );

    /*
     * Confirmed -> Cancelled:
     * refund a PAID payment before cancelling.
     */
    if (
      existing.status === "CONFIRMED" &&
      status === "CANCELLED"
    ) {
      const payment =
        await getPaymentByBookingId(id);

      if (
        payment &&
        payment.status === "PAID"
      ) {
        await refundPayment(payment.id);
      }
    }

    /*
     * Confirmed -> Ongoing:
     * reserve the driver and vehicle for the active trip.
     */
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

    /*
     * Ongoing -> Completed:
     * release the driver and vehicle.
     */
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

    /*
     * Confirmed -> Cancelled:
     * release the driver and vehicle.
     */
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

    return this.repository.update(
      id,
      {
        ...existing,
        status
      }
    );
  }
}
