interface InternalUserResponse {
  success: boolean;
  data?: {
    user?: {
      id: string;
      email: string;
    };
  };
}

export async function getCustomerEmail(
  userId: string
): Promise<string> {
  const authServiceUrl =
    process.env.AUTH_SERVICE_URL ?? "http://localhost:3001";

  const internalToken =
    process.env.INTERNAL_SERVICE_TOKEN;

  if (!internalToken) {
    throw new Error(
      "Cannot look up customer email: INTERNAL_SERVICE_TOKEN is missing"
    );
  }

  const response = await fetch(
    `${authServiceUrl}/auth/internal/users/${encodeURIComponent(userId)}`,
    {
      method: "GET",
      headers: {
        "x-internal-service-token": internalToken
      }
    }
  );

  if (!response.ok) {
    throw new Error(
      `Auth Service user lookup failed with status ${response.status}`
    );
  }

  const result =
    await response.json() as InternalUserResponse;

  const email = result.data?.user?.email?.trim();

  if (!result.success || !email) {
    throw new Error(
      "Auth Service did not return a customer email"
    );
  }

  return email;
}
