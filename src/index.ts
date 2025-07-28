/**
 * Persistent Context Store - Main Entry Point
 * 
 * This is the main server entry point that initializes the Neo4j context storage system
 * with Express API server and MCP integration.
 */

import dotenv from 'dotenv';
import { createServer } from './api/server.js';
import { Neo4jContextStore } from './core/storage/neo4j-store.js';
import { ContextManagerService } from './core/services/context-manager.service.js';
import { logger } from './utils/logger.js';

// Load environment variables
dotenv.config();

const PORT = process.env.PORT || 3001;
const NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687';
const NEO4J_USERNAME = process.env.NEO4J_USERNAME || 'neo4j';
const NEO4J_PASSWORD = process.env.NEO4J_PASSWORD!;

async function startServer() {
  try {
    // Initialize Neo4j connection
    const contextStore = new Neo4jContextStore({
      uri: NEO4J_URI,
      username: NEO4J_USERNAME,
      password: NEO4J_PASSWORD,
    });

    // Initialize Context Manager with auto-save capabilities
    const contextManager = new ContextManagerService(contextStore, {
      autoSave: {
        intervalMs: 30000, // 30 seconds
        maxRetries: 3,
        retryDelayMs: 1000,
        saveTimeoutMs: 5000,
      },
      enableNotifications: true,
      maxSessionHistory: 100,
    });

    await contextManager.initialize();
    logger.info('Context Manager initialized with auto-save capabilities');

    // Initialize Express server
    const app = createServer(contextStore, contextManager);
    
    const server = app.listen(PORT, () => {
      logger.info(`Persistent Context Store server running on port ${PORT}`);
      logger.info(`API available at http://localhost:${PORT}/api/v1`);
    });

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(async () => {
        await contextManager.shutdown();
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(async () => {
        await contextManager.shutdown();
        process.exit(0);
      });
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();