import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { ConfigManager } from '../src/config/config.manager';
import { SecretFileWatcher } from '../src/config/secret-file.watcher';
import type { RuntimeConfig } from '../src/config/config.types';

function createConfig(): RuntimeConfig {
  return {
    port: 3001,
    serviceName: 'auth-service',
    nodeEnv: 'test',
    dbSchema: 'auth_schema',
    authProvider: 'local',
    jwtExpiresIn: '1h',
    databaseUrl: 'postgresql://old:old@localhost:5432/old',
    jwtSecret: 'old-secret',
  };
}

describe('SecretFileWatcher', () => {
  let tempDirectory: string;
  let filePath: string;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(
      path.join(tmpdir(), 'auth-service-watcher-'),
    );

    filePath = path.join(tempDirectory, 'secrets.json');

    await writeFile(
      filePath,
      JSON.stringify({
        databaseUrl: 'postgresql://old:old@localhost:5432/old',
        jwtSecret: 'old-secret',
      }),
      'utf8',
    );
  });

  afterEach(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  it('reloads valid secrets', async () => {
    const manager = new ConfigManager(createConfig());

    const watcher = new SecretFileWatcher(filePath, manager);

    await writeFile(
      filePath,
      JSON.stringify({
        databaseUrl: 'postgresql://new:new@localhost:5432/new',
        jwtSecret: 'new-secret',
      }),
      'utf8',
    );

    await watcher.reloadNow();

    expect(manager.current().databaseUrl).toBe(
      'postgresql://new:new@localhost:5432/new',
    );
    expect(manager.current().jwtSecret).toBe('new-secret');

    watcher.stop();
  });

  it('keeps the existing configuration when the file is invalid', async () => {
    const manager = new ConfigManager(createConfig());

    const watcher = new SecretFileWatcher(filePath, manager);

    await writeFile(filePath, '{invalid-json', 'utf8');

    await watcher.reloadNow();

    expect(manager.current().databaseUrl).toBe(
      'postgresql://old:old@localhost:5432/old',
    );
    expect(manager.current().jwtSecret).toBe('old-secret');

    watcher.stop();
  });

  it('detects file changes automatically', async () => {
    const manager = new ConfigManager(createConfig());

    const watcher = new SecretFileWatcher(filePath, manager, {
      debounceMs: 25,
    });

    watcher.start();

    await writeFile(
      filePath,
      JSON.stringify({
        databaseUrl: 'postgresql://changed:changed@localhost:5432/changed',
        jwtSecret: 'changed-secret',
      }),
      'utf8',
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(manager.current().databaseUrl).toBe(
      'postgresql://changed:changed@localhost:5432/changed',
    );
    expect(manager.current().jwtSecret).toBe('changed-secret');

    watcher.stop();
  });

  it('can be stopped', async () => {
    const manager = new ConfigManager(createConfig());

    const watcher = new SecretFileWatcher(filePath, manager, {
      debounceMs: 25,
    });

    watcher.start();
    watcher.stop();

    await writeFile(
      filePath,
      JSON.stringify({
        databaseUrl: 'postgresql://ignored:ignored@localhost:5432/ignored',
        jwtSecret: 'ignored-secret',
      }),
      'utf8',
    );

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(manager.current().databaseUrl).toBe(
      'postgresql://old:old@localhost:5432/old',
    );
  });
});