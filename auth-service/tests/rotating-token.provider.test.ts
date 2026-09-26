import jwt from 'jsonwebtoken';

import { RotatingTokenProvider } from '../src/services/rotating-token.provider';
import type { SecretConfig } from '../src/config/config.types';
import type { UserRole } from '../src/models/user.model';

const role: UserRole = 'CUSTOMER';

function secrets(jwtSecret: string): SecretConfig {
  return {
    databaseUrl: 'postgresql://test:test@localhost:5432/test',
    jwtSecret,
  };
}

describe('RotatingTokenProvider', () => {
  it('issues and verifies a token with the current secret', () => {
    const provider = new RotatingTokenProvider(
      secrets('secret-one'),
      '1h',
    );

    const token = provider.issue({
      sub: 'user-123',
      role,
    });

    expect(provider.verify(token)).toEqual({
      sub: 'user-123',
      role,
    });
  });

  it('uses the new secret for tokens issued after rotation', () => {
    const provider = new RotatingTokenProvider(
      secrets('secret-one'),
      '1h',
    );

    provider.rotate(secrets('secret-two'));

    const token = provider.issue({
      sub: 'user-123',
      role,
    });

    expect(jwt.verify(token, 'secret-two')).toBeTruthy();
  });

  it('continues accepting old tokens during the overlap window', () => {
    const provider = new RotatingTokenProvider(
      secrets('secret-one'),
      '1h',
      { overlapMs: 60_000 },
    );

    const oldToken = provider.issue({
      sub: 'user-123',
      role,
    });

    provider.rotate(secrets('secret-two'));

    expect(provider.verify(oldToken)).toEqual({
      sub: 'user-123',
      role,
    });
  });

  it('rejects old tokens after the overlap window', () => {
    const provider = new RotatingTokenProvider(
      secrets('secret-one'),
      '1h',
      { overlapMs: 1 },
    );

    const oldToken = provider.issue({
      sub: 'user-123',
      role,
    });

    provider.rotate(secrets('secret-two'));

    return new Promise<void>((resolve) => {
      setTimeout(() => {
        expect(() => provider.verify(oldToken)).toThrow(
          'Invalid or expired token',
        );

        resolve();
      }, 10);
    });
  });

  it('does not rotate when the secret has not changed', () => {
    const provider = new RotatingTokenProvider(
      secrets('secret-one'),
      '1h',
    );

    const token = provider.issue({
      sub: 'user-123',
      role,
    });

    provider.rotate(secrets('secret-one'));

    expect(provider.verify(token)).toEqual({
      sub: 'user-123',
      role,
    });
  });

  it('rejects tokens with an invalid payload', () => {
    const provider = new RotatingTokenProvider(
      secrets('secret-one'),
      '1h',
    );

    const token = jwt.sign(
      {
        sub: 123,
        role,
      },
      'secret-one',
      { expiresIn: '1h' },
    );

    expect(() => provider.verify(token)).toThrow(
      'Invalid token payload',
    );
  });
});