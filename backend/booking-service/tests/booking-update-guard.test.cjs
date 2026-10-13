const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");

const { BookingService } = require("../src/services/bookingService");
const { BookingError } = require("../src/errors/BookingError");

function makeBooking(status, driverId = "driver-123") {
  return {
    id: "booking-test-123",
    userId: "customer-test-123",
    driverId,
    pickupLocation: "MG Road, Bengaluru",
    pickupLatitude: 12.975,
    pickupLongitude: 77.606,
    dropoffLocation: "Indiranagar, Bengaluru",
    scheduledAt: "2030-01-01T10:00:00+05:30",
    status,
    fare: 250,
    vehicleType: "AUTO",
  };
}

function makeService(existing) {
  let updateCalled = false;

  const repository = {
    findById: async () => existing,
    update: async (_id, booking) => {
      updateCalled = true;
      return booking;
    },
  };

  return {
    service: new BookingService(repository),
    wasUpdateCalled: () => updateCalled,
  };
}

test("confirmed booking cannot have its driver cleared", async () => {
  const existing = makeBooking("CONFIRMED");
  const { service, wasUpdateCalled } = makeService(existing);

  await assert.rejects(
    service.updateBooking(existing.id, {
      ...existing,
      driverId: null,
    }),
    (error) =>
      error instanceof BookingError &&
      error.statusCode === 409 &&
      error.code === "DRIVER_REASSIGNMENT_NOT_ALLOWED",
  );

  assert.equal(wasUpdateCalled(), false);
});

test("confirmed booking cannot be reassigned to another driver", async () => {
  const existing = makeBooking("CONFIRMED");
  const { service, wasUpdateCalled } = makeService(existing);

  await assert.rejects(
    service.updateBooking(existing.id, {
      ...existing,
      driverId: "driver-456",
    }),
    (error) =>
      error instanceof BookingError &&
      error.statusCode === 409 &&
      error.code === "DRIVER_REASSIGNMENT_NOT_ALLOWED",
  );

  assert.equal(wasUpdateCalled(), false);
});

test("pending booking can still be edited without assigning a driver", async () => {
  const existing = makeBooking("PENDING", null);
  const { service, wasUpdateCalled } = makeService(existing);

  const result = await service.updateBooking(existing.id, {
    ...existing,
    pickupLocation: "Indiranagar, Bengaluru",
    driverId: null,
  });

  assert.equal(result.pickupLocation, "Indiranagar, Bengaluru");
  assert.equal(wasUpdateCalled(), true);
});
