const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");

const { calculateFare, isNightTime } = require("../src/services/fareCalculator");
const { FareService } = require("../src/services/fareService");
const { BookingService } = require("../src/services/bookingService");
const { BookingError } = require("../src/errors/BookingError");

// Karnataka defaults, as seeded by migration 006.
const RULES = {
  AUTO: { vehicleType: "AUTO", minFare: 36, minKm: 2, perKm: 18, nightStart: "22:00", nightEnd: "05:00", nightSurchargePercent: 50, gstPercent: 5 },
  ECONOMY: { vehicleType: "ECONOMY", minFare: 100, minKm: 4, perKm: 24, nightStart: "00:00", nightEnd: "06:00", nightSurchargePercent: 10, gstPercent: 5 },
  COMFORT: { vehicleType: "COMFORT", minFare: 115, minKm: 4, perKm: 28, nightStart: "00:00", nightEnd: "06:00", nightSurchargePercent: 10, gstPercent: 5 },
  COMFORT_PLUS: { vehicleType: "COMFORT_PLUS", minFare: 130, minKm: 4, perKm: 32, nightStart: "00:00", nightEnd: "06:00", nightSurchargePercent: 10, gstPercent: 5 },
};

// 2 pm and 1 am in India.
const DAY = new Date("2026-11-03T14:00:00+05:30");
const NIGHT_1AM = new Date("2026-11-04T01:00:00+05:30");
const NIGHT_11PM = new Date("2026-11-03T23:00:00+05:30");

test("trips inside the minimum distance pay only the minimum fare (+GST)", () => {
  assert.equal(calculateFare(RULES.AUTO, 1.5, DAY).total, 38); // 36 + 5% = 37.8
  assert.equal(calculateFare(RULES.ECONOMY, 3, DAY).total, 105); // 100 + 5%
});

test("per-km charge applies only beyond the minimum distance", () => {
  // AUTO 10 km: 36 + 8 x 18 = 180, +5% GST = 189
  assert.equal(calculateFare(RULES.AUTO, 10, DAY).total, 189);
  // ECONOMY 10 km: (100 + 6 x 24) = 244, +5% GST = 256.2 -> 256
  const q = calculateFare(RULES.ECONOMY, 10, DAY);
  assert.equal(q.distanceFare, 144);
  assert.equal(q.gst, 12.2);
  assert.equal(q.total, 256);
  // COMFORT_PLUS 10 km: (130 + 6 x 32) = 322, +5% = 338.1 -> 338
  assert.equal(calculateFare(RULES.COMFORT_PLUS, 10, DAY).total, 338);
});

test("night surcharge uses India time and windows that cross midnight", () => {
  assert.equal(isNightTime(RULES.AUTO, NIGHT_11PM), true);
  assert.equal(isNightTime(RULES.AUTO, NIGHT_1AM), true);
  assert.equal(isNightTime(RULES.AUTO, DAY), false);
  assert.equal(isNightTime(RULES.ECONOMY, NIGHT_11PM), false);
  assert.equal(isNightTime(RULES.ECONOMY, NIGHT_1AM), true);

  // AUTO 10 km at night: 180 x 1.5 = 270, +5% = 283.5 -> 284
  assert.equal(calculateFare(RULES.AUTO, 10, NIGHT_11PM).total, 284);
  // ECONOMY 10 km at 1 am: 244 + 10% = 268.4, +5% = 281.82 -> 282
  assert.equal(calculateFare(RULES.ECONOMY, 10, NIGHT_1AM).total, 282);
});

test("same start and end time means no night window", () => {
  const rule = { ...RULES.ECONOMY, nightStart: "00:00", nightEnd: "00:00" };
  assert.equal(isNightTime(rule, NIGHT_1AM), false);
});

function fareService() {
  return new FareService({
    findAll: async () => Object.values(RULES),
    findByType: async (type) => RULES[type],
  });
}

function bookingService() {
  let created;
  const repository = {
    create: async (booking) => {
      created = booking;
      return booking;
    },
  };
  const service = new BookingService(repository, fareService());
  // Keep the test offline: no dispatch or notifications.
  service.sendNotificationSafely = async () => {};
  return { service, created: () => created };
}

const draft = (overrides) => ({
  id: "b1",
  userId: "c1",
  pickupLocation: "MG Road",
  dropoffLocation: "Indiranagar",
  scheduledAt: "2026-11-03T14:00:00+05:30",
  status: "PENDING",
  vehicleType: "ECONOMY",
  distanceKm: 10,
  fare: 1,
  ...overrides,
});

test("customer bookings are priced by the server, ignoring the sent fare", async () => {
  const { service, created } = bookingService();
  await service.createBooking(draft({ fare: 1 }));
  assert.equal(created().fare, 256);
  assert.equal(created().distanceKm, 10);
});

test("customer booking without a distance is rejected", async () => {
  const { service } = bookingService();
  await assert.rejects(
    service.createBooking(draft({ distanceKm: undefined, fare: 500 })),
    (e) => e instanceof BookingError && e.code === "DISTANCE_REQUIRED"
  );
});

test("admin/internal callers can book at an explicit fare without a distance", async () => {
  const { service, created } = bookingService();
  await service.createBooking(
    draft({ distanceKm: undefined, fare: 500 }),
    { trustClientFare: true }
  );
  assert.equal(created().fare, 500);
});

test("even admins get the calculated fare when they send a distance", async () => {
  const { service, created } = bookingService();
  await service.createBooking(draft({ fare: 500 }), { trustClientFare: true });
  assert.equal(created().fare, 256);
});

test("quotes come back for every category in order", async () => {
  const quotes = await fareService().quoteAll(10, DAY);
  assert.deepEqual(
    quotes.map((q) => [q.vehicleType, q.total]),
    [["AUTO", 189], ["ECONOMY", 256], ["COMFORT", 297], ["COMFORT_PLUS", 338]]
  );
});
