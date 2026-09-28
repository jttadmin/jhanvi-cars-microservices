import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("booking_schema")
    .alterTable("bookings", (table) => {
      table
        .string("vehicle_type")
        .nullable();
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("booking_schema")
    .alterTable("bookings", (table) => {
      table.dropColumn("vehicle_type");
    });
}
