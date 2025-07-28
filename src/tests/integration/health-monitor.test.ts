/**
 * Health Monitor Integration Tests
 * Tests the complete health monitoring system
 */

import { getDefaultApp } from '../../app.js';
import { createServer } from '../../api/server.js';
import { logger } from '../../utils/logger.js';

describe('Health Monitor Integration Tests', () => {
  let app: ReturnType<typeof getDefaultApp>;
  let server: ReturnType<typeof createServer>;

  beforeAll(async () => {
    try {
      // Initialize the application
      app = getDefaultApp();
      await app.initialize();
      
      // Create API server with health monitoring
      server = createServer(app.contextStore, app.contextManager, app);
      
      logger.info('Test setup completed');
    } catch (error) {
      logger.error('Test setup failed:', error);
      throw error;
    }
  });

  afterAll(async () => {
    try {
      await app.shutdown();
      logger.info('Test cleanup completed');
    } catch (error) {
      logger.error('Test cleanup failed:', error);
    }
  });

  describe('Health Monitoring Service', () => {
    test('should perform health check', async () => {
      const healthSummary = await app.getDetailedHealthStatus();
      
      expect(healthSummary.status).toMatch(/healthy|warning|critical/);
      expect(healthSummary.checks).toBeInstanceOf(Array);
      expect(healthSummary.metrics).toBeDefined();
      expect(healthSummary.timestamp).toBeInstanceOf(Date);
    });

    test('should collect system metrics', async () => {
      const metrics = await app.healthMonitor.getSystemMetrics();
      
      expect(metrics.memory).toBeDefined();
      expect(metrics.memory.used).toBeGreaterThan(0);
      expect(metrics.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(metrics.memory.percentage).toBeLessThanOrEqual(100);
      
      expect(metrics.database).toBeDefined();
      expect(metrics.database.connected).toBe(true);
      
      expect(metrics.services).toBeDefined();
      expect(metrics.services.contextManager).toBeDefined();
      expect(metrics.services.search).toBeDefined();
      
      expect(metrics.performance).toBeDefined();
      expect(metrics.performance.uptime).toBeGreaterThan(0);
    });

    test('should track request metrics', () => {
      const initialRequestCount = app.healthMonitor['requestCount'];
      const initialErrorCount = app.healthMonitor['errorCount'];
      
      // Record some test metrics
      app.healthMonitor.recordRequest();
      app.healthMonitor.recordRequest();
      app.healthMonitor.recordError();
      
      expect(app.healthMonitor['requestCount']).toBe(initialRequestCount + 2);
      expect(app.healthMonitor['errorCount']).toBe(initialErrorCount + 1);
    });

    test('should maintain metrics history', async () => {
      // Generate some metrics
      await app.healthMonitor.getSystemMetrics();
      await app.healthMonitor.getSystemMetrics();
      
      const history = app.healthMonitor.getMetricsHistory();
      expect(history.length).toBeGreaterThan(0);
      
      // Each entry should have the expected structure
      const latestMetrics = history[history.length - 1];
      expect(latestMetrics.memory).toBeDefined();
      expect(latestMetrics.database).toBeDefined();
      expect(latestMetrics.services).toBeDefined();
      expect(latestMetrics.performance).toBeDefined();
    });
  });

  describe('MCP Health Tools', () => {
    test('get_detailed_health_status tool should work', async () => {
      const result = await app.healthMonitor.getHealthSummary();
      
      expect(result.status).toMatch(/healthy|warning|critical/);
      expect(result.checks.length).toBeGreaterThan(0);
      
      // Check that all expected health checks are present
      const checkNames = result.checks.map(check => check.name);
      expect(checkNames).toContain('database');
      expect(checkNames).toContain('context_manager');
      expect(checkNames).toContain('search_service');
      expect(checkNames).toContain('memory');
      expect(checkNames).toContain('performance');
    });

    test('health checks should have proper structure', async () => {
      const healthSummary = await app.getDetailedHealthStatus();
      
      for (const check of healthSummary.checks) {
        expect(check.name).toBeDefined();
        expect(check.status).toMatch(/healthy|warning|critical|unknown/);
        expect(check.message).toBeDefined();
        expect(check.responseTime).toBeGreaterThanOrEqual(0);
        expect(check.timestamp).toBeInstanceOf(Date);
      }
    });
  });

  describe('Performance Validation', () => {
    test('health checks should complete quickly', async () => {
      const startTime = Date.now();
      await app.healthMonitor.performHealthCheck();
      const duration = Date.now() - startTime;
      
      // Health checks should complete in under 5 seconds
      expect(duration).toBeLessThan(5000);
    });

    test('metrics collection should be lightweight', async () => {
      const startTime = Date.now();
      await app.healthMonitor.getSystemMetrics();
      const duration = Date.now() - startTime;
      
      // Metrics collection should complete in under 1 second
      expect(duration).toBeLessThan(1000);
    });
  });

  describe('Alert System', () => {
    test('should emit health check events', (done) => {
      let eventReceived = false;
      
      app.healthMonitor.once('healthCheck', (summary) => {
        eventReceived = true;
        expect(summary.status).toMatch(/healthy|warning|critical/);
        expect(summary.checks).toBeInstanceOf(Array);
        done();
      });
      
      // Trigger a health check
      app.healthMonitor.getHealthSummary();
      
      // Fail the test if no event is received within 2 seconds
      setTimeout(() => {
        if (!eventReceived) {
          done(new Error('Health check event not received'));
        }
      }, 2000);
    });
  });
});

/**
 * Test helper to simulate system stress
 */
async function simulateSystemStress(): Promise<void> {
  // Simulate high memory usage
  const largeArray = new Array(1000000).fill('test-data');
  
  // Simulate database activity
  await app.contextStore.searchContexts('test-query');
  
  // Simulate multiple requests
  for (let i = 0; i < 10; i++) {
    app.healthMonitor.recordRequest();
  }
  
  // Clean up
  largeArray.length = 0;
}

/**
 * Test environment validation
 */
describe('Test Environment Validation', () => {
  test('Neo4j should be running and accessible', async () => {
    expect(app.contextStore.isConnectedToDatabase()).toBe(true);
  });

  test('All services should be initialized', () => {
    const health = app.getHealthStatus();
    expect(health.services).toBe(true);
  });

  test('Health monitor should be active', () => {
    expect(app.healthMonitor).toBeDefined();
    // Health monitor should have started automatically during app initialization
  });
});