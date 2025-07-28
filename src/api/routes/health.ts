/**
 * Health Check HTTP Endpoints for Production Monitoring
 * Provides standard health check endpoints for load balancers and monitoring systems
 */

import { Request, Response } from 'express';
import { PersistentContextStoreApp } from '../../app.js';
import { logger } from '../../utils/logger.js';

export class HealthRoutes {
  constructor(private app: PersistentContextStoreApp) {}

  /**
   * Basic health check endpoint - for load balancer health checks
   * GET /health
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = this.app.getHealthStatus();
      
      if (health.database && health.services) {
        res.status(200).json({
          status: 'healthy',
          timestamp: new Date().toISOString(),
          uptime: health.uptime,
        });
      } else {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          issues: {
            database: !health.database,
            services: !health.services,
          },
        });
      }
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check failed',
      });
    }
  }

  /**
   * Readiness check endpoint - indicates if the service is ready to accept requests
   * GET /health/ready
   */
  async readinessCheck(req: Request, res: Response): Promise<void> {
    try {
      const health = this.app.getHealthStatus();
      
      // Service is ready if database is connected and services are initialized
      if (health.database && health.services) {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          components: {
            database: 'ready',
            services: 'ready',
          },
        });
      } else {
        res.status(503).json({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          components: {
            database: health.database ? 'ready' : 'not_ready',
            services: health.services ? 'ready' : 'not_ready',
          },
        });
      }
    } catch (error) {
      logger.error('Readiness check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Readiness check failed',
      });
    }
  }

  /**
   * Liveness check endpoint - indicates if the service is alive
   * GET /health/live
   */
  async livenessCheck(req: Request, res: Response): Promise<void> {
    try {
      // Simple liveness check - if we can respond, we're alive
      res.status(200).json({
        status: 'alive',
        timestamp: new Date().toISOString(),
        uptime: Math.floor((Date.now() - process.uptime() * 1000) / 1000),
      });
    } catch (error) {
      logger.error('Liveness check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Liveness check failed',
      });
    }
  }

  /**
   * Detailed health status endpoint - comprehensive health information
   * GET /health/detailed
   */
  async detailedHealth(req: Request, res: Response): Promise<void> {
    try {
      const detailedHealth = await this.app.getDetailedHealthStatus();
      
      const statusCode = detailedHealth.status === 'healthy' ? 200 : 
                        detailedHealth.status === 'warning' ? 200 : 503;
      
      res.status(statusCode).json({
        ...detailedHealth,
        endpoint: 'detailed_health',
      });
    } catch (error) {
      logger.error('Detailed health check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Detailed health check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Health metrics endpoint - system metrics for monitoring
   * GET /health/metrics
   */
  async healthMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.app.healthMonitor.getSystemMetrics();
      
      res.status(200).json({
        timestamp: new Date().toISOString(),
        metrics,
      });
    } catch (error) {
      logger.error('Health metrics check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health metrics check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Metrics history endpoint - historical metrics for trend analysis
   * GET /health/metrics/history?limit=100
   */
  async metricsHistory(req: Request, res: Response): Promise<void> {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const metricsHistory = this.app.healthMonitor.getMetricsHistory();
      const limitedHistory = metricsHistory.slice(-limit);

      res.status(200).json({
        timestamp: new Date().toISOString(),
        totalRecords: metricsHistory.length,
        returnedRecords: limitedHistory.length,
        limit,
        history: limitedHistory,
      });
    } catch (error) {
      logger.error('Metrics history check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Metrics history check failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Prometheus-compatible metrics endpoint
   * GET /health/prometheus
   */
  async prometheusMetrics(req: Request, res: Response): Promise<void> {
    try {
      const health = this.app.getHealthStatus();
      const detailedHealth = await this.app.getDetailedHealthStatus();
      
      // Generate Prometheus-format metrics
      const metrics = [
        '# HELP context_store_up Whether the context store is up',
        '# TYPE context_store_up gauge',
        `context_store_up ${health.services ? 1 : 0}`,
        '',
        '# HELP context_store_database_connected Whether the database is connected',
        '# TYPE context_store_database_connected gauge',
        `context_store_database_connected ${health.database ? 1 : 0}`,
        '',
        '# HELP context_store_uptime_seconds Uptime in seconds',
        '# TYPE context_store_uptime_seconds counter',
        `context_store_uptime_seconds ${health.uptime}`,
        '',
        '# HELP context_store_memory_usage_bytes Memory usage in bytes',
        '# TYPE context_store_memory_usage_bytes gauge',
        `context_store_memory_usage_bytes ${detailedHealth.metrics.memory.used}`,
        '',
        '# HELP context_store_memory_usage_percent Memory usage percentage',
        '# TYPE context_store_memory_usage_percent gauge',
        `context_store_memory_usage_percent ${detailedHealth.metrics.memory.percentage}`,
        '',
        '# HELP context_store_active_sessions Number of active sessions',
        '# TYPE context_store_active_sessions gauge',
        `context_store_active_sessions ${detailedHealth.metrics.services.contextManager.activeSessions}`,
        '',
        '# HELP context_store_pending_contexts Number of pending contexts',
        '# TYPE context_store_pending_contexts gauge',
        `context_store_pending_contexts ${detailedHealth.metrics.services.contextManager.pendingContexts}`,
        '',
        '# HELP context_store_search_index_size Search index size',
        '# TYPE context_store_search_index_size gauge',
        `context_store_search_index_size ${detailedHealth.metrics.services.search.indexSize}`,
        '',
      ].join('\n');

      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(metrics);
    } catch (error) {
      logger.error('Prometheus metrics check failed:', error);
      res.status(503).send('# Error generating metrics\n');
    }
  }
}

/**
 * Register health check routes with Express router
 */
export function registerHealthRoutes(router: any, app: PersistentContextStoreApp): void {
  const healthRoutes = new HealthRoutes(app);

  // Basic health endpoints
  router.get('/health', (req: Request, res: Response) => healthRoutes.healthCheck(req, res));
  router.get('/health/ready', (req: Request, res: Response) => healthRoutes.readinessCheck(req, res));
  router.get('/health/live', (req: Request, res: Response) => healthRoutes.livenessCheck(req, res));
  
  // Detailed health endpoints
  router.get('/health/detailed', (req: Request, res: Response) => healthRoutes.detailedHealth(req, res));
  router.get('/health/metrics', (req: Request, res: Response) => healthRoutes.healthMetrics(req, res));
  router.get('/health/metrics/history', (req: Request, res: Response) => healthRoutes.metricsHistory(req, res));
  
  // Monitoring system integrations
  router.get('/health/prometheus', (req: Request, res: Response) => healthRoutes.prometheusMetrics(req, res));
  router.get('/metrics', (req: Request, res: Response) => healthRoutes.prometheusMetrics(req, res)); // Alternative path
}