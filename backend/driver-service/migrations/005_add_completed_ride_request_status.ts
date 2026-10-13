import { Knex } from "knex";

const TABLE = "driver_schema.driver_ride_requests";
const CONSTRAINT = "driver_ride_requests_status_check";

const LEGACY_STATUSES = [
  "OFFERED",
  "ACCEPTED",
  "REJECTED",
  "EXPIRED",
  "CANCELLED",
];

const ALL_STATUSES = [
  ...LEGACY_STATUSES,
  "COMPLETED",
];

export async function up(knex: Knex): Promise<void> {
  const tableExists = await knex.schema
    .withSchema("driver_schema")
    .hasTable("driver_ride_requests");

  if (!tableExists) {
    throw new Error(`${TABLE} does not exist`);
  }

  const result = await knex.raw(
    `
      SELECT
        c.conname AS constraint_name,
        pg_get_constraintdef(c.oid) AS definition
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = 'driver_schema'
        AND t.relname = 'driver_ride_requests'
        AND c.conname = ?
        AND c.contype = 'c'
    `,
    [CONSTRAINT]
  );

  const existing = result.rows[0] as
    | { constraint_name: string; definition: string }
    | undefined;

  if (existing?.definition.includes("'COMPLETED'")) {
    return;
  }

  if (existing) {
    await knex.raw(
      `ALTER TABLE ${TABLE} DROP CONSTRAINT ??`,
      [CONSTRAINT]
    );
  }

  const allowedStatuses = ALL_STATUSES
    .map((status) => `'${status}'`)
    .join(", ");

  await knex.raw(
    `ALTER TABLE ${TABLE}
     ADD CONSTRAINT ?? CHECK (status IN (${allowedStatuses}))`,
    [CONSTRAINT]
  );
}

export async function down(knex: Knex): Promise<void> {
  const tableExists = await knex.schema
    .withSchema("driver_schema")
    .hasTable("driver_ride_requests");

  if (!tableExists) {
    throw new Error(`${TABLE} does not exist`);
  }

  const completed = await knex(TABLE)
    .withSchema("driver_schema")
    .where({ status: "COMPLETED" })
    .count({ count: "*" })
    .first();

  if (Number(completed?.count ?? 0) > 0) {
    throw new Error(
      "Cannot roll back migration 005 while COMPLETED ride requests exist"
    );
  }

  await knex.raw(
    `ALTER TABLE ${TABLE} DROP CONSTRAINT IF EXISTS ??`,
    [CONSTRAINT]
  );

  const allowedStatuses = LEGACY_STATUSES
    .map((status) => `'${status}'`)
    .join(", ");

  await knex.raw(
    `ALTER TABLE ${TABLE}
     ADD CONSTRAINT ?? CHECK (status IN (${allowedStatuses}))`,
    [CONSTRAINT]
  );
}
