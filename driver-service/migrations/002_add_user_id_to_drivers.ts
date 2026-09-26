import { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema
    .withSchema("driver_schema")
    .hasColumn("drivers", "user_id");

  if (!hasColumn) {
    await knex.schema
      .withSchema("driver_schema")
      .alterTable("drivers", (table) => {
        table.string("user_id").nullable();
      });
  }
}

export async function down(knex: Knex): Promise<void> {
  const hasColumn = await knex.schema
    .withSchema("driver_schema")
    .hasColumn("drivers", "user_id");

  if (hasColumn) {
    await knex.schema
      .withSchema("driver_schema")
      .alterTable("drivers", (table) => {
        table.dropColumn("user_id");
      });
  }
}
