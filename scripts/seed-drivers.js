/*
 * Seed 2 drivers per ride category (AUTO, ECONOMY, COMFORT, COMFORT_PLUS),
 * each with a driver login, a driver profile and an assigned vehicle.
 *
 * Runs inside any backend pod, which already has the service URLs and the
 * internal service token in its environment:
 *
 *   kubectl -n jhanvi-cars exec -i deploy/booking -- \
 *     env DRIVER_PASSWORD='choose-a-password' node - < scripts/seed-drivers.js
 *
 * Safe to re-run: existing drivers and vehicles are reused, not duplicated.
 * All 8 accounts share DRIVER_PASSWORD (min 8 characters).
 */

const AUTH = process.env.AUTH_SERVICE_URL || "http://auth-service:3001";
const DRIVER = process.env.DRIVER_SERVICE_URL || "http://driver-service:3003";
const VEHICLE = process.env.VEHICLE_SERVICE_URL || "http://vehicle-service:3005";
const TOKEN = process.env.INTERNAL_SERVICE_TOKEN || "";
const PASSWORD = process.env.DRIVER_PASSWORD || "";

// Ride category (driver-service) -> vehicle body type (vehicle-service).
const DRIVERS = [
  { category: "AUTO", type: "AUTO", name: "Ramesh Kumar", make: "Bajaj", model: "RE Compact", reg: "KA01AB1101" },
  { category: "AUTO", type: "AUTO", name: "Suresh Gowda", make: "Piaggio", model: "Ape City", reg: "KA01AB1102" },
  { category: "ECONOMY", type: "HATCHBACK", name: "Venkatesh Rao", make: "Maruti Suzuki", model: "Swift", reg: "KA02CD2201" },
  { category: "ECONOMY", type: "HATCHBACK", name: "Manjunath S", make: "Hyundai", model: "i20", reg: "KA02CD2202" },
  { category: "COMFORT", type: "SEDAN", name: "Prakash Reddy", make: "Honda", model: "City", reg: "KA03EF3301" },
  { category: "COMFORT", type: "SEDAN", name: "Mahesh Naidu", make: "Maruti Suzuki", model: "Dzire", reg: "KA03EF3302" },
  { category: "COMFORT_PLUS", type: "SUV", name: "Anil Shetty", make: "Toyota", model: "Innova Crysta", reg: "KA04GH4401" },
  { category: "COMFORT_PLUS", type: "SUV", name: "Kiran Patil", make: "Mahindra", model: "XUV700", reg: "KA04GH4402" },
];

const internal = {
  "Content-Type": "application/json",
  "x-internal-service-token": TOKEN,
};

async function call(method, url, body, headers = internal) {
  const res = await fetch(url, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

function fail(message) {
  console.error(`ERROR: ${message}`);
  process.exit(1);
}

(async () => {
  if (PASSWORD.length < 8) {
    fail("Set DRIVER_PASSWORD (at least 8 characters) for the driver logins.");
  }
  if (!TOKEN) {
    fail("INTERNAL_SERVICE_TOKEN is not set. Run this inside a backend pod.");
  }

  const vehiclesRes = await call("GET", `${VEHICLE}/vehicles/`);
  if (!vehiclesRes.ok || !Array.isArray(vehiclesRes.data)) {
    fail(`Could not list vehicles (HTTP ${vehiclesRes.status}).`);
  }
  const vehicles = vehiclesRes.data;

  const rows = [];

  for (const [i, d] of DRIVERS.entries()) {
    const n = i + 1;
    const slug = `${d.category.toLowerCase().replace("_", "")}${(i % 2) + 1}`;
    const email = `driver.${slug}@jhanvicars.in`;
    const mobile = `90000001${String(n).padStart(2, "0")}`;
    const vehicleNumber = d.reg;

    // 1. Driver login + driver profile (auth-service creates both).
    let reg = await call(
      "POST",
      `${AUTH}/auth/register`,
      {
        fullName: d.name,
        email,
        mobileNumber: mobile,
        password: PASSWORD,
        role: "DRIVER",
        licenseNumber: `KA-DL-2026-${String(n).padStart(4, "0")}`,
        vehicleNumber,
        vehicleType: d.category,
        vehicleModel: `${d.make} ${d.model}`,
      },
      { "Content-Type": "application/json" }
    );

    let userId = reg.data?.data?.user?.id;
    let note = "created";

    if (!reg.ok) {
      // Already registered on an earlier run: log in to get the user id.
      const login = await call(
        "POST",
        `${AUTH}/auth/login`,
        { identifier: email, password: PASSWORD },
        { "Content-Type": "application/json" }
      );
      userId = login.data?.data?.user?.id;
      note = "existing";
      if (!userId) {
        console.error(
          `  ${email}: register HTTP ${reg.status} (${reg.data?.error?.message ?? reg.data?.message ?? "error"}), ` +
            `login HTTP ${login.status}. Skipping.`
        );
        continue;
      }
    }

    const driverId = `driver-${userId}`;
    const driver = await call("GET", `${DRIVER}/drivers/${encodeURIComponent(driverId)}`);
    if (!driver.ok) {
      console.error(`  ${email}: driver profile ${driverId} not found (HTTP ${driver.status}). Skipping.`);
      continue;
    }

    // 2. Vehicle explicitly assigned to the driver.
    let vehicle =
      vehicles.find((v) => v.driverId === driverId) ||
      vehicles.find((v) => v.registrationNumber === vehicleNumber);

    if (vehicle && vehicle.driverId !== driverId) {
      const upd = await call("PUT", `${VEHICLE}/vehicles/${encodeURIComponent(vehicle.id)}`, {
        driverId,
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
        type: vehicle.type,
      });
      if (!upd.ok) {
        console.error(`  ${email}: could not assign vehicle ${vehicleNumber} (HTTP ${upd.status}). Skipping.`);
        continue;
      }
      vehicle = upd.data;
    }

    if (!vehicle) {
      const created = await call("POST", `${VEHICLE}/vehicles/`, {
        driverId,
        registrationNumber: vehicleNumber,
        make: d.make,
        model: d.model,
        year: 2023,
        type: d.type,
        status: "AVAILABLE",
      });
      if (!created.ok) {
        console.error(
          `  ${email}: vehicle create HTTP ${created.status} (${created.data?.message ?? "error"}). Skipping.`
        );
        continue;
      }
      vehicle = created.data;
    }

    rows.push({
      category: d.category,
      name: d.name,
      login: email,
      mobile,
      vehicle: `${d.make} ${d.model} (${vehicle.registrationNumber})`,
      status: note,
    });
  }

  console.table(rows);
  console.log(
    `\n${rows.length}/${DRIVERS.length} drivers ready. Log in with the email or mobile ` +
      `above and DRIVER_PASSWORD, then go online to receive rides.`
  );
  if (rows.length !== DRIVERS.length) process.exit(1);
})().catch((err) => fail(err?.stack || String(err)));
