require("ts-node/register");

const { test } = require("node:test");
const assert = require("node:assert/strict");

const repo = require("../src/repositories/notificationRepository")
  .notificationRepository;
const email = require("../src/services/emailService");
const { notificationService } = require("../src/services/notificationService");

function replace(obj, key, value, restores) {
  const original = obj[key];
  obj[key] = value;
  restores.push(() => { obj[key] = original; });
}

function makeNotification(overrides = {}) {
  return {
    id: "test-notification-1",
    userId: "test-user-1",
    bookingId: "test-booking-1",
    channel: "EMAIL",
    title: "Payment successful",
    message: "Test message",
    status: "PENDING",
    recipient: "customer@example.invalid",
    idempotencyKey: "payment:test-payment-1:PAID",
    attemptCount: 0,
    nextAttemptAt: null,
    lastError: null,
    ...overrides
  };
}

test("duplicate idempotency key returns existing notification without sending", async () => {
  const restores = [];
  try {
    const existing = makeNotification({ status: "SENT", attemptCount: 1 });
    let sendCalls = 0;
    let createCalls = 0;

    replace(repo, "findByIdempotencyKey", async () => existing, restores);
    replace(repo, "create", async () => {
      createCalls++;
      throw new Error("Should not create a duplicate");
    }, restores);
    replace(email, "sendEmail", async () => { sendCalls++; }, restores);

    const result = await notificationService.create(makeNotification());

    assert.equal(result.id, existing.id);
    assert.equal(result.status, "SENT");
    assert.equal(createCalls, 0);
    assert.equal(sendCalls, 0);
  } finally {
    restores.reverse().forEach(restore => restore());
  }
});

test("SMTP failure records FAILED and schedules a bounded retry", async () => {
  const restores = [];
  try {
    const notification = makeNotification();
    let savedResult;

    replace(repo, "findByIdempotencyKey", async () => null, restores);
    replace(repo, "create", async input => ({ ...input, attemptCount: 0 }), restores);
    replace(email, "sendEmail", async () => {
      throw new Error("SMTP unavailable");
    }, restores);
    replace(repo, "recordDeliveryResult", async (_id, result) => {
      savedResult = result;
      return {
        ...notification,
        ...result,
        nextAttemptAt: result.nextAttemptAt?.toISOString() ?? null
      };
    }, restores);

    const result = await notificationService.create(notification);

    assert.equal(result.status, "FAILED");
    assert.equal(savedResult.status, "FAILED");
    assert.equal(savedResult.attemptCount, 1);
    assert.ok(savedResult.nextAttemptAt instanceof Date);
    assert.ok(savedResult.nextAttemptAt.getTime() > Date.now());
  } finally {
    restores.reverse().forEach(restore => restore());
  }
});

test("SENT status persistence failure does not schedule an automatic resend", async () => {
  const restores = [];
  const originalError = console.error;
  try {
    const notification = makeNotification();
    const recordedStatuses = [];
    let sendCalls = 0;

    console.error = () => {};
    replace(repo, "findByIdempotencyKey", async () => null, restores);
    replace(repo, "create", async input => ({ ...input, attemptCount: 0 }), restores);
    replace(email, "sendEmail", async () => { sendCalls++; }, restores);
    replace(repo, "recordDeliveryResult", async (_id, result) => {
      recordedStatuses.push(result.status);
      if (result.status === "SENT") {
        throw new Error("Database write failed");
      }
      throw new Error("Must not record FAILED after SMTP acceptance");
    }, restores);

    const result = await notificationService.create(notification);

    assert.equal(sendCalls, 1);
    assert.deepEqual(recordedStatuses, ["SENT"]);
    assert.equal(result.status, "PENDING");
    assert.equal(result.nextAttemptAt, null);
    assert.match(result.lastError, /manual reconciliation required/i);
  } finally {
    restores.reverse().forEach(restore => restore());
    console.error = originalError;
  }
});

test("retry worker skips notifications that have exhausted all attempts", async () => {
  const restores = [];
  try {
    const exhausted = makeNotification({
      status: "FAILED",
      attemptCount: 5,
      nextAttemptAt: new Date(Date.now() - 60_000).toISOString()
    });
    let sendCalls = 0;

    replace(repo, "findDueRetries", async () => [exhausted], restores);
    replace(repo, "findById", async () => exhausted, restores);
    replace(email, "sendEmail", async () => { sendCalls++; }, restores);

    const processed = await notificationService.retryDue();

    assert.equal(processed, 0);
    assert.equal(sendCalls, 0);
  } finally {
    restores.reverse().forEach(restore => restore());
  }
});
