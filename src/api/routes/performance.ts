/**
 * Performance monitoring API routes
 * Provides HTTP endpoints for performance metrics, load testing, and optimization analysis
 */

import { Router, Request, Response } from 'express';
import { PersistentContextStoreApp } from '../../app.js';
import { logger } from '../../utils/logger.js';

export function registerPerformanceRoutes(
  router: Router,
  app: PersistentContextStoreApp
): void {
  
  /**
   * GET /performance/metrics
   * Get current performance metrics
   */
  router.get('/performance/metrics', async (req: Request, res: Response) => {
    try {
      const metrics = await app.performanceMonitor.getCurrentMetrics();
      
      res.json({
        success: true,
        data: {
          timestamp: metrics.timestamp,
          responseTime: {
            average: `${metrics.responseTime.average.toFixed(2)}ms`,
            p50: `${metrics.responseTime.p50.toFixed(2)}ms`,
            p95: `${metrics.responseTime.p95.toFixed(2)}ms`,
            p99: `${metrics.responseTime.p99.toFixed(2)}ms`,
            min: `${metrics.responseTime.min.toFixed(2)}ms`,
            max: `${metrics.responseTime.max.toFixed(2)}ms`,
          },
          throughput: {
            requestsPerSecond: metrics.throughput.requestsPerSecond.toFixed(2),
            contextsPerSecond: metrics.throughput.contextsPerSecond.toFixed(2),
          },
          resources: {
            memoryUsage: `${metrics.resources.memoryUsage.toFixed(1)}%`,
            cpuUsage: `${metrics.resources.cpuUsage.toFixed(1)}%`,
            diskUsage: `${metrics.resources.diskUsage.toFixed(1)}%`,
          },
          database: metrics.database,
          operations: metrics.operations,
        },
      });
    } catch (error) {
      logger.error('Error getting performance metrics:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance metrics',
      });
    }
  });

  /**
   * GET /performance/history
   * Get performance metrics history
   */
  router.get('/performance/history', async (req: Request, res: Response) => {
    try {
      const limit = parseInt(req.query.limit as string) || 100;
      const history = app.performanceMonitor.getMetricsHistory(limit);
      
      res.json({
        success: true,
        data: {
          history: history.map(metrics => ({
            timestamp: metrics.timestamp,
            responseTime: {
              average: metrics.responseTime.average.toFixed(2),
              p95: metrics.responseTime.p95.toFixed(2),
            },
            resources: {
              memoryUsage: metrics.resources.memoryUsage.toFixed(1),
              cpuUsage: metrics.resources.cpuUsage.toFixed(1),
            },
            throughput: metrics.throughput,
            database: metrics.database,
          })),
          totalRecords: history.length,
          limit,
        },
      });
    } catch (error) {
      logger.error('Error getting performance history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance history',
      });
    }
  });

  /**
   * POST /performance/load-test
   * Run a performance load test
   */
  router.post('/performance/load-test', async (req: Request, res: Response) => {
    try {
      const {
        concurrentUsers = 10,
        duration = 60000,
        rampUpTime = 10000,
      } = req.body;

      // Validate parameters
      if (concurrentUsers < 1 || concurrentUsers > 500) {
        return res.status(400).json({
          success: false,
          error: 'concurrentUsers must be between 1 and 500',
        });
      }

      if (duration < 10000 || duration > 1800000) {
        return res.status(400).json({
          success: false,
          error: 'duration must be between 10000ms (10s) and 1800000ms (30m)',
        });
      }

      if (rampUpTime < 1000 || rampUpTime > 300000) {
        return res.status(400).json({
          success: false,
          error: 'rampUpTime must be between 1000ms (1s) and 300000ms (5m)',
        });
      }

      logger.info(`Starting load test: ${concurrentUsers} users, ${duration}ms duration`);
      
      const result = await app.performanceMonitor.runLoadTest({
        concurrentUsers,
        duration,
        rampUpTime,
      });

      res.json({
        success: result.success,
        data: {
          testId: result.testId,
          results: {
            duration: result.duration,
            totalRequests: result.totalRequests,
            successfulRequests: result.successfulRequests,
            failedRequests: result.failedRequests,
            successRate: `${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`,
            averageResponseTime: `${result.averageResponseTime.toFixed(2)}ms`,
            maxResponseTime: `${result.maxResponseTime.toFixed(2)}ms`,
            requestsPerSecond: result.requestsPerSecond.toFixed(2),
          },
          errors: result.errors.slice(0, 10), // Limit error details
          metricsCollected: result.metrics.length,
        },
        message: result.success 
          ? `Load test completed: ${result.successfulRequests}/${result.totalRequests} requests succeeded`
          : `Load test failed: ${result.errors[0] || 'Unknown error'}`,
      });
    } catch (error) {
      logger.error('Error running load test:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to run load test',
      });
    }
  });

  /**
   * GET /performance/analyze
   * Analyze performance and get optimization recommendations
   */
  router.get('/performance/analyze', async (req: Request, res: Response) => {
    try {
      const recommendations = await app.performanceMonitor.analyzePerformance();
      
      res.json({
        success: true,
        data: {
          analysis: {
            totalRecommendations: recommendations.length,
            criticalIssues: recommendations.filter(r => r.severity === 'critical').length,
            highPriorityIssues: recommendations.filter(r => r.severity === 'high').length,
            mediumPriorityIssues: recommendations.filter(r => r.severity === 'medium').length,
            lowPriorityIssues: recommendations.filter(r => r.severity === 'low').length,
            categories: [...new Set(recommendations.map(r => r.category))],
          },
          recommendations: recommendations.map(rec => ({
            category: rec.category,
            severity: rec.severity,
            title: rec.title,
            description: rec.description,
            recommendation: rec.recommendation,
            estimatedImpact: rec.estimatedImpact,
            implementationComplexity: rec.implementationComplexity,
          })),
        },
        message: recommendations.length > 0 
          ? `Found ${recommendations.length} performance optimization opportunities`
          : 'No performance issues detected - system is performing optimally',
      });
    } catch (error) {
      logger.error('Error analyzing performance:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to analyze performance',
      });
    }
  });

  /**
   * DELETE /performance/history
   * Clear performance monitoring history
   */
  router.delete('/performance/history', async (req: Request, res: Response) => {
    try {
      app.performanceMonitor.clearHistory();
      
      res.json({
        success: true,
        message: 'Performance history cleared successfully',
      });
    } catch (error) {
      logger.error('Error clearing performance history:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to clear performance history',
      });
    }
  });

  /**
   * GET /performance/status
   * Get performance monitoring status
   */
  router.get('/performance/status', async (req: Request, res: Response) => {
    try {
      const isMonitoring = app.performanceMonitor['isMonitoring'];
      const historySize = app.performanceMonitor.getMetricsHistory().length;
      const currentMetrics = await app.performanceMonitor.getCurrentMetrics();
      
      res.json({
        success: true,
        data: {
          monitoring: {
            isActive: isMonitoring,
            historySize,
            lastUpdate: currentMetrics.timestamp,
          },
          currentStatus: {
            averageResponseTime: `${currentMetrics.responseTime.average.toFixed(2)}ms`,
            memoryUsage: `${currentMetrics.resources.memoryUsage.toFixed(1)}%`,
            requestsPerSecond: currentMetrics.throughput.requestsPerSecond.toFixed(2),
            databaseResponseTime: `${currentMetrics.database.queryResponseTime}ms`,
          },
          thresholds: {
            maxResponseTime: '5000ms',
            maxMemoryUsage: '80%',
            maxCpuUsage: '70%',
            maxDatabaseResponseTime: '1000ms',
          },
        },
      });
    } catch (error) {
      logger.error('Error getting performance status:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get performance status',
      });
    }
  });

  /**
   * POST /performance/monitoring/start
   * Start continuous performance monitoring
   */
  router.post('/performance/monitoring/start', async (req: Request, res: Response) => {
    try {
      app.performanceMonitor.start();
      
      res.json({
        success: true,
        message: 'Performance monitoring started',
      });
    } catch (error) {
      logger.error('Error starting performance monitoring:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to start performance monitoring',
      });
    }
  });

  /**
   * POST /performance/monitoring/stop
   * Stop continuous performance monitoring
   */
  router.post('/performance/monitoring/stop', async (req: Request, res: Response) => {
    try {
      app.performanceMonitor.stop();
      
      res.json({
        success: true,
        message: 'Performance monitoring stopped',
      });
    } catch (error) {
      logger.error('Error stopping performance monitoring:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to stop performance monitoring',
      });
    }
  });

  /**
   * GET /performance/prometheus
   * Prometheus-compatible metrics endpoint
   */
  router.get('/performance/prometheus', async (req: Request, res: Response) => {
    try {
      const metrics = await app.performanceMonitor.getCurrentMetrics();
      
      // Generate Prometheus-format metrics
      const prometheusMetrics = [
        `# HELP context_store_response_time_seconds Response time in seconds`,
        `# TYPE context_store_response_time_seconds histogram`,
        `context_store_response_time_seconds_average ${(metrics.responseTime.average / 1000).toFixed(6)}`,
        `context_store_response_time_seconds_p50 ${(metrics.responseTime.p50 / 1000).toFixed(6)}`,
        `context_store_response_time_seconds_p95 ${(metrics.responseTime.p95 / 1000).toFixed(6)}`,
        `context_store_response_time_seconds_p99 ${(metrics.responseTime.p99 / 1000).toFixed(6)}`,
        '',
        `# HELP context_store_memory_usage_percent Memory usage percentage`,
        `# TYPE context_store_memory_usage_percent gauge`,
        `context_store_memory_usage_percent ${metrics.resources.memoryUsage.toFixed(2)}`,
        '',
        `# HELP context_store_requests_per_second Requests per second`,
        `# TYPE context_store_requests_per_second gauge`,
        `context_store_requests_per_second ${metrics.throughput.requestsPerSecond.toFixed(2)}`,
        '',
        `# HELP context_store_database_response_time_seconds Database response time in seconds`,
        `# TYPE context_store_database_response_time_seconds gauge`,
        `context_store_database_response_time_seconds ${(metrics.database.queryResponseTime / 1000).toFixed(6)}`,
        '',
        `# HELP context_store_operation_calls_total Total operation calls`,
        `# TYPE context_store_operation_calls_total counter`,
        `context_store_operation_calls_total{operation="saveContext"} ${metrics.operations.saveContext.totalCalls}`,
        `context_store_operation_calls_total{operation="searchContext"} ${metrics.operations.searchContext.totalCalls}`,
        `context_store_operation_calls_total{operation="loadContext"} ${metrics.operations.loadContext.totalCalls}`,
        '',
        `# HELP context_store_operation_errors_total Total operation errors`,
        `# TYPE context_store_operation_errors_total counter`,
        `context_store_operation_errors_total{operation="saveContext"} ${metrics.operations.saveContext.errorCount}`,
        `context_store_operation_errors_total{operation="searchContext"} ${metrics.operations.searchContext.errorCount}`,
        `context_store_operation_errors_total{operation="loadContext"} ${metrics.operations.loadContext.errorCount}`,
        '',
      ].join('\n');

      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.send(prometheusMetrics);
    } catch (error) {
      logger.error('Error generating Prometheus metrics:', error);
      res.status(500).send('# Error generating metrics\n');
    }
  });
}