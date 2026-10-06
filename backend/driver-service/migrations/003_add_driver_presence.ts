import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasOnline = await knex.schema
    .withSchema("driver_schema")
    .hasColumn("drivers", "is_online");

  const hasLatitude = await knex.schema
    .withSchema("driver_schema")
    .hasColumn("drivers", "latitude");

  const hasLongitude = await knex.schema
    .withSchema("driver_schema")
    .hasColumn("drivers", "longitude");

  const hasLastLocationAt = await knex.schema
    .withSchema("driver_schema")
    .hasColumn("drivers", "last_location_at");

  await knex.schema
    .withSchema("driver_schema")
    .alterTable("drivers", (table) => {
      if (!hasOnline) {
        table.boolean("is_online").notNullable().defaultTo(false);
      }

      if (!hasLatitude) {
        table.decimal("latitude", 10, 7).nullable();
      }

      if (!hasLongitude) {
        table.decimal("longitude", 10, 7).nullable();
      }

      if (!hasLastLocationAt) {
        table.timestamp("last_location_at").nullable();
      }
    });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("driver_schema")
    .alterTable("drivers", (table) => {
      table.dropColumn("is_online");
      table.dropColumn("latitude");
      table.dropColumn("longitude");
      table.dropColumn("last_location_at");
    });
}
