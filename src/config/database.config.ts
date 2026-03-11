import { registerAs } from '@nestjs/config';
import * as path from 'path';

/**
 * Database Configuration
 * 
 * Typed configuration for TypeORM SQLite database settings.
 * 
 * Requirements: 9.1, 9.2, 9.5
 */
export interface DatabaseConfig {
  type: 'sqlite';
  database: string;
  synchronize: boolean;
  logging: boolean;
  autoLoadEntities: boolean;
}

export default registerAs('database', (): DatabaseConfig => ({
  type: 'sqlite',
  database: path.resolve(process.cwd(), 'data', 'pr-review.db'),
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV === 'development',
  autoLoadEntities: true,
}));
