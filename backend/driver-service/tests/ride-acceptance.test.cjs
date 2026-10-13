const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const clientPath = require.resolve(
  "../dist/clients/booking.client.js"
);
const servicePath = require.resolve(
  "../dist/services/driverRideRequestService.js"
);

const bookingClient = require(clientPath);
const { DriverRideRequestService } = require(servicePath);

const originalNotify = bookingClient.notifyBookingAccepted;
const originalGetBookingAcceptanceState =
  bookingClient.getBookingAcceptanceState;
const originalConflictFlag = Object.getOwnPropertyDescriptor(
  bookingClient.BookingServiceError.prototype,
  "isCompetingDriverConflict"
);

after(() => {
  bookingClient.notifyBookingAccepted = originalNotify;
  bookingClient.getBookingAcceptanceState =
    originalGetBookingAcceptanceState;
  if (originalConflictFlag) {
    Object.defineProperty(
      bookingClient.BookingServiceError.prototype,
      "isCompetingDriverConflict",
      originalConflictFlag
    );
  }
});

function createRequest() {
  return {
    id: "request-1",
    bookingId: "booking-1",
    driverId: "driver-1",
    pickupLatitude: 12.97,
    pickupLongitude: 77.59,
    status: "ACCEPTED",
    createdAt: new Date(),
    expiresAt: new Date(Date.now() + 30000),
    respondedAt: new Date(),
  };
}

function createHarness() {
  const calls = {
    accept: [],
    cancel: [],
  };

  const repository = {
    async acceptRideRequest(id, driverId) {
      calls.accept.push({ id, driverId });
      return createRequest();
    },
    async cancelConflictingAcceptance(id, driverId) {
      calls.cancel.push({ id, driverId });
      return true;
    },
  };

  return {
    calls,
    service: new DriverRideRequestService(
      repository,
      async () => {}
    ),
  };
}

test("successful acceptance does not cancel the request", async () => {
  const { service, calls } = createHarness();
  bookingClient.notifyBookingAccepted = async () => {};

  const result = await service.acceptRideRequest(
    "request-1",
    "driver-1"
  );

  assert.equal(result.status, "ACCEPTED");
  assert.equal(calls.accept.length, 1);
  assert.equal(calls.cancel.length, 0);
});

test("driver without an assigned vehicle cannot accept a ride", async () => {
  const { calls } = createHarness();

  const service = new DriverRideRequestService(
    {
      async acceptRideRequest(id, driverId) {
        calls.accept.push({ id, driverId });
        return createRequest();
      },
      async cancelConflictingAcceptance(id, driverId) {
        calls.cancel.push({ id, driverId });
        return true;
      },
    },
    async () => {
      const error = new Error(
        "You cannot accept a ride because no vehicle is assigned to your driver account"
      );
      error.statusCode = 409;
      throw error;
    }
  );

  await assert.rejects(
    service.acceptRideRequest("request-1", "driver-1"),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /no vehicle is assigned/i);
      return true;
    }
  );

  assert.equal(calls.accept.length, 0);
  assert.equal(calls.cancel.length, 0);
});

test("driver with an unavailable vehicle cannot accept a ride", async () => {
  const { calls } = createHarness();

  const service = new DriverRideRequestService(
    {
      async acceptRideRequest(id, driverId) {
        calls.accept.push({ id, driverId });
        return createRequest();
      },
      async cancelConflictingAcceptance(id, driverId) {
        calls.cancel.push({ id, driverId });
        return true;
      },
    },
    async () => {
      const error = new Error("Your assigned vehicle is not available");
      error.statusCode = 409;
      throw error;
    }
  );

  await assert.rejects(
    service.acceptRideRequest("request-1", "driver-1"),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /vehicle is not available/i);
      return true;
    }
  );

  assert.equal(calls.accept.length, 0);
});

test("competing-driver conflict cancels the losing request", async () => {
  const { service, calls } = createHarness();

  bookingClient.notifyBookingAccepted = async () => {
    throw new bookingClient.BookingServiceError(
      "Booking already claimed",
      409,
      true
    );
  };

  await assert.rejects(
    service.acceptRideRequest("request-1", "driver-1"),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /ride request was cancelled/i);
      return true;
    }
  );

  assert.deepEqual(calls.cancel, [
    { id: "request-1", driverId: "driver-1" },
  ]);
});

test("Booking Service outage does not cancel the request", async () => {
  const { service, calls } = createHarness();

  bookingClient.notifyBookingAccepted = async () => {
    throw new bookingClient.BookingServiceError(
      "Booking Service is unavailable"
    );
  };
  bookingClient.getBookingAcceptanceState = async () => {
    throw new bookingClient.BookingServiceError(
      "Booking Service is unavailable"
    );
  };

  await assert.rejects(
    service.acceptRideRequest("request-1", "driver-1"),
    /Booking Service is unavailable/
  );

  assert.equal(calls.cancel.length, 0);
});


test("lost acceptance response succeeds when booking confirms the same driver", async () => {
  const { service, calls } = createHarness();

  bookingClient.notifyBookingAccepted = async () => {
    throw new Error("Connection reset after request");
  };
  bookingClient.getBookingAcceptanceState = async () => ({
    id: "booking-1",
    status: "CONFIRMED",
    driverId: "driver-1",
  });

  const result = await service.acceptRideRequest(
    "request-1",
    "driver-1"
  );

  assert.equal(result.status, "ACCEPTED");
  assert.equal(calls.cancel.length, 0);
});

test("lost acceptance response cancels request when another driver owns booking", async () => {
  const { service, calls } = createHarness();

  bookingClient.notifyBookingAccepted = async () => {
    throw new Error("Connection reset after request");
  };
  bookingClient.getBookingAcceptanceState = async () => ({
    id: "booking-1",
    status: "CONFIRMED",
    driverId: "driver-2",
  });

  await assert.rejects(
    service.acceptRideRequest("request-1", "driver-1"),
    (error) => {
      assert.equal(error.statusCode, 409);
      assert.match(error.message, /ride request was cancelled/i);
      return true;
    }
  );

  assert.deepEqual(calls.cancel, [
    { id: "request-1", driverId: "driver-1" },
  ]);
});

test("failed reconciliation lookup does not cancel the request", async () => {
  const { service, calls } = createHarness();

  bookingClient.notifyBookingAccepted = async () => {
    throw new bookingClient.BookingServiceError(
      "Booking Service is unavailable"
    );
  };
  bookingClient.getBookingAcceptanceState = async () => {
    throw new bookingClient.BookingServiceError(
      "Could not verify booking acceptance outcome"
    );
  };

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await assert.rejects(
      service.acceptRideRequest("request-1", "driver-1"),
      /Booking Service is unavailable/
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.equal(calls.cancel.length, 0);
});

test("failed conflict cleanup requires manual reconciliation", async () => {
  const { service, calls } = createHarness();
  const repositoryError = new Error("database cleanup failed");

  const repository = {
    async acceptRideRequest() {
      return createRequest();
    },
    async cancelConflictingAcceptance() {
      calls.cancel.push("attempted");
      throw repositoryError;
    },
  };

  const serviceWithFailingCleanup =
    new DriverRideRequestService(
      repository,
      async () => {}
    );

  bookingClient.notifyBookingAccepted = async () => {
    throw new bookingClient.BookingServiceError(
      "Booking already claimed",
      409,
      true
    );
  };

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await assert.rejects(
      serviceWithFailingCleanup.acceptRideRequest(
        "request-1",
        "driver-1"
      ),
      /manual reconciliation is required/
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(calls.cancel, ["attempted"]);
});

test("confirmed booking with failed losing-request cleanup requires manual reconciliation", async () => {
  const { calls } = createHarness();
  const repositoryError = new Error("database cleanup failed");

  const repository = {
    async acceptRideRequest() {
      return createRequest();
    },
    async cancelConflictingAcceptance() {
      calls.cancel.push("attempted");
      throw repositoryError;
    },
  };

  const service = new DriverRideRequestService(
    repository,
    async () => {}
  );

  bookingClient.notifyBookingAccepted = async () => {
    throw new Error("Connection reset after request");
  };

  bookingClient.getBookingAcceptanceState = async () => ({
    id: "booking-1",
    status: "CONFIRMED",
    driverId: "driver-2",
  });

  const originalConsoleError = console.error;
  console.error = () => {};

  try {
    await assert.rejects(
      service.acceptRideRequest("request-1", "driver-1"),
      /manual reconciliation is required/
    );
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(calls.cancel, ["attempted"]);
});
