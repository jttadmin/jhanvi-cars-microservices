import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.createTable("payments", (table) => {

    table.string("id", 100).primary();

    table.string("booking_id", 100).notNullable();
    table.string("user_id", 100).notNullable();

    table.decimal("amount", 12, 2).notNullable();

    table
      .string("currency", 3)
      .notNullable()
      .defaultTo("INR");

    table.string("method", 30).notNullable();

    table
      .string("status", 30)
      .notNullable()
      .defaultTo("PENDING");

    table
      .string("transaction_id", 150)
      .nullable()
      .unique();

    table
      .timestamp("created_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    table
      .timestamp("updated_at")
      .notNullable()
      .defaultTo(knex.fn.now());

    table.index(["booking_id"]);
    table.index(["user_id"]);
    table.index(["status"]);
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.dropTableIfExists("payments");
}
