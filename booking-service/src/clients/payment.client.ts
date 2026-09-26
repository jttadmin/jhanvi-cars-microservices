const paymentServiceUrl =
  process.env.PAYMENT_SERVICE_URL ??
  "http://localhost:3006";

const internalHeaders = {
  "Content-Type": "application/json",
  "x-internal-service-token":
    process.env.INTERNAL_SERVICE_TOKEN ?? ""
};

interface Payment {
  id: string;
  bookingId: string;
  userId: string;
  amount: number;
  currency: string;
  method: string;
  status:
    | "PENDING"
    | "AUTHORIZED"
    | "PAID"
    | "FAILED"
    | "REFUNDED";
}

export async function getPaymentByBookingId(
  bookingId: string
): Promise<Payment | null> {

  let response: Response;

  try {
    response = await fetch(
      `${paymentServiceUrl}/payments/booking/${encodeURIComponent(bookingId)}`,
      {
        headers: internalHeaders
      }
    );
  } catch {
    const error = new Error(
      "Payment Service is unavailable"
    );

    (error as any).statusCode = 503;

    throw error;
  }

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    const error = new Error(
      `Payment Service returned HTTP ${response.status}`
    );

    (error as any).statusCode = 503;

    throw error;
  }

  return await response.json() as Payment;
}

export async function refundPayment(
  paymentId: string
): Promise<Payment> {

  let response: Response;

  try {
    response = await fetch(
      `${paymentServiceUrl}/payments/${encodeURIComponent(paymentId)}/status`,
      {
        method: "PATCH",
        headers: internalHeaders,
        body: JSON.stringify({
          status: "REFUNDED"
        })
      }
    );
  } catch {
    const error = new Error(
      "Payment Service is unavailable"
    );

    (error as any).statusCode = 503;

    throw error;
  }

  if (!response.ok) {
    const body = await response.text();

    const error = new Error(
      `Payment Service returned ${response.status}: ${body}`
    );

    (error as any).statusCode = 503;

    throw error;
  }

  return await response.json() as Payment;
}
