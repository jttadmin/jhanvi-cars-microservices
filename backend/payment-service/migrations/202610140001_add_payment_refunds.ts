import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payments", (table) => {
    table.string("refund_id", 150).nullable();
    table.string("refund_request_id", 100).nullable().unique();
    table.string("refund_status", 30).nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("payments", (table) => {
    table.dropColumn("refund_status");
    table.dropColumn("refund_request_id");
    table.dropColumn("refund_id");
  });
}
