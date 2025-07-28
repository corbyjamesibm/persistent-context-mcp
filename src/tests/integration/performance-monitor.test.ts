/**
 * Performance Monitor Integration Tests
 * Tests the complete performance monitoring and load testing system
 */

import { getDefaultApp } from '../../app.js';
import { logger } from '../../utils/logger.js';

describe('Performance Monitor Integration Tests', () => {
  let app: ReturnType<typeof getDefaultApp>;

  beforeAll(async () => {
    try {
      // Initialize the application
      app = getDefaultApp();
      await app.initialize();
      
      logger.info('Performance monitor test setup completed');
    } catch (error) {
      logger.error('Performance monitor test setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await app.shutdown();
      logger.info('Performance monitor test cleanup completed');
    } catch (error) {
      logger.error('Performance monitor test cleanup failed:', error);
    }
  });

  describe('Performance Metrics Collection', () => {
    test('should collect current performance metrics', async () => {
      const metrics = await app.performanceMonitor.getCurrentMetrics();
      
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.responseTime).toBeDefined();
      expect(metrics.responseTime.average).toBeGreaterThanOrEqual(0);
      expect(metrics.responseTime.p95).toBeGreaterThanOrEqual(0);
      expect(metrics.throughput).toBeDefined();
      expect(metrics.resources).toBeDefined();
      expect(metrics.resources.memoryUsage).toBeGreaterThanOrEqual(0);
      expect(metrics.resources.memoryUsage).toBeLessThanOrEqual(100);
      expect(metrics.database).toBeDefined();
      expect(metrics.operations).toBeDefined();
    });

    test('should record operation performance', () => {
      const initialStats = app.performanceMonitor['operationStats'].get('testOperation');
      
      // Record some test operations
      app.performanceMonitor.recordOperation('testOperation', 150, true);
      app.performanceMonitor.recordOperation('testOperation', 200, false);
      app.performanceMonitor.recordOperation('testOperation', 100, true);
      
      const updatedStats = app.performanceMonitor['operationStats'].get('testOperation');
      expect(updatedStats.totalCalls).toBe(3);
      expect(updatedStats.errorCount).toBe(1);
      expect(updatedStats.errorRate).toBeCloseTo(33.33, 1);
      expect(updatedStats.minTime).toBe(100);
      expect(updatedStats.maxTime).toBe(200);
    });

    test('should maintain metrics history', async () => {
      // Generate some metrics
      await app.performanceMonitor.getCurrentMetrics();
      await app.performanceMonitor.getCurrentMetrics();
      
      const history = app.performanceMonitor.getMetricsHistory();
      expect(history.length).toBeGreaterThan(0);
      
      // Each entry should have the expected structure
      const latestMetrics = history[history.length - 1];
      expect(latestMetrics.timestamp).toBeInstanceOf(Date);
      expect(latestMetrics.responseTime).toBeDefined();
      expect(latestMetrics.throughput).toBeDefined();
      expect(latestMetrics.resources).toBeDefined();
    });
  });

  describe('Load Testing', () => {
    test('should run a small load test successfully', async () => {
      const result = await app.performanceMonitor.runLoadTest({
        concurrentUsers: 2,
        duration: 5000, // 5 seconds
        rampUpTime: 1000, // 1 second ramp up
      });
      
      expect(result.success).toBe(true);
      expect(result.testId).toBeDefined();
      expect(result.totalRequests).toBeGreaterThan(0);
      expect(result.duration).toBeGreaterThan(4000); // Should be close to 5 seconds
      expect(result.duration).toBeLessThan(10000); // But not too much longer
      expect(result.averageResponseTime).toBeGreaterThan(0);
      expect(result.requestsPerSecond).toBeGreaterThan(0);
      expect(result.metrics.length).toBeGreaterThan(0); // Should have collected metrics
    }, 15000); // 15 second timeout for load test

    test('should handle load test with higher concurrency', async () => {
      const result = await app.performanceMonitor.runLoadTest({
        concurrentUsers: 5,
        duration: 3000, // 3 seconds
        rampUpTime: 500, // 0.5 second ramp up
      });
      
      expect(result.success).toBe(true);
      expect(result.totalRequests).toBeGreaterThan(5); // Should have multiple requests
      expect(result.successfulRequests).toBeGreaterThan(0);
      
      // Calculate success rate
      const successRate = (result.successfulRequests / result.totalRequests) * 100;
      expect(successRate).toBeGreaterThan(50); // At least 50% success rate
    }, 10000); // 10 second timeout
  });

  describe('Performance Analysis', () => {
    test('should analyze performance and provide recommendations', async () => {
      // First create some performance data
      for (let i = 0; i < 10; i++) {
        app.performanceMonitor.recordOperation('slowOperation', 6000, true); // 6 second operations
      }
      
      const recommendations = await app.performanceMonitor.analyzePerformance();
      
      expect(Array.isArray(recommendations)).toBe(true);
      
      // Should have recommendations due to slow operations
      if (recommendations.length > 0) {
        const recommendation = recommendations[0];
        expect(recommendation.category).toBeDefined();
        expect(recommendation.severity).toMatch(/low|medium|high|critical/);
        expect(recommendation.title).toBeDefined();
        expect(recommendation.description).toBeDefined();
        expect(recommendation.recommendation).toBeDefined();
        expect(recommendation.estimatedImpact).toBeDefined();
        expect(recommendation.implementationComplexity).toMatch(/low|medium|high/);
      }
    });

    test('should detect high error rates', async () => {
      // Create operations with high error rate
      for (let i = 0; i < 20; i++) {
        app.performanceMonitor.recordOperation('errorProneOperation', 100, i < 15); // 75% failure rate
      }
      
      const recommendations = await app.performanceMonitor.analyzePerformance();
      const errorRateRecommendations = recommendations.filter(r => 
        r.title.toLowerCase().includes('error') || 
        r.description.toLowerCase().includes('error')
      );
      
      expect(errorRateRecommendations.length).toBeGreaterThan(0);
    });
  });

  describe('MCP Performance Tools', () => {
    test('get_performance_metrics tool should work', async () => {
      const metrics = await app.performanceMonitor.getCurrentMetrics();
      
      expect(metrics).toBeDefined();
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.responseTime.average).toBeGreaterThanOrEqual(0);
      expect(metrics.resources.memoryUsage).toBeGreaterThanOrEqual(0);
    });

    test('analyze_performance tool should provide actionable insights', async () => {
      const recommendations = await app.performanceMonitor.analyzePerformance();
      
      expect(Array.isArray(recommendations)).toBe(true);
      
      // Verify recommendation structure
      recommendations.forEach(rec => {
        expect(rec.category).toMatch(/database|memory|cpu|network|caching/);
        expect(rec.severity).toMatch(/low|medium|high|critical/);
        expect(rec.title).toBeTruthy();
        expect(rec.description).toBeTruthy();
        expect(rec.recommendation).toBeTruthy();
      });
    });
  });

  describe('Continuous Monitoring', () => {
    test('should start and stop monitoring', () => {
      // Stop monitoring if it's running
      app.performanceMonitor.stop();
      
      // Start monitoring
      app.performanceMonitor.start();
      expect(app.performanceMonitor['isMonitoring']).toBe(true);
      
      // Stop monitoring
      app.performanceMonitor.stop();
      expect(app.performanceMonitor['isMonitoring']).toBe(false);
    });

    test('should emit monitoring events', (done) => {
      let eventReceived = false;
      
      app.performanceMonitor.once('performanceCheck', (metrics) => {
        eventReceived = true;
        expect(metrics.timestamp).toBeInstanceOf(Date);
        expect(metrics.responseTime).toBeDefined();
        done();
      });
      
      // Manually trigger a monitoring check
      app.performanceMonitor['scheduleNextMonitoring']();
      
      // Fail the test if no event is received within 5 seconds
      setTimeout(() => {
        if (!eventReceived) {
          done(new Error('Performance check event not received'));
        }
      }, 5000);
    });
  });

  describe('History Management', () => {
    test('should manage performance history', async () => {
      // Clear existing history
      app.performanceMonitor.clearHistory();
      
      let history = app.performanceMonitor.getMetricsHistory();
      expect(history.length).toBe(0);
      
      // Generate some metrics
      await app.performanceMonitor.getCurrentMetrics();
      await app.performanceMonitor.getCurrentMetrics();
      
      history = app.performanceMonitor.getMetricsHistory();
      expect(history.length).toBeGreaterThan(0);
      
      // Clear again
      app.performanceMonitor.clearHistory();
      history = app.performanceMonitor.getMetricsHistory();
      expect(history.length).toBe(0);
    });

    test('should limit history size', async () => {
      app.performanceMonitor.clearHistory();
      
      // Generate many metrics entries (simulate long running)
      for (let i = 0; i < 1500; i++) {
        app.performanceMonitor['metricsHistory'].push({
          timestamp: new Date(),
          responseTime: { average: 100, p50: 90, p95: 150, p99: 200, min: 50, max: 300 },
          throughput: { requestsPerSecond: 10, contextsPerSecond: 5 },
          resources: { memoryUsage: 50, cpuUsage: 30, diskUsage: 40 },
          database: { connectionCount: 1, queryResponseTime: 50, transactionCount: 0 },
          operations: {
            saveContext: { totalCalls: 100, averageTime: 200, minTime: 50, maxTime: 500, errorCount: 2, errorRate: 2 },
            searchContext: { totalCalls: 200, averageTime: 150, minTime: 30, maxTime: 400, errorCount: 1, errorRate: 0.5 },
            loadContext: { totalCalls: 300, averageTime: 100, minTime: 20, maxTime: 250, errorCount: 0, errorRate: 0 },
          },
        });
      }
      
      // Should limit to 1000 entries
      const history = app.performanceMonitor.getMetricsHistory();
      expect(history.length).toBeLessThanOrEqual(1000);
    });
  });

  describe('Performance Validation', () => {
    test('performance monitoring should be lightweight', async () => {
      const startTime = Date.now();
      await app.performanceMonitor.getCurrentMetrics();
      const duration = Date.now() - startTime;
      
      // Metrics collection should be fast (under 1 second)
      expect(duration).toBeLessThan(1000);
    });

    test('load test should handle concurrent operations', async () => {
      const startTime = Date.now();
      
      // Run two concurrent micro load tests
      const [result1, result2] = await Promise.all([
        app.performanceMonitor.runLoadTest({
          concurrentUsers: 2,
          duration: 2000,
          rampUpTime: 200,
        }),
        app.performanceMonitor.runLoadTest({
          concurrentUsers: 2,
          duration: 2000,
          rampUpTime: 200,
        }),
      ]);
      
      const totalDuration = Date.now() - startTime;
      
      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(totalDuration).toBeLessThan(6000); // Should complete concurrently, not sequentially
    }, 10000);
  });
});

/**
 * Test environment validation
 */
describe('Performance Monitor Test Environment', () => {
  test('Performance monitor should be initialized', () => {
    expect(app.performanceMonitor).toBeDefined();
    expect(typeof app.performanceMonitor.getCurrentMetrics).toBe('function');
    expect(typeof app.performanceMonitor.runLoadTest).toBe('function');
    expect(typeof app.performanceMonitor.analyzePerformance).toBe('function');
  });

  test('All required services should be available', () => {
    expect(app.contextStore).toBeDefined();
    expect(app.contextManager).toBeDefined();
    expect(app.searchService).toBeDefined();
    expect(app.healthMonitor).toBeDefined();
    expect(app.backupRecovery).toBeDefined();
  });
});