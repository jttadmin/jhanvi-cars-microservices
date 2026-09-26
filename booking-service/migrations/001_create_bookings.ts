import { Knex } from "knex";

export async function up(
  knex: Knex
): Promise<void> {

  await knex.schema
    .withSchema("booking_schema")
    .createTable(
      "bookings",
      (table) => {

        table
          .string("id")
          .primary();

        table
          .string("user_id")
          .notNullable();

        table
          .string("driver_id")
          .nullable();

        table
          .string("pickup_location")
          .notNullable();

        table
          .string("dropoff_location")
          .notNullable();

        table
          .timestamp(
            "scheduled_at",
            { useTz: true }
          )
          .notNullable();

        table
          .string("status")
          .notNullable()
          .defaultTo("PENDING");

        table
          .decimal("fare", 12, 2)
          .notNullable()
          .defaultTo(0);

        table
          .timestamp(
            "created_at",
            { useTz: true }
          )
          .notNullable()
          .defaultTo(knex.fn.now());

        table
          .timestamp(
            "updated_at",
            { useTz: true }
          )
          .notNullable()
          .defaultTo(knex.fn.now());

        table.index([
          "user_id"
        ]);

        table.index([
          "driver_id"
        ]);

        table.index([
          "status"
        ]);

        table.index([
          "scheduled_at"
        ]);
      }
    );
}

export async function down(
  knex: Knex
): Promise<void> {

  await knex.schema
    .withSchema("booking_schema")
    .dropTableIfExists(
      "bookings"
    );
}
