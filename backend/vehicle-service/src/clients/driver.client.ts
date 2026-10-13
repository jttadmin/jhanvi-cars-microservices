export class DriverValidationError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number
  ) {
    super(message);
    this.name = "DriverValidationError";
  }
}

export async function validateDriverExists(
  driverId: string
): Promise<void> {
  const baseUrl =
    process.env.DRIVER_SERVICE_URL ??
    "http://localhost:3003";

  let response: Response;

  try {
    response = await fetch(
      `${baseUrl}/drivers/${encodeURIComponent(driverId)}`,
      {
        headers: {
          "x-internal-service-token":
            process.env.INTERNAL_SERVICE_TOKEN ?? "",
        },
      }
    );
  } catch {
    throw new DriverValidationError(
      "Driver Service is unavailable",
      503
    );
  }

  if (response.status === 404) {
    throw new DriverValidationError(
      "The assigned driver does not exist",
      409
    );
  }

  if (!response.ok) {
    throw new DriverValidationError(
      "Could not validate the driver assignment",
      503
    );
  }
}
