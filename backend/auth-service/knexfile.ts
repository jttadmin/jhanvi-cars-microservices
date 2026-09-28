import type { Knex } from 'knex';
import 'dotenv/config';

// Separate, minimal config used only by the `knex` CLI for running
// migrations. Kept apart from src/config/db.ts (the app's runtime
// connection) so migrations can be run before the app ever boots.
const config: { [key: string]: Knex.Config } = {
  development: {
    client: 'pg',
    connection: process.env.DATABASE_URL,
    searchPath: [process.env.DB_SCHEMA ?? 'auth_schema', 'public'],
    migrations: {
      directory: './migrations',
      tableName: 'knex_migrations_auth',
      extension: 'ts',
    },
  },
};

export default config;
