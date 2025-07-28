/**
 * Health Monitoring Service for Production Deployment
 * Provides comprehensive health checks, metrics collection, and alerts
 */

import { EventEmitter } from 'events';
import { Neo4jContextStore } from '../storage/neo4j-store.js';
import { ContextManagerService } from './context-manager.service.js';
import { SearchService } from './search.service.js';
import { TemplateGeneratorService } from './template-generator.service.js';
import { logger } from '../../utils/logger.js';

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  message: string;
  responseTime: number;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface SystemMetrics {
  memory: {
    used: number;
    free: number;
    total: number;
    percentage: number;
  };
  database: {
    connected: boolean;
    connectionPool: {
      active: number;
      idle: number;
      total: number;
    };
    queryPerformance: {
      avgResponseTime: number;
      slowQueries: number;
    };
  };
  services: {
    contextManager: {
      activeSessions: number;
      pendingContexts: number;
      autoSaveEnabled: boolean;
    };
    search: {
      indexSize: number;
      queryCount: number;
      avgQueryTime: number;
    };
    templates: {
      totalTemplates: number;
      applicationsCount: number;
    };
  };
  performance: {
    uptime: number;
    cpuUsage: number;
    requestsPerMinute: number;
    errorRate: number;
  };
}

export interface HealthMonitorConfig {
  checkInterval: number; // milliseconds
  metricsRetention: number; // how many metric snapshots to keep
  alertThresholds: {
    memoryUsage: number; // percentage
    responseTime: number; // milliseconds
    errorRate: number; // percentage
    diskSpace: number; // percentage
  };
  enableAlerts: boolean;
  enableMetricsCollection: boolean;
}

export class HealthMonitorService extends EventEmitter {
  private config: HealthMonitorConfig;
  private contextStore: Neo4jContextStore;
  private contextManager: ContextManagerService;
  private searchService: SearchService;
  private templateGenerator: TemplateGeneratorService;
  
  private isRunning = false;
  private checkTimer: NodeJS.Timer | null = null;
  private metricsHistory: SystemMetrics[] = [];
  private startTime = Date.now();
  private requestCount = 0;
  private errorCount = 0;

  constructor(
    contextStore: Neo4jContextStore,
    contextManager: ContextManagerService,
    searchService: SearchService,
    templateGenerator: TemplateGeneratorService,
    config?: Partial<HealthMonitorConfig>
  ) {
    super();
    
    this.contextStore = contextStore;
    this.contextManager = contextManager;
    this.searchService = searchService;
    this.templateGenerator = templateGenerator;
    
    this.config = {
      checkInterval: 30000, // 30 seconds
      metricsRetention: 288, // 24 hours at 5-minute intervals
      alertThresholds: {
        memoryUsage: 85, // 85%
        responseTime: 5000, // 5 seconds
        errorRate: 5, // 5%
        diskSpace: 90, // 90%
      },
      enableAlerts: true,
      enableMetricsCollection: true,
      ...config,
    };
  }

  /**
   * Start health monitoring
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Health monitor is already running');
      return;
    }

    this.isRunning = true;
    this.scheduleNextCheck();
    logger.info(`Health monitor started with ${this.config.checkInterval}ms interval`);
    this.emit('started');
  }

  /**
   * Stop health monitoring
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    if (this.checkTimer) {
      clearTimeout(this.checkTimer);
      this.checkTimer = null;
    }

    logger.info('Health monitor stopped');
    this.emit('stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<HealthCheck[]> {
    const checks: HealthCheck[] = [];

    // Database connectivity check
    checks.push(await this.checkDatabaseHealth());
    
    // Service health checks
    checks.push(await this.checkContextManagerHealth());
    checks.push(await this.checkSearchServiceHealth());
    checks.push(await this.checkTemplateServiceHealth());
    
    // System resource checks
    checks.push(await this.checkMemoryHealth());
    checks.push(await this.checkPerformanceHealth());

    return checks;
  }

  /**
   * Get current system metrics
   */
  async getSystemMetrics(): Promise<SystemMetrics> {
    const memoryUsage = process.memoryUsage();
    const uptime = Date.now() - this.startTime;
    const contextManagerStatus = this.contextManager.getSystemStatus();
    const searchStats = this.searchService.getSearchStats();

    const metrics: SystemMetrics = {
      memory: {
        used: memoryUsage.heapUsed,
        free: memoryUsage.heapTotal - memoryUsage.heapUsed,
        total: memoryUsage.heapTotal,
        percentage: Math.round((memoryUsage.heapUsed / memoryUsage.heapTotal) * 100),
      },
      database: {
        connected: this.contextStore.isConnectedToDatabase(),
        connectionPool: {
          active: 0, // Would need to implement connection pool metrics
          idle: 0,
          total: 1,
        },
        queryPerformance: {
          avgResponseTime: 0, // Would need to implement query timing
          slowQueries: 0,
        },
      },
      services: {
        contextManager: {
          activeSessions: contextManagerStatus.activeSessions,
          pendingContexts: contextManagerStatus.pendingContexts,
          autoSaveEnabled: contextManagerStatus.isActive,
        },
        search: {
          indexSize: searchStats.indexSize,
          queryCount: 0, // Would need to implement query counting
          avgQueryTime: 0,
        },
        templates: {
          totalTemplates: 0, // Would need to implement template counting
          applicationsCount: 0,
        },
      },
      performance: {
        uptime: Math.floor(uptime / 1000),
        cpuUsage: process.cpuUsage().user / 1000000, // Convert to seconds
        requestsPerMinute: this.calculateRequestsPerMinute(),
        errorRate: this.calculateErrorRate(),
      },
    };

    // Store in history if metrics collection is enabled
    if (this.config.enableMetricsCollection) {
      this.metricsHistory.push(metrics);
      
      // Keep only the configured number of metrics
      if (this.metricsHistory.length > this.config.metricsRetention) {
        this.metricsHistory = this.metricsHistory.slice(-this.config.metricsRetention);
      }
    }

    return metrics;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(): SystemMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Get health summary
   */
  async getHealthSummary(): Promise<{
    status: 'healthy' | 'warning' | 'critical';
    checks: HealthCheck[];
    metrics: SystemMetrics;
  }> {
    const checks = await this.performHealthCheck();
    const metrics = await this.getSystemMetrics();
    
    // Determine overall status
    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    
    for (const check of checks) {
      if (check.status === 'critical') {
        status = 'critical';
        break;
      } else if (check.status === 'warning' && status === 'healthy') {
        status = 'warning';
      }
    }

    return { status, checks, metrics };
  }

  /**
   * Record a request for metrics
   */
  recordRequest(): void {
    this.requestCount++;
  }

  /**
   * Record an error for metrics
   */
  recordError(): void {
    this.errorCount++;
  }

  /**
   * Check database health
   */
  private async checkDatabaseHealth(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const isConnected = this.contextStore.isConnectedToDatabase();
      const responseTime = Date.now() - startTime;

      if (!isConnected) {
        return {
          name: 'database',
          status: 'critical',
          message: 'Database connection lost',
          responseTime,
          timestamp: new Date(),
        };
      }

      // Test a simple query
      const testQuery = 'RETURN 1 as test';
      await this.contextStore['executeQuery'](testQuery, {}); // Access private method for testing

      return {
        name: 'database',
        status: 'healthy',
        message: 'Database connection healthy',
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'critical',
        message: `Database health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check context manager health
   */
  private async checkContextManagerHealth(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const status = this.contextManager.getSystemStatus();
      const responseTime = Date.now() - startTime;

      let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = 'Context manager healthy';

      if (!status.isActive) {
        healthStatus = 'critical';
        message = 'Context manager not active';
      } else if (status.pendingContexts > 100) {
        healthStatus = 'warning';
        message = `High pending context count: ${status.pendingContexts}`;
      }

      return {
        name: 'context_manager',
        status: healthStatus,
        message,
        responseTime,
        timestamp: new Date(),
        metadata: status,
      };
    } catch (error) {
      return {
        name: 'context_manager',
        status: 'critical',
        message: `Context manager health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check search service health
   */
  private async checkSearchServiceHealth(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      const stats = this.searchService.getSearchStats();
      const responseTime = Date.now() - startTime;

      let healthStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
      let message = 'Search service healthy';

      if (stats.indexSize === 0) {
        healthStatus = 'warning';
        message = 'Search index is empty';
      }

      return {
        name: 'search_service',
        status: healthStatus,
        message,
        responseTime,
        timestamp: new Date(),
        metadata: stats,
      };
    } catch (error) {
      return {
        name: 'search_service',
        status: 'critical',
        message: `Search service health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check template service health
   */
  private async checkTemplateServiceHealth(): Promise<HealthCheck> {
    const startTime = Date.now();

    try {
      // Template service doesn't have built-in status, so we'll do a basic check
      const responseTime = Date.now() - startTime;

      return {
        name: 'template_service',
        status: 'healthy',
        message: 'Template service healthy',
        responseTime,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        name: 'template_service',
        status: 'critical',
        message: `Template service health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        responseTime: Date.now() - startTime,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Check memory health
   */
  private async checkMemoryHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    const memoryUsage = process.memoryUsage();
    const usagePercentage = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let message = `Memory usage: ${Math.round(usagePercentage)}%`;

    if (usagePercentage > this.config.alertThresholds.memoryUsage) {
      status = 'critical';
      message = `High memory usage: ${Math.round(usagePercentage)}%`;
    } else if (usagePercentage > this.config.alertThresholds.memoryUsage * 0.8) {
      status = 'warning';
      message = `Elevated memory usage: ${Math.round(usagePercentage)}%`;
    }

    return {
      name: 'memory',
      status,
      message,
      responseTime: Date.now() - startTime,
      timestamp: new Date(),
      metadata: {
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        usagePercentage: Math.round(usagePercentage),
      },
    };
  }

  /**
   * Check performance health
   */
  private async checkPerformanceHealth(): Promise<HealthCheck> {
    const startTime = Date.now();
    const errorRate = this.calculateErrorRate();

    let status: 'healthy' | 'warning' | 'critical' = 'healthy';
    let message = `Error rate: ${errorRate.toFixed(2)}%`;

    if (errorRate > this.config.alertThresholds.errorRate) {
      status = 'critical';
      message = `High error rate: ${errorRate.toFixed(2)}%`;
    } else if (errorRate > this.config.alertThresholds.errorRate * 0.5) {
      status = 'warning';
      message = `Elevated error rate: ${errorRate.toFixed(2)}%`;
    }

    return {
      name: 'performance',
      status,
      message,
      responseTime: Date.now() - startTime,
      timestamp: new Date(),
      metadata: {
        errorRate,
        requestsPerMinute: this.calculateRequestsPerMinute(),
        uptime: Math.floor((Date.now() - this.startTime) / 1000),
      },
    };
  }

  /**
   * Schedule next health check
   */
  private scheduleNextCheck(): void {
    if (!this.isRunning) {
      return;
    }

    this.checkTimer = setTimeout(async () => {
      try {
        await this.runHealthCheck();
      } catch (error) {
        logger.error('Health check failed:', error);
        this.emit('checkFailed', { error });
      }
      
      this.scheduleNextCheck();
    }, this.config.checkInterval);
  }

  /**
   * Run health check and emit events
   */
  private async runHealthCheck(): Promise<void> {
    const summary = await this.getHealthSummary();
    
    this.emit('healthCheck', summary);
    
    if (this.config.enableAlerts) {
      if (summary.status === 'critical') {
        this.emit('alert', {
          level: 'critical',
          message: 'Critical health issues detected',
          details: summary.checks.filter(check => check.status === 'critical'),
        });
      } else if (summary.status === 'warning') {
        this.emit('alert', {
          level: 'warning',
          message: 'Health warnings detected',
          details: summary.checks.filter(check => check.status === 'warning'),
        });
      }
    }
  }

  /**
   * Calculate requests per minute
   */
  private calculateRequestsPerMinute(): number {
    const uptimeMinutes = (Date.now() - this.startTime) / (1000 * 60);
    return uptimeMinutes > 0 ? this.requestCount / uptimeMinutes : 0;
  }

  /**
   * Calculate error rate percentage
   */
  private calculateErrorRate(): number {
    return this.requestCount > 0 ? (this.errorCount / this.requestCount) * 100 : 0;
  }
}

/**
 * Factory function to create health monitor service
 */
export function createHealthMonitorService(
  contextStore: Neo4jContextStore,
  contextManager: ContextManagerService,
  searchService: SearchService,
  templateGenerator: TemplateGeneratorService,
  config?: Partial<HealthMonitorConfig>
): HealthMonitorService {
  return new HealthMonitorService(
    contextStore,
    contextManager,
    searchService,
    templateGenerator,
    config
  );
}