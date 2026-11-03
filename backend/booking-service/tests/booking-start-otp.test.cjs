const assert = require("node:assert/strict");
const test = require("node:test");

require("ts-node/register");

const { BookingService } = require("../src/services/bookingService");
const { BookingError } = require("../src/errors/BookingError");

function makeBooking(id, status) {
  return {
    id,
    userId: "customer-1",
    driverId: "driver-1",
    pickupLocation: "MG Road, Bengaluru",
    dropoffLocation: "Indiranagar, Bengaluru",
    scheduledAt: "2030-01-01T10:00:00+05:30",
    status,
    fare: 250,
  };
}

/*
 * In-memory stand-in for the OTP columns, following the same rules as
 * BookingRepository.checkStartOtp.
 */
function makeRepository(otps = {}) {
  const store = new Map(
    Object.entries(otps).map(([id, otp]) => [id, { otp, attempts: 0 }])
  );

  return {
    store,
    getStartOtps: async (ids) =>
      new Map(
        ids
          .filter((id) => store.has(id) && store.get(id).otp)
          .map((id) => [id, store.get(id).otp])
      ),
    setStartOtp: async (id, otp) => {
      store.set(id, { otp, attempts: 0 });
    },
    checkStartOtp: async (id, otp, maxAttempts, newOtp) => {
      const row = store.get(id);
      if (!row || !row.otp) return "MISSING";
      if (row.otp === otp) return "OK";
      row.attempts += 1;
      if (row.attempts >= maxAttempts) {
        store.set(id, { otp: newOtp(), attempts: 0 });
        return "ROTATED";
      }
      return "WRONG";
    },
  };
}

const rejectsWith = (code, statusCode) => (error) =>
  error instanceof BookingError &&
  error.code === code &&
  error.statusCode === statusCode;

test("correct OTP lets the driver start", async () => {
  const service = new BookingService(makeRepository({ b1: "0427" }));
  await service.verifyStartOtp("b1", "0427");
});

test("missing or malformed OTP is rejected before touching the DB", async () => {
  let checked = false;
  const repository = makeRepository({ b1: "0427" });
  repository.checkStartOtp = async () => {
    checked = true;
    return "OK";
  };
  const service = new BookingService(repository);

  for (const otp of [undefined, "", "12", "12345", "12a4", 1234]) {
    await assert.rejects(
      service.verifyStartOtp("b1", otp),
      rejectsWith("START_OTP_REQUIRED", 400)
    );
  }

  assert.equal(checked, false);
});

test("wrong OTP is rejected", async () => {
  const service = new BookingService(makeRepository({ b1: "0427" }));

  await assert.rejects(
    service.verifyStartOtp("b1", "1111"),
    rejectsWith("START_OTP_INVALID", 400)
  );
});

test("fifth wrong attempt rotates the code so it can't be brute-forced", async () => {
  const repository = makeRepository({ b1: "0427" });
  const service = new BookingService(repository);

  for (let i = 0; i < 4; i++) {
    await assert.rejects(
      service.verifyStartOtp("b1", "1111"),
      rejectsWith("START_OTP_INVALID", 400)
    );
  }

  await assert.rejects(
    service.verifyStartOtp("b1", "1111"),
    rejectsWith("START_OTP_ROTATED", 400)
  );

  const rotated = repository.store.get("b1").otp;
  assert.match(rotated, /^\d{4}$/);
  assert.equal(repository.store.get("b1").attempts, 0);
});

test("customer sees the OTP only while the ride hasn't started", async () => {
  const service = new BookingService(
    makeRepository({ b1: "0427", b2: "9999", b3: "5555" })
  );

  const result = await service.withStartOtpForCustomer([
    makeBooking("b1", "CONFIRMED"),
    makeBooking("b2", "ONGOING"),
    makeBooking("b3", "COMPLETED"),
  ]);

  assert.equal(result[0].startOtp, "0427");
  assert.equal(result[1].startOtp, undefined);
  assert.equal(result[2].startOtp, undefined);
});

test("older bookings without an OTP get one generated", async () => {
  const repository = makeRepository();
  const service = new BookingService(repository);

  const [booking] = await service.withStartOtpForCustomer([
    makeBooking("old-1", "CONFIRMED"),
  ]);

  assert.match(booking.startOtp, /^\d{4}$/);
  assert.equal(repository.store.get("old-1").otp, booking.startOtp);
});
