interface Vehicle {
  id: string;
  driverId?: string | null;
  registrationNumber: string;
  status: string;
}

export class DriverVehicleValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "DriverVehicleValidationError";
  }
}

export async function validateDriverVehicleAssignment(
  driverId: string
): Promise<void> {
  const vehicleBaseUrl =
    process.env.VEHICLE_SERVICE_URL ??
    "http://localhost:3005";

  let response: Response;

  try {
    response = await fetch(
      `${vehicleBaseUrl}/vehicles/`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-internal-service-token":
            process.env.INTERNAL_SERVICE_TOKEN ?? "",
        },
      }
    );
  } catch {
    throw new DriverVehicleValidationError(
      "Vehicle Service is unavailable",
      503
    );
  }

  if (!response.ok) {
    throw new DriverVehicleValidationError(
      `Vehicle Service returned HTTP ${response.status}`,
      503
    );
  }

  let vehicles: Vehicle[];

  try {
    const data: unknown = await response.json();

    if (!Array.isArray(data)) {
      throw new Error("Invalid vehicle list");
    }

    vehicles = data as Vehicle[];
  } catch {
    throw new DriverVehicleValidationError(
      "Vehicle Service returned an invalid vehicle list",
      503
    );
  }

  // Only an explicit driverId association counts.
  // Registration-number matching is intentionally not used.
  const vehicle = vehicles.find(
    (item) => item.driverId === driverId
  );

  if (!vehicle) {
    throw new DriverVehicleValidationError(
      "You cannot accept a ride because no vehicle is assigned to your driver account",
      409
    );
  }

  if (vehicle.status !== "AVAILABLE") {
    throw new DriverVehicleValidationError(
      "Your assigned vehicle is not available",
      409
    );
  }
}
