import { readFile } from 'node:fs/promises';

interface SecretConfig {
  jwtSecret: string;
}

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

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    typeof (parsed as { jwtSecret?: unknown }).jwtSecret !== 'string' ||
    (parsed as { jwtSecret: string }).jwtSecret.trim() === ''
  ) {
    throw new Error(`Invalid secret configuration in: ${filePath}`);
  }

  return {
    jwtSecret: (parsed as { jwtSecret: string }).jwtSecret,
  };
}
