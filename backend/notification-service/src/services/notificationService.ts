import { notificationRepository } from "../repositories/notificationRepository";
import { Notification, NotificationStatus } from "../types/notification";
import { sendEmail } from "./emailService";

const MAX_ATTEMPTS = 5;
const BASE_BACKOFF_MS = 60_000;
const MAX_BACKOFF_MS = 60 * 60 * 1000;

function retryAt(attemptCount: number): Date | null {
  if (attemptCount >= MAX_ATTEMPTS) return null;
  return new Date(Date.now() + Math.min(BASE_BACKOFF_MS * (2 ** (attemptCount - 1)), MAX_BACKOFF_MS));
}

function safeError(error: unknown): string {
  const raw = error instanceof Error ? error.message : "Unknown email delivery error";
  return raw.replace(/(password|pass|auth|token|secret)\s*[:=]\s*\S+/gi, "$1=[REDACTED]").slice(0, 1000);
}

async function deliver(notification: Notification): Promise<Notification> {
  const attemptCount = (notification.attemptCount ?? 0) + 1;

  // Only SMTP errors are eligible for normal delivery retries.
  try {
    await sendEmail({
      to: notification.recipient,
      subject: notification.title,
      text: notification.message
    });
  } catch (error) {
    const message = safeError(error);
    const nextAttemptAt = retryAt(attemptCount);

    console.error("Email notification delivery failed", {
      notificationId: notification.id,
      bookingId: notification.bookingId,
      attemptCount,
      retryScheduled: nextAttemptAt !== null,
      error: message
    });

    const failed = await notificationRepository.recordDeliveryResult(
      notification.id,
      {
        status: "FAILED",
        attemptCount,
        nextAttemptAt,
        lastError: message
      }
    );

    return failed ?? {
      ...notification,
      status: "FAILED",
      attemptCount,
      nextAttemptAt: nextAttemptAt?.toISOString() ?? null,
      lastError: message
    };
  }

  // SMTP accepted the message. Never classify a subsequent database
  // status-write failure as an SMTP failure or schedule an automatic resend.
  try {
    const sent = await notificationRepository.recordDeliveryResult(
      notification.id,
      {
        status: "SENT",
        attemptCount,
        nextAttemptAt: null,
        lastError: null
      }
    );

    if (sent) return sent;

    throw new Error("No notification row updated");
  } catch (error) {
    const warning =
      "SMTP accepted email, but SENT status persistence failed; manual reconciliation required";

    console.error("Email accepted but delivery status persistence failed", {
      notificationId: notification.id,
      bookingId: notification.bookingId,
      attemptCount,
      error: safeError(error)
    });

    // PENDING is deliberately not retry-eligible. This fallback is returned
    // to the caller; it may not be persisted if the database is unavailable.
    return {
      ...notification,
      status: "PENDING",
      attemptCount,
      nextAttemptAt: null,
      lastError: warning
    };
  }
}

export const notificationService = {
  getAll: () => notificationRepository.findAll(),

  getById: async (id: string) => {
    const notification = await notificationRepository.findById(id);
    if (!notification) {
      const error = new Error("Notification not found");
      (error as any).statusCode = 404;
      throw error;
    }
    return notification;
  },

  create: async (input: Notification): Promise<Notification> => {
    if (input.idempotencyKey) {
      const existing = await notificationRepository.findByIdempotencyKey(input.idempotencyKey);
      if (existing) return existing;
    }

    let notification: Notification;
    try {
      notification = await notificationRepository.create({ ...input, status: "PENDING" });
    } catch (error) {
      if (input.idempotencyKey) {
        const existing = await notificationRepository.findByIdempotencyKey(input.idempotencyKey);
        if (existing) return existing;
      }
      throw error;
    }

    if (notification.channel !== "EMAIL") return notification;
    return deliver(notification);
  },

  retryDue: async (): Promise<number> => {
    const due = await notificationRepository.findDueRetries();
    let processed = 0;
    for (const notification of due) {
      try {
        const latest = await notificationRepository.findById(notification.id);
        if (!latest || latest.status !== "FAILED" || (latest.attemptCount ?? 0) >= MAX_ATTEMPTS) continue;
        await deliver(latest);
        processed += 1;
      } catch (error) {
        console.error("Notification retry processing failed", {
          notificationId: notification.id, error: safeError(error)
        });
      }
    }
    return processed;
  },

  update: async (
    id: string,
    data: Omit<Notification, "id" | "status" | "createdAt" | "updatedAt">
  ) => {
    const notification = await notificationRepository.update(id, data);
    if (!notification) {
      const error = new Error("Notification not found");
      (error as any).statusCode = 404;
      throw error;
    }
    return notification;
  },

  updateStatus: async (id: string, status: NotificationStatus) => {
    const notification = await notificationRepository.updateStatus(id, status);
    if (!notification) {
      const error = new Error("Notification not found");
      (error as any).statusCode = 404;
      throw error;
    }
    return notification;
  }
};
