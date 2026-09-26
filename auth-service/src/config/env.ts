import type { SignOptions } from 'jsonwebtoken';

import { loadFromEnvironment } from './config.loader';
import type { RuntimeConfig } from './config.types';

export interface AppConfig extends RuntimeConfig {}

export const env: AppConfig = loadFromEnvironment();