import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {

  await knex.schema.createTable(
    "notifications",
    (table) => {

      table
        .string("id", 100)
        .primary();

      table
        .string("user_id", 100)
        .notNullable();

      table
        .string("booking_id", 100)
        .nullable();

      table
        .string("channel", 30)
        .notNullable();

      table
        .string("title", 200)
        .notNullable();

      table
        .text("message")
        .notNullable();

      table
        .string("status", 30)
        .notNullable()
        .defaultTo("PENDING");

      table
        .string("recipient", 320)
        .notNullable();

      table
        .timestamp("created_at")
        .notNullable()
        .defaultTo(knex.fn.now());

      table
        .timestamp("updated_at")
        .notNullable()
        .defaultTo(knex.fn.now());

      table.index(["user_id"]);
      table.index(["booking_id"]);
      table.index(["status"]);
      table.index(["channel"]);
    }
  );
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .dropTableIfExists("notifications");
}
