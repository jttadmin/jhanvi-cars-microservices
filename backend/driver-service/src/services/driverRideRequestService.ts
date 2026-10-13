import { DriverRideRequestRepository } from "../repositories/driverRideRequestRepository";
import { DriverRideRequest } from "../types/driverRideRequest";
import {
  BookingServiceError,
  getBookingAcceptanceState,
  notifyBookingAccepted,
  notifyBookingRejected,
  notifyBookingExpired,
} from "../clients/booking.client";
import { validateDriverVehicleAssignment } from "../clients/vehicle.client";

export class DriverRideRequestService {
  constructor(
    private readonly rideRequestRepository: DriverRideRequestRepository,
    private readonly validateVehicle = validateDriverVehicleAssignment
  ) {}

  async createRideRequest(input: {
    bookingId: string;
    driverId: string;
    pickupLatitude: number;
    pickupLongitude: number;
    expiresInSeconds?: number;
  }): Promise<DriverRideRequest> {
    const expiresInSeconds = input.expiresInSeconds ?? 30;

    const expiresAt = new Date(
      Date.now() + expiresInSeconds * 1000
    );

    return this.rideRequestRepository.createRideRequest({
      bookingId: input.bookingId,
      driverId: input.driverId,
      pickupLatitude: input.pickupLatitude,
      pickupLongitude: input.pickupLongitude,
      expiresAt,
    });
  }

  async getDriverIdsByBookingId(
    bookingId: string
  ): Promise<string[]> {
    return this.rideRequestRepository.findDriverIdsByBookingId(
      bookingId
    );
  }

  async getDriverRideRequests(
    driverId: string
  ): Promise<DriverRideRequest[]> {
    return this.rideRequestRepository.findByDriverId(driverId);
  }

  async acceptRideRequest(
    id: string,
    driverId: string
  ): Promise<DriverRideRequest> {
    // Validate assignment before changing ride-request or driver state.
    await this.validateVehicle(driverId);

    const request =
      await this.rideRequestRepository.acceptRideRequest(
        id,
        driverId
      );

    if (!request) {
      throw new Error(
        "Ride request is unavailable, expired, already handled, or driver is not available"
      );
    }

    try {
      await notifyBookingAccepted(
        request.bookingId,
        request.driverId
      );
    } catch (error) {
      // A conflict response is definitive: another driver won the claim.
      if (
        error instanceof BookingServiceError &&
        error.isCompetingDriverConflict
      ) {
        try {
          const cancelled =
            await this.rideRequestRepository.cancelConflictingAcceptance(
              request.id,
              request.driverId
            );

          if (!cancelled) {
            throw new Error("Could not cancel the conflicting ride request");
          }
        } catch (cleanupError) {
          console.error(
            "Failed to clean up conflicting ride acceptance",
            {
              rideRequestId: request.id,
              bookingId: request.bookingId,
              driverId: request.driverId,
              error: cleanupError,
            }
          );

          throw new Error(
            "Another driver claimed the booking, but ride request cleanup failed; manual reconciliation is required"
          );
        }

        throw new BookingServiceError(
          "Booking has already been claimed by another driver; your ride request was cancelled",
          409,
          true
        );
      }

      // The response may have been lost after the booking was committed.
      // Verify the authoritative booking state before deciding what to do.
      let booking: Awaited<ReturnType<typeof getBookingAcceptanceState>>;

      try {
        booking = await getBookingAcceptanceState(request.bookingId);
      } catch (verificationError) {
        console.error(
          "Could not reconcile booking acceptance; leaving driver unavailable",
          {
            rideRequestId: request.id,
            bookingId: request.bookingId,
            driverId: request.driverId,
            error: verificationError,
          }
        );

        // Preserve the original error when the outcome cannot be verified.
        throw error;
      }

      if (
        booking.status === "CONFIRMED" &&
        booking.driverId === request.driverId
      ) {
        return request;
      }

      if (
        booking.status === "CONFIRMED" &&
        booking.driverId &&
        booking.driverId !== request.driverId
      ) {
        try {
          const cancelled =
            await this.rideRequestRepository.cancelConflictingAcceptance(
              request.id,
              request.driverId
            );

          if (!cancelled) {
            throw new Error("Could not cancel the conflicting ride request");
          }
        } catch (cleanupError) {
          console.error(
            "Failed to clean up conflicting ride acceptance after verification",
            {
              rideRequestId: request.id,
              bookingId: request.bookingId,
              driverId: request.driverId,
              error: cleanupError,
            }
          );

          throw new Error(
            "Another driver claimed the booking, but ride request cleanup failed; manual reconciliation is required"
          );
        }

        throw new BookingServiceError(
          "Booking was claimed by another driver; your ride request was cancelled",
          409,
          true
        );
      }

      // Pending, missing, or unverifiable outcomes remain unresolved.
      // Do not release the driver automatically while the result is uncertain.
      throw error;
    }

    return request;
  }



  async cancelRideRequest(
    bookingId: string,
    driverId: string
  ): Promise<DriverRideRequest> {
    const request =
      await this.rideRequestRepository.cancelRideRequest(
        bookingId,
        driverId
      );

    if (!request) {
      const error = new Error(
        "No accepted or cancelled ride request matches this booking and driver"
      );
      (error as any).statusCode = 409;
      (error as any).code = "RIDE_REQUEST_NOT_CANCELLABLE";
      throw error;
    }

    return request;
  }

  async completeRideRequest(
    bookingId: string,
    driverId: string
  ): Promise<DriverRideRequest> {
    const request =
      await this.rideRequestRepository.completeRideRequest(
        bookingId,
        driverId
      );

    if (!request) {
      const error = new Error(
        "No accepted ride request matches this booking and driver"
      );
      (error as any).statusCode = 409;
      (error as any).code = "RIDE_REQUEST_NOT_COMPLETABLE";
      throw error;
    }

    return request;
  }


  async processExpiredRideRequests(
    limit = 100
  ): Promise<number> {
    const expiredIds =
      await this.rideRequestRepository.findExpiredOfferedRideRequestIds(
        limit
      );

    let expiredCount = 0;

    for (const id of expiredIds) {
      try {
        const request = await this.expireRideRequest(id);

        if (request) {
          expiredCount += 1;
        }
      } catch (error) {
        console.error("Failed to process expired ride request", {
          rideRequestId: id,
          error,
        });
      }
    }

    return expiredCount;
  }

  async expireRideRequest(
    id: string
  ): Promise<DriverRideRequest | null> {
    const request =
      await this.rideRequestRepository.expireRideRequest(id);

    if (!request) {
      return null;
    }

    await notifyBookingExpired(
      request.bookingId,
      request.driverId
    );

    return request;
  }

  async rejectRideRequest(
    id: string,
    driverId: string
  ): Promise<DriverRideRequest> {
    const request =
      await this.rideRequestRepository.rejectRideRequest(
        id,
        driverId
      );

    if (!request) {
      throw new Error(
        "Ride request is unavailable, expired, or already handled"
      );
    }

    await notifyBookingRejected(
      request.bookingId,
      request.driverId
    );

    return request;
  }
}
