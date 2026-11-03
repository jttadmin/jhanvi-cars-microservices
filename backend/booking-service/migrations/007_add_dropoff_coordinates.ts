import { Knex } from "knex";

const schema = () => process.env.DB_SCHEMA ?? "booking_schema";

// Drop-off point, so live tracking can show the route and ETA to it.
export async function up(knex: Knex): Promise<void> {
  const has = await knex.schema
    .withSchema(schema())
    .hasColumn("bookings", "dropoff_latitude");

  if (!has) {
    await knex.schema
      .withSchema(schema())
      .table("bookings", (table) => {
        table.decimal("dropoff_latitude", 10, 7).nullable();
        table.decimal("dropoff_longitude", 10, 7).nullable();
      });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema(schema())
    .table("bookings", (table) => {
      table.dropColumn("dropoff_latitude");
      table.dropColumn("dropoff_longitude");
    });
}
