import { Knex } from "knex";

const schema = () => process.env.DB_SCHEMA ?? "booking_schema";

/*
 * Default rates follow the Government of Karnataka notifications:
 * - Cabs (city taxis and app-based aggregators), Feb 2024 uniform fare order,
 *   by vehicle cost: up to Rs 10 lakh Rs 100 min + Rs 24/km; Rs 10-15 lakh
 *   Rs 115 + Rs 28/km; above Rs 15 lakh Rs 130 + Rs 32/km. 10% extra from
 *   midnight to 6 am, 5% GST may be collected, surge pricing not allowed.
 * - Autos, Bengaluru, effective 1 Aug 2025: Rs 36 for the first 2 km,
 *   Rs 18/km after, 1.5x from 10 pm to 5 am.
 * Admins can change every value from the admin portal when rates are revised.
 */
const DEFAULTS = [
  {
    vehicle_type: "AUTO",
    min_fare: 36,
    min_km: 2,
    per_km: 18,
    night_start: "22:00",
    night_end: "05:00",
    night_surcharge_percent: 50,
    gst_percent: 0,
    source: "Karnataka auto fare notification, effective 1 Aug 2025 (Bengaluru)",
  },
  {
    vehicle_type: "ECONOMY",
    min_fare: 100,
    min_km: 4,
    per_km: 24,
    night_start: "00:00",
    night_end: "06:00",
    night_surcharge_percent: 10,
    gst_percent: 5,
    source: "Karnataka uniform cab fare order, Feb 2024 (vehicle cost up to Rs 10 lakh)",
  },
  {
    vehicle_type: "COMFORT",
    min_fare: 115,
    min_km: 4,
    per_km: 28,
    night_start: "00:00",
    night_end: "06:00",
    night_surcharge_percent: 10,
    gst_percent: 5,
    source: "Karnataka uniform cab fare order, Feb 2024 (vehicle cost Rs 10-15 lakh)",
  },
  {
    vehicle_type: "COMFORT_PLUS",
    min_fare: 130,
    min_km: 4,
    per_km: 32,
    night_start: "00:00",
    night_end: "06:00",
    night_surcharge_percent: 10,
    gst_percent: 5,
    source: "Karnataka uniform cab fare order, Feb 2024 (vehicle cost above Rs 15 lakh)",
  },
];

export async function up(knex: Knex): Promise<void> {
  const s = schema();

  if (!(await knex.schema.withSchema(s).hasTable("fare_rules"))) {
    await knex.schema.withSchema(s).createTable("fare_rules", (table) => {
      table.string("vehicle_type", 20).primary();
      table.decimal("min_fare", 10, 2).notNullable();
      table.decimal("min_km", 6, 2).notNullable();
      table.decimal("per_km", 10, 2).notNullable();
      // Local (Asia/Kolkata) HH:MM; the window may cross midnight.
      table.string("night_start", 5).notNullable();
      table.string("night_end", 5).notNullable();
      table.decimal("night_surcharge_percent", 5, 2).notNullable().defaultTo(0);
      table.decimal("gst_percent", 5, 2).notNullable().defaultTo(0);
      table.string("source", 255).nullable();
      table.string("updated_by").nullable();
      table.timestamp("updated_at").notNullable().defaultTo(knex.fn.now());
    });

    await knex.withSchema(s).table("fare_rules").insert(DEFAULTS);
  }

  if (!(await knex.schema.withSchema(s).hasColumn("bookings", "distance_km"))) {
    await knex.schema.withSchema(s).table("bookings", (table) => {
      // Trip distance the fare was calculated from.
      table.decimal("distance_km", 8, 2).nullable();
    });
  }
}

export async function down(knex: Knex): Promise<void> {
  const s = schema();
  await knex.schema.withSchema(s).dropTableIfExists("fare_rules");
  await knex.schema.withSchema(s).table("bookings", (table) => {
    table.dropColumn("distance_km");
  });
}
