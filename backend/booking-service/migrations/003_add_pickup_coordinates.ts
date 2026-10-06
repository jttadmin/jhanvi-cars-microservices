import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasLatitude = await knex.schema
    .withSchema(process.env.DB_SCHEMA ?? "booking_schema")
    .hasColumn("bookings", "pickup_latitude");

  if (!hasLatitude) {
    await knex.schema
      .withSchema(process.env.DB_SCHEMA ?? "booking_schema")
      .table("bookings", (table) => {
        table.decimal("pickup_latitude", 10, 7).nullable();
        table.decimal("pickup_longitude", 10, 7).nullable();
      });
  }
}

export async function down(knex: Knex): Promise<void> {
  const schema = process.env.DB_SCHEMA ?? "booking_schema";

  await knex.schema
    .withSchema(schema)
    .table("bookings", (table) => {
      table.dropColumn("pickup_latitude");
      table.dropColumn("pickup_longitude");
    });
}
