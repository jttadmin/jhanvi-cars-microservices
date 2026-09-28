import { ServiceUnavailableError } from '../errors/AppError';

interface CreateDriverProfileInput {
  userId: string;
  fullName: string;
  email: string;
  mobileNumber: string;
  licenseNumber: string;
  vehicleNumber: string;
}

export async function createDriverProfile(
  input: CreateDriverProfileInput,
): Promise<void> {
  const baseUrl =
    process.env.DRIVER_SERVICE_URL ?? 'http://localhost:3003';

  const token = process.env.INTERNAL_SERVICE_TOKEN;

  if (!token) {
    throw new ServiceUnavailableError(
      'Driver Service internal authentication is not configured',
    );
  }

  try {
    const response = await fetch(`${baseUrl}/drivers/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-internal-service-token': token,
      },
      body: JSON.stringify({
        id: `driver-${input.userId}`,
        userId: input.userId,
        name: input.fullName,
        email: input.email,
        phone: input.mobileNumber,
        licenseNumber: input.licenseNumber,
        vehicleNumber: input.vehicleNumber,
        isAvailable: false,
      }),
    });

    if (!response.ok) {
      const body = await response.text();

      throw new ServiceUnavailableError(
        `Driver profile creation failed (${response.status}): ${body}`,
      );
    }
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    throw new ServiceUnavailableError(
      'Driver Service is unavailable',
    );
  }
}
