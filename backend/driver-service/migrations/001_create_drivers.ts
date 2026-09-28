import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const exists = await knex.schema
    .withSchema("driver_schema")
    .hasTable("drivers");

  if (!exists) {
    await knex.schema
      .withSchema("driver_schema")
      .createTable("drivers", (table) => {
        table.string("id").primary();

        table.string("name").notNullable();

        table.string("email").notNullable().unique();

        table.string("phone").notNullable();

        table.string("license_number").notNullable().unique();

        table.string("vehicle_number").notNullable().unique();

        table.boolean("is_available")
          .notNullable()
          .defaultTo(false);

        table.timestamp("created_at")
          .notNullable()
          .defaultTo(knex.fn.now());

        table.timestamp("updated_at")
          .notNullable()
          .defaultTo(knex.fn.now());
      });
  }
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema
    .withSchema("driver_schema")
    .dropTableIfExists("drivers");
}
