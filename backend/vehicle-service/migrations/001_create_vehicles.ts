import { Knex } from "knex";

export async function up(
  knex: Knex
): Promise<void> {

  await knex.schema
    .withSchema("vehicle_schema")
    .createTable(
      "vehicles",
      (table) => {

        table
          .string("id")
          .primary();

        table
          .string("driver_id")
          .nullable();

        table
          .string("registration_number")
          .notNullable()
          .unique();

        table
          .string("make")
          .notNullable();

        table
          .string("model")
          .notNullable();

        table
          .integer("year")
          .notNullable();

        table
          .string("type")
          .notNullable();

        table
          .string("status")
          .notNullable()
          .defaultTo("AVAILABLE");

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
          "driver_id"
        ]);

        table.index([
          "status"
        ]);

        table.index([
          "type"
        ]);
      }
    );
}

export async function down(
  knex: Knex
): Promise<void> {

  await knex.schema
    .withSchema("vehicle_schema")
    .dropTableIfExists(
      "vehicles"
    );
}
