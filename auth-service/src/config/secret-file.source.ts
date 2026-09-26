import { readFile } from 'node:fs/promises';

import { secretConfigSchema } from './config.schema';
import type { SecretConfig } from './config.types';

export async function loadSecretsFromFile(
  filePath: string,
): Promise<SecretConfig> {
  const raw = await readFile(filePath, 'utf8');

  let parsed: unknown;

  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON in secret file: ${filePath}`);
  }

  return secretConfigSchema.parse(parsed);
}