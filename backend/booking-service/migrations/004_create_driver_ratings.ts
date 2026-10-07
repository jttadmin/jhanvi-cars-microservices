import { Knex } from "knex";

export async function up(
  knex: Knex
): Promise<void> {

  await knex.schema
    .withSchema("booking_schema")
    .createTable(
      "driver_ratings",
      (table) => {

        table
          .string("id")
          .primary();

        table
          .string("booking_id")
          .notNullable()
          .unique();

        table
          .string("customer_id")
          .notNullable();

        table
          .string("driver_id")
          .notNullable();

        table
          .integer("rating")
          .notNullable();

        table
          .text("comment")
          .nullable();

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
          "customer_id"
        ]);

        table.index([
          "driver_id"
        ]);

        table.index([
          "rating"
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
      "driver_ratings"
    );
}
