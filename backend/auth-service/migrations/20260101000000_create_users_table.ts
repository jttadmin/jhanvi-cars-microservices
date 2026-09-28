import type { Knex } from 'knex';

const SCHEMA = 'auth_schema';

export async function up(knex: Knex): Promise<void> {

  await knex.schema.withSchema(SCHEMA).createTable('users', (table) => {
    table.uuid('id').primary().defaultTo(knex.raw('gen_random_uuid()'));
    table.string('full_name', 120).notNullable();
    table.string('email', 160).notNullable();
    table.string('mobile_number', 20).notNullable();
    table.string('password_hash', 255).notNullable();
    table
      .enu('role', ['CUSTOMER', 'DRIVER', 'ADMIN'], {
        useNative: true,
        enumName: 'user_role',
        schemaName: SCHEMA,
      })
      .notNullable()
      .defaultTo('CUSTOMER');
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now());

    table.unique('email');
    table.unique('mobile_number');
    table.index('role');
  });
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.withSchema(SCHEMA).dropTableIfExists('users');
  await knex.raw(`DROP TYPE IF EXISTS ${SCHEMA}.user_role`);
}
