import jwt from 'jsonwebtoken';

import { AppRuntime } from '../src/config/runtime';
import { tokenProvider } from '../src/services/token.service';

function createTestConfig() {
  return {
    port: 3001,
    serviceName: 'auth-service',
    nodeEnv: 'test',
    dbSchema: 'auth_schema',
    authProvider: 'local',
    jwtExpiresIn: '1h' as const,
    databaseUrl: 'postgresql://test:test@localhost:5432/test',
    jwtSecret: 'test-secret',
  };
}

describe('AppRuntime', () => {
  it('creates the runtime components from configuration', () => {
    const runtime = new AppRuntime(createTestConfig());

    expect(runtime.configManager.current()).toEqual(
      expect.objectContaining({
        serviceName: 'auth-service',
        dbSchema: 'auth_schema',
      }),
    );

    expect(runtime.databaseManager).toBeDefined();
    expect(tokenProvider).toBeDefined();
  });

  it('rotates the singleton token provider when the JWT secret changes', async () => {
    const runtime = new AppRuntime(createTestConfig());

    const oldToken = await tokenProvider.issue({
      sub: 'user-123',
      role: 'CUSTOMER',
    });

    await runtime.configManager.updateSecrets({
      databaseUrl: runtime.configManager.current().databaseUrl,
      jwtSecret: 'runtime-rotation-secret',
    });

    const newToken = await tokenProvider.issue({
      sub: 'user-123',
      role: 'CUSTOMER',
    });

    expect(
      jwt.verify(newToken, 'runtime-rotation-secret'),
    ).toBeTruthy();

    expect(await tokenProvider.verify(oldToken)).toEqual({
      sub: 'user-123',
      role: 'CUSTOMER',
    });
  });
});