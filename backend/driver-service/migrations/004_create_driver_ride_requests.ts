import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema
    .withSchema("driver_schema")
    .hasTable("driver_ride_requests");

  if (!exists) {
    await knex.schema
      .withSchema("driver_schema")
      .createTable("driver_ride_requests", (table) => {
        table.string("id").primary();

        table.string("booking_id").notNullable();

        table.string("driver_id")
          .notNullable()
          .references("id")
          .inTable("driver_schema.drivers")
          .onDelete("CASCADE");

        table.decimal("pickup_latitude", 10, 7).notNullable();

        table.decimal("pickup_longitude", 10, 7).notNullable();

        table
          .enu("status", [
            "OFFERED",
            "ACCEPTED",
            "REJECTED",
            "EXPIRED",
            "CANCELLED",
          ], {
            useNative: false,
            enumName: "driver_ride_request_status",
          })
          .notNullable()
          .defaultTo("OFFERED");

        table.timestamp("created_at")
          .notNullable()
          .defaultTo(knex.fn.now());

        table.timestamp("expires_at")
          .notNullable();

        table.timestamp("responded_at")
          .nullable();

        table.index(["driver_id", "status"]);

        table.index(["booking_id"]);

        table.index(["status", "expires_at"]);
      });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("driver_schema")
    .dropTableIfExists("driver_ride_requests");
}
