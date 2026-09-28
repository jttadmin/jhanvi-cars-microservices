import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasVehicleType = await knex.schema
    .withSchema("driver_schema")
    .hasColumn("drivers", "vehicle_type");

  const hasVehicleModel = await knex.schema
    .withSchema("driver_schema")
    .hasColumn("drivers", "vehicle_model");

  if (!hasVehicleType) {
    await knex.schema
      .withSchema("driver_schema")
      .alterTable("drivers", (table) => {
        table.string("vehicle_type");
      });
  }

  if (!hasVehicleModel) {
    await knex.schema
      .withSchema("driver_schema")
      .alterTable("drivers", (table) => {
        table.string("vehicle_model");
      });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("driver_schema")
    .alterTable("drivers", (table) => {
      table.dropColumn("vehicle_type");
      table.dropColumn("vehicle_model");
    });
}
