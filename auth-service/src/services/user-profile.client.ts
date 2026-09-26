import { ServiceUnavailableError } from '../errors/AppError';

interface InitializeUserProfileInput {
  userId: string;
  displayName: string;
  token: string;
}

interface UserProfileResponse {
  user?: {
    id: string;
    displayName: string | null;
    bio: string | null;
    avatarUrl: string | null;
    createdAt: string;
    updatedAt: string;
  };
}

export async function initializeUserProfile(
  input: InitializeUserProfileInput,
): Promise<void> {
  const baseUrl =
    process.env.USER_SERVICE_URL ?? 'http://localhost:3002';

  try {
    const response = await fetch(
      `${baseUrl}/users/me`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${input.token}`,
        },
        body: JSON.stringify({
          displayName: input.displayName,
        }),
      },
    );

    if (!response.ok) {
      const body = await response.text();

      throw new ServiceUnavailableError(
        `User profile initialization failed (${response.status}): ${body}`,
      );
    }

    const data =
      (await response.json()) as UserProfileResponse;

    if (!data.user || data.user.id !== input.userId) {
      throw new ServiceUnavailableError(
        'User profile initialization returned an invalid response',
      );
    }
  } catch (error) {
    if (error instanceof ServiceUnavailableError) {
      throw error;
    }

    throw new ServiceUnavailableError(
      'User Service is unavailable',
    );
  }
}
