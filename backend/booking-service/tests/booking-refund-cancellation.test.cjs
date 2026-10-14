const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");

const paymentClient = require("../src/clients/payment.client");
const driverClient = require("../src/clients/driverVehicle.client");
const notificationClient = require("../src/clients/notification.client");
const { BookingService } = require("../src/services/bookingService");

function makeBooking() {
  return {
    id: "booking-refund-test",
    userId: "customer-test",
    driverId: "driver-test",
    pickupLocation: "MG Road",
    pickupLatitude: 12.975,
    pickupLongitude: 77.606,
    dropoffLocation: "Indiranagar",
    scheduledAt: "2030-01-01T10:00:00+05:30",
    status: "CONFIRMED",
    fare: 250,
    vehicleType: "AUTO",
  };
}

function setup(payment, refundResult, refundError) {
  const existing = makeBooking();
  const events = [];
  let storedBooking = { ...existing };

  paymentClient.getPaymentByBookingId = async () => {
    events.push("get-payment");
    return payment;
  };

  paymentClient.refundPayment = async (paymentId) => {
    events.push("refund");
    assert.equal(paymentId, payment.id);

    if (refundError) throw refundError;
    return refundResult;
  };

  driverClient.syncDriverVehicleForBooking = async (
    bookingId,
    driverId,
    action
  ) => {
    events.push(`driver-${action}`);
  };

  notificationClient.notifyBookingStatus = async () => {
    events.push("notification");
  };

  const repository = {
    async findById(id) {
      return id === existing.id ? { ...storedBooking } : undefined;
    },
    async update(id, booking) {
      events.push("booking-update");
      storedBooking = { ...booking };
      return { ...storedBooking };
    },
  };

  return {
    service: new BookingService(repository),
    events,
    getStoredBooking: () => storedBooking,
  };
}

test("paid confirmed booking is cancelled after a pending refund is accepted", async () => {
  const payment = { id: "payment-test", status: "PAID" };
  const { service, events, getStoredBooking } = setup(
    payment,
    { id: payment.id, status: "PAID", refundStatus: "PENDING" }
  );

  const result = await service.updateBookingStatus(
    "booking-refund-test",
    "CANCELLED"
  );

  assert.equal(result.status, "CANCELLED");
  assert.equal(getStoredBooking().status, "CANCELLED");
  assert.ok(events.indexOf("refund") < events.indexOf("booking-update"));
  assert.ok(events.includes("driver-CANCEL_TRIP"));
  assert.ok(events.includes("notification"));
});

test("refund error prevents booking and driver cancellation", async () => {
  const payment = { id: "payment-test", status: "PAID" };
  const { service, events, getStoredBooking } = setup(
    payment,
    null,
    Object.assign(new Error("Refund outcome is uncertain"), {
      statusCode: 503,
    })
  );

  await assert.rejects(
    service.updateBookingStatus("booking-refund-test", "CANCELLED"),
    /Refund outcome is uncertain/
  );

  assert.equal(getStoredBooking().status, "CONFIRMED");
  assert.ok(!events.includes("booking-update"));
  assert.ok(!events.includes("driver-CANCEL_TRIP"));
  assert.ok(!events.includes("notification"));
});

test("booking without a payment can be cancelled", async () => {
  const { service, events, getStoredBooking } = setup(null, null);

  const result = await service.updateBookingStatus(
    "booking-refund-test",
    "CANCELLED"
  );

  assert.equal(result.status, "CANCELLED");
  assert.equal(getStoredBooking().status, "CANCELLED");
  assert.ok(!events.includes("refund"));
  assert.ok(events.includes("booking-update"));
});

test("booking with an unpaid payment skips refund", async () => {
  const { service, events, getStoredBooking } = setup(
    { id: "payment-test", status: "PENDING" },
    null
  );

  const result = await service.updateBookingStatus(
    "booking-refund-test",
    "CANCELLED"
  );

  assert.equal(result.status, "CANCELLED");
  assert.equal(getStoredBooking().status, "CANCELLED");
  assert.ok(!events.includes("refund"));
});

test("already refunded payment does not request another refund", async () => {
  const { service, events, getStoredBooking } = setup(
    { id: "payment-test", status: "REFUNDED" },
    null
  );

  const result = await service.updateBookingStatus(
    "booking-refund-test",
    "CANCELLED"
  );

  assert.equal(result.status, "CANCELLED");
  assert.ok(!events.includes("refund"));
  assert.ok(events.includes("booking-update"));
});
