import { ConfigManager } from '../src/config/config.manager';
import type { RuntimeConfig } from '../src/config/config.types';

function createConfig(
  overrides: Partial<RuntimeConfig> = {},
): RuntimeConfig {
  return {
    port: 3001,
    serviceName: 'auth-service',
    nodeEnv: 'test',
    dbSchema: 'auth_schema',
    authProvider: 'local',
    jwtExpiresIn: '1h',
    databaseUrl: 'postgresql://old:old@localhost:5432/old',
    jwtSecret: 'old-secret',
    ...overrides,
  };
}

describe('ConfigManager', () => {
  it('returns the current configuration', () => {
    const config = createConfig();
    const manager = new ConfigManager(config);

    expect(manager.current()).toEqual(config);
  });

  it('updates secrets while preserving static configuration', async () => {
    const manager = new ConfigManager(createConfig());

    await manager.updateSecrets({
      databaseUrl: 'postgresql://new:new@localhost:5432/new',
      jwtSecret: 'new-secret',
    });

    expect(manager.current()).toEqual(
      createConfig({
        databaseUrl: 'postgresql://new:new@localhost:5432/new',
        jwtSecret: 'new-secret',
      }),
    );
  });

  it('notifies subscribers when secrets change', async () => {
    const manager = new ConfigManager(createConfig());
    const listener = jest.fn();

    manager.subscribe(listener);

    const nextSecrets = {
      databaseUrl: 'postgresql://new:new@localhost:5432/new',
      jwtSecret: 'new-secret',
    };

    await manager.updateSecrets(nextSecrets);

    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining(nextSecrets),
      expect.objectContaining({
        databaseUrl: 'postgresql://old:old@localhost:5432/old',
        jwtSecret: 'old-secret',
      }),
    );
  });

  it('can unsubscribe a listener', async () => {
    const manager = new ConfigManager(createConfig());
    const listener = jest.fn();

    const unsubscribe = manager.subscribe(listener);
    unsubscribe();

    await manager.updateSecrets({
      databaseUrl: 'postgresql://new:new@localhost:5432/new',
      jwtSecret: 'new-secret',
    });

    expect(listener).not.toHaveBeenCalled();
  });

  it('rolls back when a subscriber fails', async () => {
    const original = createConfig();
    const manager = new ConfigManager(original);

    manager.subscribe(() => {
      throw new Error('reload failed');
    });

    await expect(
      manager.updateSecrets({
        databaseUrl: 'postgresql://new:new@localhost:5432/new',
        jwtSecret: 'new-secret',
      }),
    ).rejects.toThrow('reload failed');

    expect(manager.current()).toEqual(original);
  });
});