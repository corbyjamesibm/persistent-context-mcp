/**
 * Database Configuration
 * Centralized configuration for Neo4j connection and other database settings
 */

import { Neo4jConfig } from '../core/storage/neo4j-store.js';

export interface DatabaseConfig {
  neo4j: Neo4jConfig;
  redis?: {
    host: string;
    port: number;
    password?: string;
    db?: number;
  };
}

/**
 * Get database configuration from environment variables
 */
export function getDatabaseConfig(): DatabaseConfig {
  return {
    neo4j: {
      uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
      username: process.env.NEO4J_USERNAME || 'neo4j',
      password: process.env.NEO4J_PASSWORD || 'persistentcontext123',
      database: process.env.NEO4J_DATABASE || 'neo4j',
      maxConnectionLifetime: parseInt(process.env.NEO4J_MAX_CONNECTION_LIFETIME || '30000'),
      maxConnectionPoolSize: parseInt(process.env.NEO4J_MAX_CONNECTION_POOL_SIZE || '100'),
      connectionAcquisitionTimeout: parseInt(process.env.NEO4J_CONNECTION_ACQUISITION_TIMEOUT || '60000'),
    },
    redis: process.env.REDIS_HOST ? {
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
    } : undefined,
  };
}

/**
 * Validate database configuration
 */
export function validateDatabaseConfig(config: DatabaseConfig): void {
  if (!config.neo4j.uri) {
    throw new Error('Neo4j URI is required');
  }
  if (!config.neo4j.username) {
    throw new Error('Neo4j username is required');
  }
  if (!config.neo4j.password) {
    throw new Error('Neo4j password is required');
  }

  // Validate URI format
  if (!config.neo4j.uri.startsWith('bolt://') && !config.neo4j.uri.startsWith('neo4j://')) {
    throw new Error('Neo4j URI must start with bolt:// or neo4j://');
  }
}