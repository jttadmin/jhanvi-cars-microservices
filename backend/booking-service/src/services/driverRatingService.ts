import {
  randomUUID
} from "crypto";

import {
  DriverRating
} from "../types/driverRating";

import {
  DriverRatingRepository
} from "../repositories/driverRatingRepository";

import {
  BookingRepository
} from "../repositories/bookingRepository";

import {
  BookingError
} from "../errors/BookingError";

export class DriverRatingService {

  constructor(
    private ratingRepository:
      DriverRatingRepository,

    private bookingRepository:
      BookingRepository
  ) {}

  async createRating(
    bookingId: string,
    customerId: string,
    rating: number,
    comment?: string
  ): Promise<DriverRating> {

    const booking =
      await this.bookingRepository
        .findById(bookingId);

    if (!booking) {
      throw new BookingError(
        404,
        "Booking not found"
      );
    }

    if (
      booking.userId !==
      customerId
    ) {
      throw new BookingError(
        403,
        "Only the customer who made the booking can rate the driver"
      );
    }

    if (
      booking.status !==
      "COMPLETED"
    ) {
      throw new BookingError(
        409,
        "Only completed bookings can be rated"
      );
    }

    if (!booking.driverId) {
      throw new BookingError(
        409,
        "Booking has no assigned driver"
      );
    }

    const existing =
      await this.ratingRepository
        .findByBookingId(
          bookingId
        );

    if (existing) {
      throw new BookingError(
        409,
        "Booking has already been rated"
      );
    }

    if (
      !Number.isInteger(rating) ||
      rating < 1 ||
      rating > 5
    ) {
      throw new BookingError(
        400,
        "Rating must be an integer between 1 and 5"
      );
    }

    return this.ratingRepository
      .create({
        id:
          randomUUID(),

        bookingId,

        customerId,

        driverId:
          booking.driverId,

        rating,

        comment:
          comment ?? null
      });
  }

  async getDriverRatings(
    driverId: string
  ): Promise<DriverRating[]> {

    return this.ratingRepository
      .findByDriverId(driverId);
  }
}
