import type { Knex } from 'knex';

const SCHEMA = 'user_schema';

export async function up(
  knex: Knex,
): Promise<void> {
  await knex.schema
    .withSchema(SCHEMA)
    .createTable(
      'user_profiles',
      (table) => {
        table.uuid('user_id').primary();

        table
          .string('display_name', 120)
          .nullable();

        table
          .text('bio')
          .nullable();

        table
          .string('avatar_url', 500)
          .nullable();

        table
          .timestamp('created_at', {
            useTz: true,
          })
          .notNullable()
          .defaultTo(knex.fn.now());

        table
          .timestamp('updated_at', {
            useTz: true,
          })
          .notNullable()
          .defaultTo(knex.fn.now());
      },
    );
}

export async function down(
  knex: Knex,
): Promise<void> {
  await knex.schema
    .withSchema(SCHEMA)
    .dropTableIfExists(
      'user_profiles',
    );
}