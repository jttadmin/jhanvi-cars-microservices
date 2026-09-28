import jwt from 'jsonwebtoken';

import type { SignOptions } from 'jsonwebtoken';
import type { UserRole } from '../models/user.model';
import type { SecretConfig } from '../config/config.types';
import { UnauthorizedError } from '../errors/AppError';

export interface RotatingTokenProviderOptions {
  overlapMs?: number;
}

export interface TokenPayload {
  sub: string;
  role: UserRole;
}

export class RotatingTokenProvider {
  private currentSecret: string;
  private previousSecret?: string;
  private previousSecretExpiresAt?: number;
  private readonly expiresIn: SignOptions['expiresIn'];
  private readonly overlapMs: number;

  constructor(
    initialSecrets: SecretConfig,
    expiresIn: SignOptions['expiresIn'],
    options: RotatingTokenProviderOptions = {},
  ) {
    this.currentSecret = initialSecrets.jwtSecret;
    this.expiresIn = expiresIn;
    this.overlapMs = options.overlapMs ?? 5 * 60 * 1000;
  }

  issue(payload: TokenPayload): string {
    return jwt.sign(payload, this.currentSecret, {
      expiresIn: this.expiresIn,
    });
  }

  verify(token: string): TokenPayload {
    let decoded: jwt.JwtPayload;

    try {
      decoded = jwt.verify(
        token,
        this.currentSecret,
      ) as jwt.JwtPayload;
    } catch {
      if (this.canUsePreviousSecret()) {
        try {
          decoded = jwt.verify(
            token,
            this.previousSecret!,
          ) as jwt.JwtPayload;
        } catch {
          throw new UnauthorizedError('Invalid or expired token');
        }
      } else {
        throw new UnauthorizedError('Invalid or expired token');
      }
    }

    return this.toTokenPayload(decoded);
  }

  rotate(secrets: SecretConfig): void {
    if (secrets.jwtSecret === this.currentSecret) {
      return;
    }

    this.previousSecret = this.currentSecret;
    this.previousSecretExpiresAt = Date.now() + this.overlapMs;
    this.currentSecret = secrets.jwtSecret;
  }

  private canUsePreviousSecret(): boolean {
    return (
      this.previousSecret !== undefined &&
      this.previousSecretExpiresAt !== undefined &&
      Date.now() < this.previousSecretExpiresAt
    );
  }

  private toTokenPayload(decoded: jwt.JwtPayload): TokenPayload {
    if (
      typeof decoded.sub !== 'string' ||
      typeof decoded.role !== 'string'
    ) {
      throw new UnauthorizedError('Invalid token payload');
    }

    return {
      sub: decoded.sub,
      role: decoded.role as UserRole,
    };
  }
}