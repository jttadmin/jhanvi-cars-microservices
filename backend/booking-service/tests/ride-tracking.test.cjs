const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");

const { buildRideTracking } = require("../src/services/rideTracking");
const { BookingError } = require("../src/errors/BookingError");

const NOW = new Date("2026-11-03T20:00:00+05:30");

const booking = (status, overrides = {}) => ({
  id: "b1",
  userId: "c1",
  driverId: "driver-1",
  pickupLocation: "MG Road",
  pickupLatitude: 12.975,
  pickupLongitude: 77.606,
  dropoffLocation: "Indiranagar",
  scheduledAt: "2026-11-03T19:30:00+05:30",
  status,
  fare: 189,
  vehicleType: "AUTO",
  ...overrides,
});

const position = (overrides = {}) => async () => ({
  name: "Ramesh Kumar",
  vehicleNumber: "KA01AB1101",
  vehicleModel: "Bajaj RE Compact",
  vehicleType: "AUTO",
  latitude: 12.97,
  longitude: 77.6,
  lastLocationAt: "2026-11-03T19:59:40+05:30",
  ...overrides,
});

test("ongoing ride returns the driver's position and the booked category", async () => {
  const t = await buildRideTracking(booking("ONGOING"), position(), NOW);
  assert.equal(t.vehicleType, "AUTO");
  assert.deepEqual(
    { lat: t.location.lat, lng: t.location.lng, stale: t.location.stale },
    { lat: 12.97, lng: 77.6, stale: false }
  );
  assert.deepEqual(t.pickup, { lat: 12.975, lng: 77.606 });
});

test("only name and vehicle are shared, not contact details", async () => {
  const t = await buildRideTracking(
    booking("CONFIRMED", { vehicleType: "COMFORT" }),
    position({ phone: "9000000101", email: "x@y.in", licenseNumber: "DL1" }),
    NOW
  );
  assert.deepEqual(Object.keys(t.driver).sort(), ["name", "vehicleModel", "vehicleNumber"]);
  assert.equal(t.vehicleType, "COMFORT");
});

test("a position older than 2 minutes is flagged as stale", async () => {
  const t = await buildRideTracking(
    booking("ONGOING"),
    position({ lastLocationAt: "2026-11-03T19:55:00+05:30" }),
    NOW
  );
  assert.equal(t.location.stale, true);
});

test("no GPS fix yet returns location: null", async () => {
  const t = await buildRideTracking(
    booking("CONFIRMED"),
    position({ latitude: null, longitude: null, lastLocationAt: null }),
    NOW
  );
  assert.equal(t.location, null);
});

test("tracking is refused before a driver accepts and after the ride ends", async () => {
  for (const b of [
    booking("PENDING", { driverId: null }),
    booking("COMPLETED"),
    booking("CANCELLED"),
  ]) {
    await assert.rejects(
      buildRideTracking(b, position(), NOW),
      (e) => e instanceof BookingError && e.code === "TRACKING_UNAVAILABLE"
    );
  }
});
