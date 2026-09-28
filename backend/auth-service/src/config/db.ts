import type { Knex } from 'knex';

import { AppRuntime } from './runtime';

let runtime: AppRuntime | undefined;

export async function initializeRuntime(): Promise<AppRuntime> {
  if (runtime) {
    return runtime;
  }

  runtime = await AppRuntime.create();

  return runtime;
}

export function getRuntime(): AppRuntime {
  if (!runtime) {
    throw new Error('Application runtime has not been initialized');
  }

  return runtime;
}

export function getDb(): Knex {
  return getRuntime().databaseManager.current();
}