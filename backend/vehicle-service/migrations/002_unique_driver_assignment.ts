import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.raw(`
    CREATE UNIQUE INDEX vehicles_driver_id_unique
    ON vehicle_schema.vehicles (driver_id)
    WHERE driver_id IS NOT NULL
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.raw(`
    DROP INDEX IF EXISTS vehicle_schema.vehicles_driver_id_unique
  `);
}
