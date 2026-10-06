import { DriverRideRequestRepository } from "../repositories/driverRideRequestRepository";
import { DriverRideRequest } from "../types/driverRideRequest";

export class DriverRideRequestService {
  constructor(
    private readonly rideRequestRepository: DriverRideRequestRepository
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

  async getDriverRideRequests(
    driverId: string
  ): Promise<DriverRideRequest[]> {
    return this.rideRequestRepository.findByDriverId(driverId);
  }

  async acceptRideRequest(
    id: string,
    driverId: string
  ): Promise<DriverRideRequest> {
    const request = await this.rideRequestRepository.acceptRideRequest(
      id,
      driverId
    );

    if (!request) {
      throw new Error(
        "Ride request is unavailable, expired, already handled, or driver is not available"
      );
    }

    return request;
  }

  async rejectRideRequest(
    id: string,
    driverId: string
  ): Promise<DriverRideRequest> {
    const request = await this.rideRequestRepository.rejectRideRequest(
      id,
      driverId
    );

    if (!request) {
      throw new Error(
        "Ride request is unavailable, expired, or already handled"
      );
    }

    return request;
  }
}
