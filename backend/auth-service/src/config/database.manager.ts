import knex, { Knex } from 'knex';

import type { RuntimeConfig } from './config.types';

export interface DatabaseManagerOptions {
  createClient?: (config: Knex.Config) => Knex;
}

export class DatabaseManager {
  private readonly createClient: (
    config: Knex.Config,
  ) => Knex;

  private client?: Knex;

  constructor(options: DatabaseManagerOptions = {}) {
    this.createClient =
      options.createClient ??
      ((config) => knex(config));
  }

  current(): Knex {
    if (!this.client) {
      throw new Error('Database has not been initialized');
    }

    return this.client;
  }

  async initialize(config: RuntimeConfig): Promise<void> {
    if (this.client) {
      throw new Error('Database has already been initialized');
    }

    const client = this.createClient(this.createKnexConfig(config));

    try {
      await client.raw('select 1');
      this.client = client;
    } catch (error) {
      await client.destroy();
      throw error;
    }
  }

  async rotate(config: RuntimeConfig): Promise<void> {
    const nextClient = this.createClient(this.createKnexConfig(config));

    try {
      await nextClient.raw('select 1');
    } catch (error) {
      await nextClient.destroy();
      throw error;
    }

    const previousClient = this.client;
    this.client = nextClient;

    if (previousClient) {
      await previousClient.destroy();
    }
  }

  async close(): Promise<void> {
    const client = this.client;
    this.client = undefined;

    if (client) {
      await client.destroy();
    }
  }

  private createKnexConfig(config: RuntimeConfig): Knex.Config {
    return {
      client: 'pg',
      connection: config.databaseUrl,
      searchPath: [config.dbSchema, 'public'],
      pool: {
        min: 1,
        max: 10,
      },
    };
  }
}