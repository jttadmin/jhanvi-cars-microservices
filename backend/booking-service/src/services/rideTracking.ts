import { BookingError } from "../errors/BookingError";
import {
  DriverPosition,
  getDriverPosition
} from "../clients/driverVehicle.client";
import { Booking } from "../types/booking";

/** A position older than this is shown to the customer as "last seen". */
export const STALE_LOCATION_MS = 2 * 60 * 1000;

const TRACKABLE = new Set(["CONFIRMED", "ONGOING"]);

export interface RideTracking {
  bookingId: string;
  status: Booking["status"];
  /** Booked category: decides the auto or car icon on the map. */
  vehicleType: Booking["vehicleType"] | null;
  pickup: { lat: number; lng: number } | null;
  dropoff: { lat: number; lng: number } | null;
  driver: {
    name: string;
    vehicleNumber: string;
    vehicleModel: string | null;
  };
  location: {
    lat: number;
    lng: number;
    updatedAt: string | null;
    stale: boolean;
  } | null;
}

/*
 * Live position of the driver on the customer's ride. Only the driver's
 * name and vehicle are shared, not their phone, email or licence.
 */
export async function buildRideTracking(
  booking: Booking,
  fetchPosition: (driverId: string) => Promise<DriverPosition | null> = getDriverPosition,
  now: Date = new Date()
): Promise<RideTracking> {
  if (!TRACKABLE.has(booking.status) || !booking.driverId) {
    throw new BookingError(
      409,
      "Live tracking is available once a driver accepts the ride and until it ends",
      "TRACKING_UNAVAILABLE"
    );
  }

  const position = await fetchPosition(booking.driverId);

  if (!position) {
    throw new BookingError(
      502,
      "The assigned driver could not be found",
      "DRIVER_NOT_FOUND"
    );
  }

  const hasFix =
    position.latitude !== null && position.longitude !== null;

  const updatedAt = position.lastLocationAt;
  const stale =
    !updatedAt ||
    now.getTime() - new Date(updatedAt).getTime() > STALE_LOCATION_MS;

  return {
    bookingId: booking.id,
    status: booking.status,
    vehicleType: booking.vehicleType ?? null,
    pickup:
      booking.pickupLatitude != null && booking.pickupLongitude != null
        ? { lat: booking.pickupLatitude, lng: booking.pickupLongitude }
        : null,
    dropoff:
      booking.dropoffLatitude != null && booking.dropoffLongitude != null
        ? { lat: booking.dropoffLatitude, lng: booking.dropoffLongitude }
        : null,
    driver: {
      name: position.name,
      vehicleNumber: position.vehicleNumber,
      vehicleModel: position.vehicleModel ?? null,
    },
    location: hasFix
      ? {
          lat: position.latitude as number,
          lng: position.longitude as number,
          updatedAt,
          stale,
        }
      : null,
  };
}
