# auth-service

Handles registration, login, and identity (`/auth/me`). Owns `auth_schema` in the shared Postgres instance.

## Run locally (without Docker yet)

1. Have a local Postgres running, then create the DB + a scoped user:
   ```sql
   CREATE DATABASE jhanvi_cars;
   CREATE USER auth_user WITH PASSWORD 'auth_password';
   GRANT ALL PRIVILEGES ON DATABASE jhanvi_cars TO auth_user;
   ```
2. `cp .env.example .env` and adjust `DATABASE_URL` if needed.
3. `npm install`
4. `npm run migrate` (creates `auth_schema` and the `users` table)
5. `npm run dev` → service listens on `PORT` (default 3001)

## Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /auth/register | none | Create a user, returns `{ user, token }` |
| POST | /auth/login | none | Returns `{ user, token }` |
| GET | /auth/me | Bearer token | Returns the current user |
| GET | /health | none | `{ status: "ok", service: "auth-service" }` |

## Why it's structured this way

- `token.service.ts` defines a `TokenProvider` interface with a `LocalJwtTokenProvider` implementation.
  Nothing else in the codebase imports `jsonwebtoken` directly — when you're ready to swap to
  AWS Cognito/OIDC, you write a `CognitoTokenProvider` implementing the same interface and flip
  `AUTH_PROVIDER` in `.env`. No controller/service code changes.
- `user.repository.ts` is the only file with SQL/Knex query builder calls.
- All validated input types (`RegisterInput`, `LoginInput`) come from the Zod schemas via `z.infer`,
  so the validation and the TypeScript type can never drift apart.

## Tests

`npm test` — unit tests mock the repository and token provider (no real DB needed);
the route test exercises the Express app end-to-end through supertest with the same mocks.
