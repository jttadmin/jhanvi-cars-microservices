import type { Knex } from "knex";

export async function up(knex: Knex): Promise<void> {
  await knex.schema.alterTable("notifications", (table) => {
    table.string("idempotency_key", 200).nullable().unique();
    table.integer("attempt_count").notNullable().defaultTo(0);
    table.timestamp("next_attempt_at", { useTz: true }).nullable();
    table.text("last_error").nullable();
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.alterTable("notifications", (table) => {
    table.dropUnique(["idempotency_key"]);
    table.dropColumn("idempotency_key");
    table.dropColumn("attempt_count");
    table.dropColumn("next_attempt_at");
    table.dropColumn("last_error");
  });
}
