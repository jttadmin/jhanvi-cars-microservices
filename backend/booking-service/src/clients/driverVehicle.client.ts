import { BookingError } from "../errors/BookingError";
const internalHeaders = {
  "Content-Type": "application/json",
  "x-internal-service-token":
    process.env.INTERNAL_SERVICE_TOKEN ?? ""
};
interface Driver {
  id: string;
  userId?: string | null;
  name: string;
  email: string;
  phone: string;
  licenseNumber: string;
  vehicleNumber: string;
  isAvailable: boolean;
}

interface Vehicle {
  id: string;
  driverId?: string | null;
  registrationNumber: string;
  make: string;
  model: string;
  year: number;
  type: string;
  status: string;
}

type DriverVehicleAction =
  | "START_TRIP"
  | "END_TRIP"
  | "CANCEL_TRIP";

async function getJson(
  url: string,
  serviceName: string
): Promise<any> {
  let response: Response;

  try {
    response = await fetch(url, {
       headers: internalHeaders
    });
  } catch {
    throw new BookingError(
      503,
      `${serviceName} is unavailable`
    );
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new BookingError(
      503,
      `${serviceName} returned HTTP ${response.status}`
    );
  }

  try {
    return await response.json();
  } catch {
    throw new BookingError(
      503,
      `${serviceName} returned an invalid response`
    );
  }
}

async function patchJson(
  url: string,
  body: unknown,
  serviceName: string
): Promise<any> {
  let response: Response;

  try {
    response = await fetch(url, {
      method: "PATCH",
      headers: internalHeaders,
      body: JSON.stringify(body)
    });
  } catch {
    throw new BookingError(
      503,
      `${serviceName} is unavailable`
    );
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new BookingError(
      503,
      `${serviceName} returned HTTP ${response.status}`
    );
  }

  try {
    return await response.json();
  } catch {
    throw new BookingError(
      503,
      `${serviceName} returned an invalid response`
    );
  }
}

async function getDriverAndVehicle(
  driverId: string
): Promise<{
  driver: Driver;
  vehicle: Vehicle;
}> {
  const driverBaseUrl =
    process.env.DRIVER_SERVICE_URL ??
    "http://localhost:3003";

  const vehicleBaseUrl =
    process.env.VEHICLE_SERVICE_URL ??
    "http://localhost:3005";

  const driver =
    await getJson(
      `${driverBaseUrl}/drivers/${encodeURIComponent(driverId)}`,
      "Driver Service"
    ) as Driver | null;

  if (!driver) {
    throw new BookingError(
      404,
      "Driver not found"
    );
  }

  const vehicles =
    await getJson(
      `${vehicleBaseUrl}/vehicles/`,
      "Vehicle Service"
    ) as Vehicle[] | null;

  if (!Array.isArray(vehicles)) {
    throw new BookingError(
      503,
      "Vehicle Service returned an invalid vehicle list"
    );
  }

  const vehicle =
    vehicles.find(
      (item) =>
        item.registrationNumber ===
        driver.vehicleNumber
    );

  if (!vehicle) {
    throw new BookingError(
      404,
      "Vehicle assigned to driver was not found"
    );
  }

  if (
    vehicle.driverId &&
    vehicle.driverId !== driver.id
  ) {
    throw new BookingError(
      409,
      "Driver and vehicle assignment does not match"
    );
  }

  return {
    driver,
    vehicle
  };
}

export async function validateDriverAndVehicle(
  driverId: string
): Promise<void> {
  const { driver, vehicle } =
    await getDriverAndVehicle(driverId);

  if (!driver.isAvailable) {
    throw new BookingError(
      409,
      "Driver is not available"
    );
  }

  if (vehicle.status !== "AVAILABLE") {
    throw new BookingError(
      409,
      "Driver vehicle is not available"
    );
  }
}

export async function validateDriverAndVehicleForAssignment(
  driverId: string
): Promise<void> {
  const { vehicle } =
    await getDriverAndVehicle(driverId);

  if (vehicle.status !== "AVAILABLE") {
    throw new BookingError(
      409,
      "Driver vehicle is not available"
    );
  }
}

export async function syncDriverVehicleForBooking(
  driverId: string,
  action: DriverVehicleAction
): Promise<void> {
  const driverBaseUrl =
    process.env.DRIVER_SERVICE_URL ??
    "http://localhost:3003";

  const vehicleBaseUrl =
    process.env.VEHICLE_SERVICE_URL ??
    "http://localhost:3005";

  const { driver, vehicle } =
    await getDriverAndVehicle(driverId);

  if (action === "START_TRIP") {
    if (!driver.isAvailable) {
      throw new BookingError(
        409,
        "Driver is not available to start the trip"
      );
    }

    if (vehicle.status !== "AVAILABLE") {
      throw new BookingError(
        409,
        "Vehicle is not available to start the trip"
      );
    }

    await patchJson(
      `${driverBaseUrl}/drivers/${encodeURIComponent(driver.id)}/status`,
      { isAvailable: false },
      "Driver Service"
    );

    try {
      await patchJson(
        `${vehicleBaseUrl}/vehicles/${encodeURIComponent(vehicle.id)}/status`,
        { status: "IN_USE" },
        "Vehicle Service"
      );
    } catch (error) {
      // Roll the driver back if vehicle state could not be changed.
      try {
        await patchJson(
          `${driverBaseUrl}/drivers/${encodeURIComponent(driver.id)}/status`,
          { isAvailable: true },
          "Driver Service"
        );
      } catch {
        // Preserve the original failure.
      }

      throw error;
    }

    return;
  }

  if (action === "END_TRIP" || action === "CANCEL_TRIP") {
    await patchJson(
      `${vehicleBaseUrl}/vehicles/${encodeURIComponent(vehicle.id)}/status`,
      { status: "AVAILABLE" },
      "Vehicle Service"
    );

    try {
      await patchJson(
        `${driverBaseUrl}/drivers/${encodeURIComponent(driver.id)}/status`,
        { isAvailable: true },
        "Driver Service"
      );
    } catch (error) {
      // Try to avoid leaving the vehicle available
      // when the driver state could not be restored.
      try {
        await patchJson(
          `${vehicleBaseUrl}/vehicles/${encodeURIComponent(vehicle.id)}/status`,
          { status: "IN_USE" },
          "Vehicle Service"
        );
      } catch {
        // Preserve the original failure.
      }

      throw error;
    }

    return;
  }
}
export async function getDriverByUserId(
  userId: string
): Promise<Driver | null> {
  const driverBaseUrl =
    process.env.DRIVER_SERVICE_URL ??
    "http://localhost:3003";

  const drivers =
    await getJson(
      `${driverBaseUrl}/drivers/`,
      "Driver Service"
    ) as Driver[] | null;

  if (!Array.isArray(drivers)) {
    throw new BookingError(
      503,
      "Driver Service returned an invalid driver list"
    );
  }

  return (
    drivers.find(
      (driver) => driver.userId === userId
    ) ?? null
  );
}

export interface NearbyDriver {
  driverId: string;
  distanceKm: number;
  latitude: number;
  longitude: number;
  vehicleType:
    | "AUTO"
    | "ECONOMY"
    | "COMFORT"
    | "COMFORT_PLUS";
  vehicleModel: string;
}

export async function findNearbyDrivers(
  latitude: number,
  longitude: number,
  radiusKm = 5,
  limit = 10
): Promise<NearbyDriver[]> {
  const driverBaseUrl =
    process.env.DRIVER_SERVICE_URL ??
    "http://localhost:3003";

  const url =
    `${driverBaseUrl}/drivers/nearby` +
    `?latitude=${encodeURIComponent(latitude)}` +
    `&longitude=${encodeURIComponent(longitude)}` +
    `&radiusKm=${encodeURIComponent(radiusKm)}` +
    `&limit=${encodeURIComponent(limit)}`;

  const result =
    await getJson(
      url,
      "Driver Service"
    ) as {
      drivers?: NearbyDriver[];
    } | null;

  if (!result || !Array.isArray(result.drivers)) {
    throw new BookingError(
      503,
      "Driver Service returned an invalid nearby-driver response"
    );
  }

  return result.drivers;
}
export async function createRideRequest(
  bookingId: string,
  driverId: string,
  pickupLatitude: number,
  pickupLongitude: number,
  expiresInSeconds = 30
): Promise<any> {
  const driverBaseUrl =
    process.env.DRIVER_SERVICE_URL ??
    "http://localhost:3003";

  let response: Response;

  try {
    response = await fetch(
      `${driverBaseUrl}/drivers/ride-requests`,
      {
        method: "POST",
        headers: internalHeaders,
        body: JSON.stringify({
          bookingId,
          driverId,
          pickupLatitude,
          pickupLongitude,
          expiresInSeconds
        })
      }
    );
  } catch {
    throw new BookingError(
      503,
      "Driver Service is unavailable"
    );
  }

  if (!response.ok) {
    throw new BookingError(
      503,
      `Driver Service returned HTTP ${response.status}`
    );
  }

  try {
    return await response.json();
  } catch {
    throw new BookingError(
      503,
      "Driver Service returned an invalid ride-request response"
    );
  }
}

export async function getRideRequestDriverIds(
  bookingId: string
): Promise<string[]> {
  const driverBaseUrl =
    process.env.DRIVER_SERVICE_URL ??
    "http://localhost:3003";

  const result =
    await getJson(
      `${driverBaseUrl}/drivers/ride-requests/booking/${encodeURIComponent(bookingId)}/drivers`,
      "Driver Service"
    ) as {
      driverIds?: string[];
    } | null;

  if (
    !result ||
    !Array.isArray(result.driverIds)
  ) {
    throw new BookingError(
      503,
      "Driver Service returned an invalid ride-request history response"
    );
  }

  return result.driverIds;
}

