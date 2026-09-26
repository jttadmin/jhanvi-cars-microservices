import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { loadSecretsFromFile } from '../src/config/secret-file.source';

describe('secret file source', () => {
  let tempDirectory: string;

  beforeEach(async () => {
    tempDirectory = await mkdtemp(
      path.join(tmpdir(), 'auth-service-secrets-'),
    );
  });

  afterEach(async () => {
    await rm(tempDirectory, { recursive: true, force: true });
  });

  it('loads and validates secrets from a JSON file', async () => {
    const filePath = path.join(tempDirectory, 'secrets.json');

    await writeFile(
      filePath,
      JSON.stringify({
        databaseUrl: 'postgresql://test:test@localhost:5432/test',
        jwtSecret: 'test-secret',
      }),
      'utf8',
    );

    const secrets = await loadSecretsFromFile(filePath);

    expect(secrets).toEqual({
      databaseUrl: 'postgresql://test:test@localhost:5432/test',
      jwtSecret: 'test-secret',
    });
  });

  it('rejects invalid JSON', async () => {
    const filePath = path.join(tempDirectory, 'secrets.json');

    await writeFile(filePath, '{invalid-json', 'utf8');

    await expect(loadSecretsFromFile(filePath)).rejects.toThrow(
      'Invalid JSON in secret file',
    );
  });

  it('rejects secrets that fail validation', async () => {
    const filePath = path.join(tempDirectory, 'secrets.json');

    await writeFile(
      filePath,
      JSON.stringify({
        databaseUrl: '',
        jwtSecret: '',
      }),
      'utf8',
    );

    await expect(loadSecretsFromFile(filePath)).rejects.toThrow();
  });
});