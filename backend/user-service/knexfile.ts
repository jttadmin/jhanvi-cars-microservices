import type { Knex } from 'knex';

import 'dotenv/config';

const config: {
  [key: string]: Knex.Config
} = {
  development: {
    client: 'pg',
    connection:
      process.env.DATABASE_URL,

    searchPath: [
      process.env.DB_SCHEMA ??
        'user_schema',
      'public'
    ],

    migrations: {
      directory:
        './migrations',

      tableName:
        'knex_migrations_user',

      extension: 'ts'
    }
  }
};

export default config;
