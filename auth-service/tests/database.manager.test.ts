import { DatabaseManager } from '../src/config/database.manager';
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
    databaseUrl: 'postgresql://test:test@localhost:5432/test',
    jwtSecret: 'test-secret',
    ...overrides,
  };
}

function createMockClient() {
  return {
    raw: jest.fn().mockResolvedValue({}),
    destroy: jest.fn().mockResolvedValue(undefined),
  };
}

describe('DatabaseManager', () => {
  it('initializes a database client after a successful health check', async () => {
    const client = createMockClient();
    const createClient = jest.fn().mockReturnValue(client);

    const manager = new DatabaseManager({ createClient });

    const config = createConfig();

    await manager.initialize(config);

    expect(createClient).toHaveBeenCalledWith(
      expect.objectContaining({
        client: 'pg',
        connection: config.databaseUrl,
        searchPath: [config.dbSchema, 'public'],
      }),
    );

    expect(client.raw).toHaveBeenCalledWith('select 1');
    expect(manager.current()).toBe(client);
  });

  it('does not activate a client when initialization fails', async () => {
    const client = createMockClient();

    client.raw.mockRejectedValueOnce(new Error('connection failed'));

    const manager = new DatabaseManager({
      createClient: jest.fn().mockReturnValue(client),
    });

    await expect(manager.initialize(createConfig())).rejects.toThrow(
      'connection failed',
    );

    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(() => manager.current()).toThrow(
      'Database has not been initialized',
    );
  });

  it('switches to the new client before closing the old client', async () => {
    const oldClient = createMockClient();
    const newClient = createMockClient();

    const createClient = jest
      .fn()
      .mockReturnValueOnce(oldClient)
      .mockReturnValueOnce(newClient);

    const manager = new DatabaseManager({ createClient });

    await manager.initialize(createConfig());

    await manager.rotate(
      createConfig({
        databaseUrl: 'postgresql://new:new@localhost:5432/new',
      }),
    );

    expect(manager.current()).toBe(newClient);
    expect(oldClient.destroy).toHaveBeenCalledTimes(1);
    expect(newClient.destroy).not.toHaveBeenCalled();
  });

  it('keeps the old client when rotation health check fails', async () => {
    const oldClient = createMockClient();
    const newClient = createMockClient();

    newClient.raw.mockRejectedValueOnce(
      new Error('new credentials rejected'),
    );

    const createClient = jest
      .fn()
      .mockReturnValueOnce(oldClient)
      .mockReturnValueOnce(newClient);

    const manager = new DatabaseManager({ createClient });

    await manager.initialize(createConfig());

    await expect(
      manager.rotate(
        createConfig({
          databaseUrl: 'postgresql://bad:bad@localhost:5432/bad',
        }),
      ),
    ).rejects.toThrow('new credentials rejected');

    expect(manager.current()).toBe(oldClient);
    expect(oldClient.destroy).not.toHaveBeenCalled();
    expect(newClient.destroy).toHaveBeenCalledTimes(1);
  });

  it('closes the active client', async () => {
    const client = createMockClient();

    const manager = new DatabaseManager({
      createClient: jest.fn().mockReturnValue(client),
    });

    await manager.initialize(createConfig());
    await manager.close();

    expect(client.destroy).toHaveBeenCalledTimes(1);
    expect(() => manager.current()).toThrow(
      'Database has not been initialized',
    );
  });
});