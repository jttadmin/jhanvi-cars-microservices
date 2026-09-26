import {
  Booking,
  BookingStatus
} from "../types/booking";

import {
  BookingRepository
} from "../repositories/bookingRepository";

import {
  validateDriverAndVehicle,
  syncDriverVehicleForBooking
} from "../clients/driverVehicle.client";

import {
  validateBookingStatusTransition
} from "./bookingStatus";

import {
  getPaymentByBookingId,
  refundPayment
} from "../clients/payment.client";

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

  async createBooking(
    booking: Booking
  ): Promise<Booking> {

    if (booking.driverId) {
      await validateDriverAndVehicle(
        booking.driverId
      );
    }

    return this.repository.create({
	...booking,
       status: "PENDING"
    });
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
