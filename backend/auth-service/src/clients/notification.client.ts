const notificationServiceUrl =
  process.env.NOTIFICATION_SERVICE_URL ?? "http://localhost:3007";

export async function sendWelcomeEmail(
  user: { id: string; email: string; fullName: string }
): Promise<void> {
  const token = process.env.INTERNAL_SERVICE_TOKEN;

  if (!token) {
    throw new Error("INTERNAL_SERVICE_TOKEN is missing");
  }
  const response = await fetch(`${notificationServiceUrl}/notifications`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-service-token": token
    },
    body: JSON.stringify({
      userId: user.id,
      channel: "EMAIL",
      title: "Welcome to Jhanvi Cars",
      message: `Hello ${user.fullName}, welcome to Jhanvi Cars! Your account has been created successfully.`,
      recipient: user.email,
      idempotencyKey: `user:${user.id}:WELCOME`
    })
  });

  if (!response.ok) {
    throw new Error(`Notification Service returned ${response.status}`);
  }
}
