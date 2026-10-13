const assert = require("node:assert/strict");
const test = require("node:test");
const express = require("express");
const http = require("node:http");
const jwt = require("jsonwebtoken");

process.env.JWT_SECRET = "booking-route-test-jwt-secret";
process.env.INTERNAL_SERVICE_TOKEN = "booking-route-test-internal-token";

const { createBookingRoutes } = require("../dist/routes/bookingRoutes");

const internalRoutes = [
  ["PATCH", "/bookings/internal/booking-1/driver-accepted"],
  ["PATCH", "/bookings/internal/booking-1/driver-expired"],
  ["PATCH", "/bookings/internal/booking-1/driver-rejected"],
  ["GET", "/bookings/internal/drivers/driver-1/rating-summary"],
  ["GET", "/bookings/internal/drivers/driver-1/earnings"],
  ["GET", "/bookings/internal/drivers/driver-1/history"],
];

function makeHandler(name) {
  return async (_req, res) => {
    res.status(200).json({ handler: name });
  };
}

const controller = {
  driverAccepted: makeHandler("driverAccepted"),
  driverExpired: makeHandler("driverExpired"),
  driverRejected: makeHandler("driverRejected"),
  getDriverRatingSummary: makeHandler("getDriverRatingSummary"),
  getDriverEarningsInternal: makeHandler("getDriverEarningsInternal"),
  getDriverHistoryInternal: makeHandler("getDriverHistoryInternal"),

  // Other routes are registered but are not exercised by these tests.
  getAllBookings: makeHandler("getAllBookings"),
  getDriverEarnings: makeHandler("getDriverEarnings"),
  getDriverHistory: makeHandler("getDriverHistory"),
  createDriverRating: makeHandler("createDriverRating"),
  getBookingById: makeHandler("getBookingById"),
  createBooking: makeHandler("createBooking"),
  updateBooking: makeHandler("updateBooking"),
  acceptBooking: makeHandler("acceptBooking"),
  startBooking: makeHandler("startBooking"),
  completeBooking: makeHandler("completeBooking"),
  updateBookingStatus: makeHandler("updateBookingStatus"),
};

const app = express();
app.use(express.json());
app.use("/bookings", createBookingRoutes(controller));

let server;
let baseUrl;
let userToken;

test.before(async () => {
  userToken = jwt.sign(
    { sub: "customer-1", role: "CUSTOMER" },
    process.env.JWT_SECRET,
    { expiresIn: "5m" },
  );

  server = http.createServer(app);

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
});

for (const [method, path] of internalRoutes) {
  test(`${method} ${path} rejects a normal user JWT`, async () => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${userToken}`,
      },
    });

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), {
      message: "Internal service authentication required",
    });
  });

  test(`${method} ${path} accepts the internal service token`, async () => {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        "x-internal-service-token":
          process.env.INTERNAL_SERVICE_TOKEN,
      },
    });

    assert.equal(response.status, 200);
    assert.ok((await response.json()).handler);
  });
}
