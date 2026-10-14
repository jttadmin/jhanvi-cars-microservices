const { test, beforeEach, after } = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");

const originalLoad = Module._load;

let payment;
let refundCalls;
let refundPages;
let repository;
let razorpay;

function makePayment(overrides = {}) {
  return {
    id: "payment-test-1",
    bookingId: "booking-test-1",
    userId: "user-test-1",
    amount: 100,
    currency: "INR",
    method: "UPI",
    status: "PAID",
    transactionId: "pay_test123",
    refundId: null,
    refundRequestId: null,
    refundStatus: null,
    ...overrides,
  };
}

function makeErrorStatus(error, statusCode) {
  assert.equal(error.statusCode, statusCode);
}

function setup(initialPayment, providerRefund) {
  payment = { ...initialPayment };
  refundCalls = [];
  refundPages = [];
  repository = {
    async findById(id) {
      return id === payment.id ? { ...payment } : null;
    },

    async claimRefund(id, requestId) {
      if (
        id !== payment.id ||
        payment.status !== "PAID" ||
        payment.refundStatus != null
      ) {
        return null;
      }

      payment.refundRequestId = requestId;
      payment.refundStatus = "REQUESTED";
      return { ...payment };
    },

    async updateRefundDetails(id, details) {
      if (id !== payment.id) return null;
      if (details.refundId !== undefined) {
        payment.refundId = details.refundId;
      }
      payment.refundStatus = details.refundStatus;
      return { ...payment };
    },

    async updateStatus(id, status) {
      if (id !== payment.id) return null;
      payment.status = status;
      return { ...payment };
    },
  };

  razorpay = {
    payments: {
      async refund(paymentId, options) {
        refundCalls.push({ paymentId, options });
        if (providerRefund instanceof Error) throw providerRefund;
        return { ...providerRefund };
      },

      async fetchMultipleRefund(paymentId, options) {
        refundPages.push({ paymentId, options });
        if (typeof providerRefund === "function") {
          return providerRefund(paymentId, options);
        }
        return { items: [] };
      },
    },
    orders: {
      async create() {
        throw new Error("Unexpected order creation in refund test");
      },
    },
  };

  Module._load = function (request, parent, isMain) {
    if (parent && parent.filename.endsWith("/dist/services/paymentService.js")) {
      if (request === "../repositories/paymentRepository") {
        return { paymentRepository: repository };
      }
      if (request === "../clients/booking.client") {
        return { validatePaymentBooking: async () => {} };
      }
      if (request === "../clients/booking-status.client") {
        return { confirmBooking: async () => {} };
      }
      if (request === "../clients/razorpay.client") {
        return { razorpayClient: razorpay };
      }
      if (request === "../clients/notification.client") {
        return {
          createPaymentNotification: async () => {},
          createPaymentFailedNotification: async () => {},
          createRefundNotification: async () => {},
        };
      }
    }

    return originalLoad.call(this, request, parent, isMain);
  };

  delete require.cache[
    require.resolve("../dist/services/paymentService.js")
  ];
}

beforeEach(() => {
  Module._load = originalLoad;
});

after(() => {
  Module._load = originalLoad;
});

test("processed refund marks payment REFUNDED", async () => {
  setup(makePayment(), {
    id: "rfnd_test1",
    status: "processed",
  });

  const { paymentService } = require("../dist/services/paymentService.js");
  const result = await paymentService.refundPayment(payment.id);

  assert.equal(result.status, "REFUNDED");
  assert.equal(payment.refundStatus, "PROCESSED");
  assert.equal(payment.refundId, "rfnd_test1");
  assert.equal(refundCalls.length, 1);
  assert.equal(refundCalls[0].paymentId, "pay_test123");
  assert.ok(refundCalls[0].options.notes.refundRequestId);
});

test("pending refund keeps payment PAID", async () => {
  setup(makePayment(), {
    id: "rfnd_pending1",
    status: "pending",
  });

  const { paymentService } = require("../dist/services/paymentService.js");
  const result = await paymentService.refundPayment(payment.id);

  assert.equal(result.status, "PAID");
  assert.equal(result.refundStatus, "PENDING");
  assert.equal(result.refundId, "rfnd_pending1");
  assert.equal(refundCalls.length, 1);
});

test("provider failure is recorded as FAILED", async () => {
  setup(makePayment(), {
    id: "rfnd_failed1",
    status: "failed",
  });

  const { paymentService } = require("../dist/services/paymentService.js");

  await assert.rejects(
    paymentService.refundPayment(payment.id),
    (error) => {
      makeErrorStatus(error, 409);
      return /refund failed/i.test(error.message);
    }
  );

  assert.equal(payment.status, "PAID");
  assert.equal(payment.refundStatus, "FAILED");
  assert.equal(payment.refundId, "rfnd_failed1");
  assert.equal(refundCalls.length, 1);
});

test("uncertain provider outcome is retained and retry does not resubmit", async () => {
  setup(makePayment(), new Error("network timeout"));

  const { paymentService } = require("../dist/services/paymentService.js");

  const originalError = console.error;
  console.error = () => {};
  try {
    await assert.rejects(
      paymentService.refundPayment(payment.id),
      (error) => {
        makeErrorStatus(error, 503);
        return /uncertain/i.test(error.message);
      }
    );
  } finally {
    console.error = originalError;
  }

  assert.equal(payment.refundStatus, "REQUESTED");
  assert.ok(payment.refundRequestId);
  assert.equal(refundCalls.length, 1);

  await assert.rejects(
    paymentService.refundPayment(payment.id),
    (error) => {
      makeErrorStatus(error, 409);
      return /no duplicate request/i.test(error.message);
    }
  );

  assert.equal(refundCalls.length, 1);
  assert.equal(refundPages.length, 1);
});

test("retry reconciles an existing processed refund without resubmitting", async () => {
  const requestId = "existing-request-1";
  setup(
    makePayment({
      refundRequestId: requestId,
      refundStatus: "REQUESTED",
    }),
    async () => ({
      items: [{
        id: "rfnd_reconciled1",
        status: "processed",
        notes: { refundRequestId: requestId },
      }],
    })
  );

  const { paymentService } = require("../dist/services/paymentService.js");
  const result = await paymentService.refundPayment(payment.id);

  assert.equal(result.status, "REFUNDED");
  assert.equal(payment.refundStatus, "PROCESSED");
  assert.equal(payment.refundId, "rfnd_reconciled1");
  assert.equal(refundCalls.length, 0);
  assert.equal(refundPages.length, 1);
});

test("already refunded payment does not call Razorpay", async () => {
  setup(
    makePayment({
      status: "REFUNDED",
      refundStatus: "PROCESSED",
      refundId: "rfnd_existing1",
    }),
    new Error("Must not be called")
  );

  const { paymentService } = require("../dist/services/paymentService.js");
  const result = await paymentService.refundPayment(payment.id);

  assert.equal(result.status, "REFUNDED");
  assert.equal(refundCalls.length, 0);
  assert.equal(refundPages.length, 0);
});

test("order ID cannot be refunded as a payment ID", async () => {
  setup(makePayment({ transactionId: "order_test123" }), {
    id: "should_not_exist",
    status: "processed",
  });

  const { paymentService } = require("../dist/services/paymentService.js");

  await assert.rejects(
    paymentService.refundPayment(payment.id),
    (error) => {
      makeErrorStatus(error, 409);
      return /verified Razorpay payment ID/i.test(error.message);
    }
  );

  assert.equal(refundCalls.length, 0);
  assert.equal(refundPages.length, 0);
});
