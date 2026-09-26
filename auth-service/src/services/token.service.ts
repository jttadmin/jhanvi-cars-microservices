import { RotatingTokenProvider } from './rotating-token.provider';
import type { UserRole } from '../models/user.model';
import type { RuntimeConfig } from '../config/config.types';

export interface TokenPayload {
  sub: string;
  role: UserRole;
}

export interface TokenProvider {
  issue(payload: TokenPayload): Promise<string>;
  verify(token: string): Promise<TokenPayload>;
}

class LocalJwtTokenProvider implements TokenProvider {
  private readonly provider: RotatingTokenProvider;

  constructor(config: RuntimeConfig) {
    this.provider = new RotatingTokenProvider(
      {
        databaseUrl: config.databaseUrl,
        jwtSecret: config.jwtSecret,
      },
      config.jwtExpiresIn,
    );
  }

  async issue(payload: TokenPayload): Promise<string> {
    return this.provider.issue(payload);
  }

  async verify(token: string): Promise<TokenPayload> {
    return this.provider.verify(token);
  }

  rotateSecret(jwtSecret: string, databaseUrl: string): void {
    this.provider.rotate({
      databaseUrl,
      jwtSecret,
    });
  }
}

let localTokenProvider: LocalJwtTokenProvider | undefined;

export function initializeTokenProvider(
  config: RuntimeConfig,
): void {
  switch (config.authProvider) {
    case 'local':
      localTokenProvider = new LocalJwtTokenProvider(config);
      return;

    default:
      throw new Error(
        `Unsupported AUTH_PROVIDER: ${config.authProvider}`,
      );
  }
}

function getLocalTokenProvider(): LocalJwtTokenProvider {
  if (!localTokenProvider) {
    throw new Error('Token provider has not been initialized');
  }

  return localTokenProvider;
}

export const tokenProvider: TokenProvider = {
  async issue(payload: TokenPayload): Promise<string> {
    return getLocalTokenProvider().issue(payload);
  },

  async verify(token: string): Promise<TokenPayload> {
    return getLocalTokenProvider().verify(token);
  },
};

export function rotateTokenSecret(
  jwtSecret: string,
  databaseUrl: string,
): void {
  getLocalTokenProvider().rotateSecret(
    jwtSecret,
    databaseUrl,
  );
}