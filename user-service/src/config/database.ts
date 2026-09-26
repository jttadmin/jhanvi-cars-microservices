import knex, { type Knex } from 'knex';

import type { AppConfig } from './config.types';

let database: Knex | undefined;

export function getDatabase(): Knex {
  if (!database) {
    throw new Error('Database has not been initialized');
  }

  return database;
}

export async function initializeDatabase(config: AppConfig): Promise<void> {
  if (database) {
    return;
  }

  const client = knex({
    client: 'pg',
    connection: config.databaseUrl,
    searchPath: [config.dbSchema, 'public'],
    pool: {
      min: 1,
      max: 10
    }
  });

  try {
    await client.raw('select 1');
    database = client;
  } catch (error) {
    await client.destroy();
    throw error;
  }
}

export async function closeDatabase(): Promise<void> {
  const client = database;

  database = undefined;

  if (client) {
    await client.destroy();
  }
}
