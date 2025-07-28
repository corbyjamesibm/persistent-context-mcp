/**
 * Main Application Entry Point
 * Initializes all services and connects them to the Neo4j database
 */

import { createNeo4jContextStore } from './core/storage/neo4j-store.js';
import { ContextManagerService } from './core/services/context-manager.service.js';
import { SearchService, createSearchService } from './core/services/search.service.js';
import { TemplateGeneratorService, createTemplateGeneratorService } from './core/services/template-generator.service.js';
import { HealthMonitorService, createHealthMonitorService } from './core/services/health-monitor.service.js';
import { BackupRecoveryService, createBackupRecoveryService } from './core/services/backup-recovery.service.js';
import { PerformanceMonitorService, createPerformanceMonitorService } from './core/services/performance-monitor.service.js';
import { getDatabaseConfig, validateDatabaseConfig } from './config/database.config.js';
import { logger } from './utils/logger.js';

export interface PersistentContextStoreApp {
  contextStore: ReturnType<typeof createNeo4jContextStore>;
  contextManager: ContextManagerService;
  searchService: SearchService;
  templateGenerator: TemplateGeneratorService;
  healthMonitor: HealthMonitorService;
  backupRecovery: BackupRecoveryService;
  performanceMonitor: PerformanceMonitorService;
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  getHealthStatus(): {
    database: boolean;
    services: boolean;
    uptime: number;
  };
  getDetailedHealthStatus(): Promise<any>;
}

class PersistentContextStoreApplication implements PersistentContextStoreApp {
  public contextStore: ReturnType<typeof createNeo4jContextStore>;
  public contextManager: ContextManagerService;
  public searchService: SearchService;
  public templateGenerator: TemplateGeneratorService;
  public healthMonitor: HealthMonitorService;
  public backupRecovery: BackupRecoveryService;
  public performanceMonitor: PerformanceMonitorService;
  
  private startTime: Date;
  private isInitialized = false;

  constructor() {
    this.startTime = new Date();
    
    // Get and validate configuration
    const config = getDatabaseConfig();
    validateDatabaseConfig(config);

    // Initialize core storage
    this.contextStore = createNeo4jContextStore(config.neo4j);
    
    // Initialize services
    this.contextManager = new ContextManagerService(this.contextStore);
    this.searchService = createSearchService(this.contextStore);
    this.templateGenerator = createTemplateGeneratorService(this.contextStore);
    this.healthMonitor = createHealthMonitorService(
      this.contextStore,
      this.contextManager,
      this.searchService,
      this.templateGenerator,
      {
        enableAlerts: true,
        enableMetricsCollection: true,
        checkInterval: 30000, // 30 seconds
      }
    );
    this.backupRecovery = createBackupRecoveryService(
      this.contextStore,
      {
        backupDirectory: process.env.BACKUP_DIRECTORY || './backups',
        retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '30'),
        compressionEnabled: process.env.BACKUP_COMPRESSION !== 'false',
        backupInterval: parseInt(process.env.BACKUP_INTERVAL || '86400000'), // 24 hours
        incrementalBackups: process.env.BACKUP_INCREMENTAL !== 'false',
      }
    );
    this.performanceMonitor = createPerformanceMonitorService(
      this.contextStore,
      this.contextManager,
      this.searchService,
      {
        enableContinuousMonitoring: process.env.PERFORMANCE_MONITORING !== 'false',
        monitoringInterval: parseInt(process.env.PERFORMANCE_MONITORING_INTERVAL || '60000'),
        performanceThresholds: {
          maxResponseTime: parseInt(process.env.MAX_RESPONSE_TIME || '5000'),
          maxMemoryUsage: parseInt(process.env.MAX_MEMORY_USAGE || '80'),
          maxCpuUsage: parseInt(process.env.MAX_CPU_USAGE || '70'),
          maxDatabaseResponseTime: parseInt(process.env.MAX_DATABASE_RESPONSE_TIME || '1000'),
        },
      }
    );

    // Setup service event handlers
    this.setupEventHandlers();
  }

  /**
   * Initialize the application and all services
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      logger.warn('Application already initialized');
      return;
    }

    try {
      logger.info('Initializing Persistent Context Store application...');

      // Connect to database
      logger.info('Connecting to Neo4j database...');
      await this.contextStore.connect();
      logger.info('✅ Database connection established');

      // Initialize context manager (which starts auto-save service)
      logger.info('Initializing context manager...');
      await this.contextManager.initialize();
      logger.info('✅ Context manager initialized');

      // Build search index
      logger.info('Building search index...');
      await this.searchService.buildIndex();
      logger.info('✅ Search index built');

      // Start health monitoring
      logger.info('Starting health monitoring...');
      this.healthMonitor.start();
      logger.info('✅ Health monitoring started');

      // Start backup service
      logger.info('Starting backup service...');
      await this.backupRecovery.start();
      logger.info('✅ Backup service started');

      // Start performance monitoring
      logger.info('Starting performance monitoring...');
      this.performanceMonitor.start();
      logger.info('✅ Performance monitoring started');

      this.isInitialized = true;
      logger.info('🎉 Persistent Context Store application initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize application:', error);
      throw error;
    }
  }

  /**
   * Shutdown the application gracefully
   */
  async shutdown(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    try {
      logger.info('Shutting down Persistent Context Store application...');

      // Stop performance monitoring
      this.performanceMonitor.stop();
      logger.info('✅ Performance monitoring stopped');

      // Stop health monitoring
      this.healthMonitor.stop();
      logger.info('✅ Health monitoring stopped');

      // Stop backup service
      this.backupRecovery.stop();
      logger.info('✅ Backup service stopped');

      // Shutdown context manager (stops auto-save)
      await this.contextManager.shutdown();
      logger.info('✅ Context manager shut down');

      // Disconnect from database
      await this.contextStore.disconnect();
      logger.info('✅ Database disconnected');

      this.isInitialized = false;
      logger.info('👋 Application shutdown complete');
      
    } catch (error) {
      logger.error('Error during application shutdown:', error);
      throw error;
    }
  }

  /**
   * Get basic health status of all components
   */
  getHealthStatus(): {
    database: boolean;
    services: boolean;
    uptime: number;
  } {
    const uptime = Date.now() - this.startTime.getTime();
    
    return {
      database: this.contextStore.isConnectedToDatabase(),
      services: this.isInitialized,
      uptime: Math.floor(uptime / 1000), // uptime in seconds
    };
  }

  /**
   * Get detailed health status with comprehensive checks
   */
  async getDetailedHealthStatus(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    checks: any[];
    metrics: any;
    timestamp: Date;
  }> {
    const healthSummary = await this.healthMonitor.getHealthSummary();
    
    return {
      status: healthSummary.status,
      checks: healthSummary.checks,
      metrics: healthSummary.metrics,
      timestamp: new Date(),
    };
  }

  /**
   * Setup event handlers for service coordination
   */
  private setupEventHandlers(): void {
    // Context store events
    this.contextStore.on('contextSaved', async ({ contextId }) => {
      // Index new context for search
      try {
        const context = await this.contextStore.getContext(contextId);
        if (context) {
          await this.searchService.indexContext(context);
          logger.debug(`Context indexed for search: ${contextId}`);
        }
      } catch (error) {
        logger.warn(`Failed to index context ${contextId} for search:`, error);
      }
    });

    this.contextStore.on('contextUpdated', async ({ contextId, context }) => {
      // Re-index updated context
      try {
        await this.searchService.indexContext(context);
        logger.debug(`Context re-indexed for search: ${contextId}`);
      } catch (error) {
        logger.warn(`Failed to re-index context ${contextId} for search:`, error);
      }
    });

    this.contextStore.on('contextDeleted', ({ contextId }) => {
      // Remove from search index
      this.searchService.removeFromIndex(contextId);
      logger.debug(`Context removed from search index: ${contextId}`);
    });

    // Search service events
    this.searchService.on('indexBuildCompleted', ({ entryCount, buildTime }) => {
      logger.info(`Search index rebuild completed: ${entryCount} entries in ${buildTime}ms`);
    });

    this.searchService.on('indexBuildFailed', ({ error }) => {
      logger.error('Search index build failed:', error);
    });

    // Context manager events
    this.contextManager.on('contextSaved', ({ contextId, saveTimeMs }) => {
      logger.debug(`Context auto-saved: ${contextId} (${saveTimeMs}ms)`);
    });

    this.contextManager.on('saveError', ({ sessionId, error }) => {
      logger.warn(`Auto-save failed for session ${sessionId}:`, error);
    });

    // Template generator events
    this.templateGenerator.on('templateGenerated', ({ templateId, sourceCount }) => {
      logger.info(`Template generated: ${templateId} from ${sourceCount} sources`);
    });

    this.templateGenerator.on('templateApplied', ({ templateId, contextId }) => {
      logger.info(`Template applied: ${templateId} → context ${contextId}`);
    });

    // Health monitor events
    this.healthMonitor.on('healthCheck', (summary) => {
      if (summary.status !== 'healthy') {
        logger.warn(`Health check status: ${summary.status}`, {
          criticalChecks: summary.checks.filter(check => check.status === 'critical').length,
          warningChecks: summary.checks.filter(check => check.status === 'warning').length,
        });
      }
    });

    this.healthMonitor.on('alert', ({ level, message, details }) => {
      logger.error(`Health alert (${level}): ${message}`, { details });
    });

    this.healthMonitor.on('checkFailed', ({ error }) => {
      logger.error('Health monitor check failed:', error);
    });

    // Backup service events
    this.backupRecovery.on('backupCompleted', ({ backupId, size, duration, metadata }) => {
      logger.info(`Backup completed: ${backupId} (${metadata.contextCount} contexts, ${size} bytes, ${duration}ms)`);
    });

    this.backupRecovery.on('backupFailed', ({ backupId, error }) => {
      logger.error(`Backup failed: ${backupId}`, { error });
    });

    this.backupRecovery.on('restoreCompleted', ({ backupId, restoredContexts, duration }) => {
      logger.info(`Restore completed: ${backupId} (${restoredContexts} contexts, ${duration}ms)`);
    });

    this.backupRecovery.on('restoreFailed', ({ backupId, error }) => {
      logger.error(`Restore failed: ${backupId}`, { error });
    });

    this.backupRecovery.on('cleanupCompleted', ({ deletedCount }) => {
      logger.info(`Backup cleanup completed: ${deletedCount} old backups deleted`);
    });

    // Performance monitor events
    this.performanceMonitor.on('performanceCheck', (metrics) => {
      if (metrics.responseTime.p95 > 10000) { // Log if p95 > 10 seconds
        logger.warn(`High response time detected: p95=${metrics.responseTime.p95}ms`);
      }
    });

    this.performanceMonitor.on('performanceAlert', ({ level, message, recommendations }) => {
      logger.warn(`Performance alert (${level}): ${message}`, {
        recommendationCount: recommendations.length,
        categories: recommendations.map(r => r.category),
      });
    });

    this.performanceMonitor.on('loadTestCompleted', ({ testId, successfulRequests, totalRequests, averageResponseTime }) => {
      logger.info(`Load test completed: ${testId} (${successfulRequests}/${totalRequests} successful, avg ${averageResponseTime}ms)`);
    });

    this.performanceMonitor.on('loadTestFailed', ({ testId, error }) => {
      logger.error(`Load test failed: ${testId}`, { error });
    });
  }
}

/**
 * Create and return the main application instance
 */
export function createPersistentContextStoreApp(): PersistentContextStoreApp {
  return new PersistentContextStoreApplication();
}

/**
 * Default application instance (singleton)
 */
let defaultApp: PersistentContextStoreApp | null = null;

export function getDefaultApp(): PersistentContextStoreApp {
  if (!defaultApp) {
    defaultApp = createPersistentContextStoreApp();
  }
  return defaultApp;
}

// Graceful shutdown handling
process.on('SIGINT', async () => {
  logger.info('Received SIGINT, shutting down gracefully...');
  if (defaultApp) {
    await defaultApp.shutdown();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  logger.info('Received SIGTERM, shutting down gracefully...');
  if (defaultApp) {
    await defaultApp.shutdown();
  }
  process.exit(0);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled rejection at:', promise, 'reason:', reason);
  process.exit(1);
});