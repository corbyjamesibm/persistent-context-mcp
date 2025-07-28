/**
 * All Services Integration Tests
 * Tests the interaction between all services working together
 */

import { setupTestEnvironment, setupTestData, waitForCondition } from '../setup/test-environment.js';
import { logger } from '../../utils/logger.js';

describe('All Services Integration Tests', () => {
  let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;
  let testData: Awaited<ReturnType<typeof setupTestData>>;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment({
      enablePerformanceMonitoring: true,
      enableBackups: true,
      testDatabaseSuffix: 'integration_all_services',
    });
    
    testData = await setupTestData(testEnv.app);
    
    logger.info('All services integration test environment initialized');
  }, 30000);

  afterAll(async () => {
    await testEnv.cleanup();
  }, 15000);

  describe('Service Initialization and Dependencies', () => {
    test('should initialize all services in correct order', async () => {
      const services = [
        'contextStore',
        'contextManager',
        'searchService',
        'templateGenerator',
        'healthMonitor',
        'backupRecovery',
        'performanceMonitor',
      ];

      services.forEach(serviceName => {
        expect(testEnv.app[serviceName as keyof typeof testEnv.app]).toBeDefined();
      });

      // Verify health status shows all services are healthy
      const healthStatus = testEnv.app.getHealthStatus();
      expect(healthStatus.database).toBe(true);
      expect(healthStatus.services).toBe(true);
    });

    test('should handle service interdependencies correctly', async () => {
      // Context store should be connected
      expect(testEnv.app.contextStore.isConnectedToDatabase()).toBe(true);

      // Context manager should reference context store
      expect(testEnv.app.contextManager['contextStore']).toBe(testEnv.app.contextStore);

      // Search service should have indexed existing contexts
      const searchStats = testEnv.app.searchService.getSearchStats();
      expect(searchStats.indexSize).toBeGreaterThan(0);

      // Health monitor should be monitoring all services
      const detailedHealth = await testEnv.app.getDetailedHealthStatus();
      expect(detailedHealth.checks.length).toBeGreaterThan(5);
    });
  });

  describe('Cross-Service Data Flow', () => {
    test('should handle complete context lifecycle across services', async () => {
      const sessionId = 'cross-service-test';
      
      // 1. Save context via context manager
      const saveResult = await testEnv.app.contextManager.saveContextImmediate(sessionId, {
        title: 'Cross-Service Integration Test',
        content: 'This context tests integration across all services',
        type: 'development',
        tags: ['integration', 'cross-service', 'testing'],
        metadata: {
          aiGenerated: true,
          source: 'integration-test',
          importance: 'high',
        },
      });

      expect(saveResult.success).toBe(true);
      expect(saveResult.contextId).toBeDefined();

      // 2. Verify context is stored in context store
      const storedContext = await testEnv.app.contextStore.getContext(saveResult.contextId!);
      expect(storedContext).toBeDefined();
      expect(storedContext?.title).toBe('Cross-Service Integration Test');

      // 3. Wait for context to be indexed in search service
      await waitForCondition(async () => {
        const searchResult = await testEnv.app.searchService.search({
          query: 'Cross-Service Integration Test',
          options: { limit: 10 },
        });
        return searchResult.results.some(r => r.context.id === saveResult.contextId);
      }, 10000);

      // 4. Verify context is searchable
      const searchResult = await testEnv.app.searchService.search({
        query: 'Cross-Service Integration Test',
        options: { limit: 10 },
      });
      
      const foundContext = searchResult.results.find(r => r.context.id === saveResult.contextId);
      expect(foundContext).toBeDefined();

      // 5. Record performance metrics for the operation
      testEnv.app.performanceMonitor.recordOperation('crossServiceSave', 100, true);
      
      const metrics = await testEnv.app.performanceMonitor.getCurrentMetrics();
      expect(metrics.operations.crossServiceSave).toBeDefined();
      expect(metrics.operations.crossServiceSave.totalCalls).toBeGreaterThan(0);

      // 6. Verify health monitoring recorded the activity
      const systemMetrics = await testEnv.app.healthMonitor.getSystemMetrics();
      expect(systemMetrics.services.contextManager.isActive).toBe(true);
      expect(systemMetrics.services.search.isActive).toBe(true);
    });

    test('should handle context updates propagating through all services', async () => {
      // Use an existing context from test data
      const originalContext = testData.contexts[0];
      
      // Update context through context store
      const updatedContext = await testEnv.app.contextStore.updateContext(originalContext.id, {
        title: 'Updated Title for Integration Test',
        content: 'Updated content to test service integration',
        tags: [...originalContext.tags, 'updated', 'integration-test'],
      });

      expect(updatedContext).toBeDefined();
      expect(updatedContext?.title).toBe('Updated Title for Integration Test');

      // Wait for search index to be updated
      await waitForCondition(async () => {
        const searchResult = await testEnv.app.searchService.search({
          query: 'Updated Title for Integration Test',
          options: { limit: 10 },
        });
        return searchResult.results.some(r => r.context.id === originalContext.id);
      }, 10000);

      // Verify updated context is searchable with new content
      const searchResult = await testEnv.app.searchService.search({
        query: 'Updated Title for Integration Test',
        options: { limit: 10 },
      });

      const foundContext = searchResult.results.find(r => r.context.id === originalContext.id);
      expect(foundContext).toBeDefined();
      expect(foundContext?.context.title).toBe('Updated Title for Integration Test');
    });

    test('should handle template generation using searched contexts', async () => {
      // Search for development contexts
      const searchResult = await testEnv.app.searchService.search({
        query: '',
        filters: { type: 'development' },
        options: { limit: 3 },
      });

      expect(searchResult.results.length).toBeGreaterThan(1);

      // Generate template from search results
      const templateConfig = {
        title: 'Integration Test Template',
        description: 'Template generated from searched contexts',
        type: 'development',
      };

      const contextIds = searchResult.results.slice(0, 3).map(r => r.context.id);
      const template = await testEnv.app.templateGenerator.generateTemplate(
        contextIds,
        templateConfig
      );

      expect(template.id).toBeDefined();
      expect(template.title).toBe('Integration Test Template');
      expect(template.variables.length).toBeGreaterThan(0);

      // Apply template to create new context
      const variableValues = template.variables.reduce((acc, variable) => {
        acc[variable.name] = `integration-test-${variable.name}`;
        return acc;
      }, {} as Record<string, string>);

      const appliedContextId = await testEnv.app.templateGenerator.applyTemplate(
        template.id,
        variableValues,
        {
          title: 'Template Applied Context',
          sessionId: 'template-integration-session',
          tags: ['template', 'integration'],
        }
      );

      expect(appliedContextId).toBeDefined();

      // Verify applied context is stored and searchable
      const appliedContext = await testEnv.app.contextStore.getContext(appliedContextId);
      expect(appliedContext).toBeDefined();
      expect(appliedContext?.title).toBe('Template Applied Context');
    });
  });

  describe('Monitoring and Observability Integration', () => {
    test('should monitor service health continuously', async () => {
      // Start health monitoring
      testEnv.app.healthMonitor.start();
      
      // Wait for health check cycle
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Get health metrics
      const healthSummary = await testEnv.app.healthMonitor.getHealthSummary();
      expect(healthSummary.status).toMatch(/healthy|warning|critical/);
      expect(healthSummary.checks.length).toBeGreaterThan(0);

      // Verify specific service health checks
      const checkNames = healthSummary.checks.map(check => check.name);
      expect(checkNames).toContain('database');
      expect(checkNames).toContain('context_manager');
      expect(checkNames).toContain('search_service');

      // All checks should be healthy in test environment
      const unhealthyChecks = healthSummary.checks.filter(check => 
        check.status === 'critical'
      );
      expect(unhealthyChecks.length).toBe(0);
    });

    test('should track performance across all services', async () => {
      // Perform operations across multiple services
      const operations = [
        () => testEnv.app.contextStore.saveContext({
          title: 'Performance Test Context',
          content: 'Content for performance testing',
          type: 'development',
          tags: ['performance'],
          sessionId: 'perf-test-session',
          metadata: {
            aiGenerated: true,
            source: 'performance-test',
            importance: 'low',
          },
        }),
        () => testEnv.app.searchService.search({
          query: 'performance',
          options: { limit: 10 },
        }),
        () => testEnv.app.contextManager.getRecentSessions(5),
      ];

      // Execute operations and record performance
      for (let i = 0; i < operations.length; i++) {
        const startTime = Date.now();
        await operations[i]();
        const duration = Date.now() - startTime;
        
        testEnv.app.performanceMonitor.recordOperation(`operation-${i}`, duration, true);
      }

      // Get performance metrics
      const metrics = await testEnv.app.performanceMonitor.getCurrentMetrics();
      expect(metrics.operations['operation-0']).toBeDefined();
      expect(metrics.operations['operation-1']).toBeDefined();
      expect(metrics.operations['operation-2']).toBeDefined();

      // Analyze performance
      const recommendations = await testEnv.app.performanceMonitor.analyzePerformance();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    test('should handle backup and recovery integration', async () => {
      // Create some contexts to backup
      const contextIds = [];
      for (let i = 0; i < 3; i++) {
        const contextId = await testEnv.app.contextStore.saveContext({
          title: `Backup Test Context ${i}`,
          content: `Content for backup test context ${i}`,
          type: 'general',
          tags: ['backup-test'],
          sessionId: `backup-session-${i}`,
          metadata: {
            aiGenerated: false,
            source: 'backup-test',
            importance: 'low',
          },
        });
        contextIds.push(contextId);
      }

      // Create backup
      const backupResult = await testEnv.app.backupRecovery.createBackup('full');
      expect(backupResult.success).toBe(true);
      expect(backupResult.metadata.contextCount).toBeGreaterThanOrEqual(3);

      // Simulate data loss by deleting one context
      const deletedContextId = contextIds[0];
      await testEnv.app.contextStore.deleteContext(deletedContextId);

      // Verify context is deleted
      const deletedContext = await testEnv.app.contextStore.getContext(deletedContextId);
      expect(deletedContext).toBeNull();

      // Restore from backup
      const restoreResult = await testEnv.app.backupRecovery.restoreFromBackup(
        backupResult.backupId,
        { overwriteExisting: true }
      );

      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restoredContexts).toBeGreaterThan(0);

      // Verify context is restored
      const restoredContext = await testEnv.app.contextStore.getContext(deletedContextId);
      expect(restoredContext).toBeDefined();
      expect(restoredContext?.title).toBe('Backup Test Context 0');
    }, 20000);
  });

  describe('Error Handling and Recovery', () => {
    test('should handle service failures gracefully', async () => {
      // Simulate search service failure by searching with invalid parameters
      const searchResult = await testEnv.app.searchService.search({
        query: null as any,
        options: { limit: -1 },
      });

      // Should still return a valid response structure
      expect(searchResult.results).toBeInstanceOf(Array);
      expect(searchResult.totalCount).toBeGreaterThanOrEqual(0);

      // Health monitoring should still work
      const healthStatus = await testEnv.app.getDetailedHealthStatus();
      expect(healthStatus.status).toMatch(/healthy|warning|critical/);
    });

    test('should recover from temporary service issues', async () => {
      // Record some errors
      testEnv.app.healthMonitor.recordError();
      testEnv.app.performanceMonitor.recordOperation('failedOperation', 1000, false);

      // Services should continue to function
      const contextId = await testEnv.app.contextStore.saveContext({
        title: 'Recovery Test Context',
        content: 'Testing service recovery',
        type: 'general',
        tags: ['recovery-test'],
        sessionId: 'recovery-session',
        metadata: {
          aiGenerated: true,
          source: 'recovery-test',
          importance: 'low',
        },
      });

      expect(contextId).toBeDefined();

      // Context should be retrievable
      const context = await testEnv.app.contextStore.getContext(contextId);
      expect(context).toBeDefined();
      expect(context?.title).toBe('Recovery Test Context');
    });

    test('should maintain data consistency during concurrent operations', async () => {
      const sessionId = 'consistency-test-session';
      const promises = [];

      // Perform multiple concurrent operations
      for (let i = 0; i < 10; i++) {
        promises.push(
          testEnv.app.contextManager.saveContextImmediate(sessionId, {
            title: `Consistency Test Context ${i}`,
            content: `Content for consistency test ${i}`,
            type: 'development',
            tags: ['consistency', `test-${i}`],
            metadata: {
              aiGenerated: true,
              source: 'consistency-test',
              importance: 'medium',
            },
          })
        );
      }

      const results = await Promise.all(promises);

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.success).toBe(true);
        expect(result.contextId).toBeDefined();
      });

      // Verify all contexts are stored correctly
      const sessionContexts = await testEnv.app.contextManager.getSessionContexts(sessionId, 20);
      expect(sessionContexts.length).toBe(10);

      // Verify contexts are searchable
      const searchResult = await testEnv.app.searchService.search({
        query: 'Consistency Test Context',
        options: { limit: 15 },
      });

      const consistencyContexts = searchResult.results.filter(r => 
        r.context.title.includes('Consistency Test Context')
      );
      expect(consistencyContexts.length).toBe(10);
    });
  });

  describe('Performance Under Load', () => {
    test('should maintain performance under moderate load', async () => {
      const startTime = Date.now();
      const operations = [];
      const operationCount = 50;

      // Create multiple concurrent operations across services
      for (let i = 0; i < operationCount; i++) {
        const operationType = i % 3;
        
        if (operationType === 0) {
          // Save context
          operations.push(
            testEnv.app.contextStore.saveContext({
              title: `Load Test Context ${i}`,
              content: `Content for load test ${i}`,
              type: 'development',
              tags: ['load-test'],
              sessionId: `load-session-${i}`,
              metadata: {
                aiGenerated: true,
                source: 'load-test',
                importance: 'low',
              },
            })
          );
        } else if (operationType === 1) {
          // Search contexts
          operations.push(
            testEnv.app.searchService.search({
              query: 'test',
              options: { limit: 5 },
            })
          );
        } else {
          // Get recent sessions
          operations.push(
            testEnv.app.contextManager.getRecentSessions(5)
          );
        }
      }

      const results = await Promise.all(operations);
      const totalTime = Date.now() - startTime;

      expect(results.length).toBe(operationCount);
      expect(totalTime).toBeLessThan(15000); // Should complete within 15 seconds

      // Verify system is still healthy after load
      const healthStatus = await testEnv.app.getDetailedHealthStatus();
      expect(healthStatus.status).toMatch(/healthy|warning/); // Should not be critical
    }, 20000);

    test('should handle memory usage efficiently', async () => {
      const initialMetrics = await testEnv.app.performanceMonitor.getCurrentMetrics();
      const initialMemoryUsage = initialMetrics.resources.memoryUsage;

      // Create many contexts
      const contextIds = [];
      for (let i = 0; i < 100; i++) {
        const contextId = await testEnv.app.contextStore.saveContext({
          title: `Memory Test Context ${i}`,
          content: `Large content for memory test ${'x'.repeat(1000)}`,
          type: 'general',
          tags: ['memory-test'],
          sessionId: `memory-session-${i}`,
          metadata: {
            aiGenerated: true,
            source: 'memory-test',
            importance: 'low',
          },
        });
        contextIds.push(contextId);
      }

      // Check memory usage after operations
      const finalMetrics = await testEnv.app.performanceMonitor.getCurrentMetrics();
      const finalMemoryUsage = finalMetrics.resources.memoryUsage;

      // Memory usage should not increase excessively
      const memoryIncrease = finalMemoryUsage - initialMemoryUsage;
      expect(memoryIncrease).toBeLessThan(50); // Less than 50% increase

      // System should still be responsive
      const searchResult = await testEnv.app.searchService.search({
        query: 'Memory Test Context',
        options: { limit: 10 },
      });

      expect(searchResult.results.length).toBeGreaterThan(0);
      expect(searchResult.executionTime).toBeLessThan(5000); // Within 5 seconds
    }, 30000);
  });

  describe('Service Events and Communication', () => {
    test('should emit and handle events between services', (done) => {
      let eventsReceived = 0;
      const expectedEvents = 3;

      // Listen for events from different services
      testEnv.app.contextStore.once('contextSaved', () => {
        eventsReceived++;
        if (eventsReceived === expectedEvents) done();
      });

      testEnv.app.searchService.once('indexBuildCompleted', () => {
        eventsReceived++;
        if (eventsReceived === expectedEvents) done();
      });

      testEnv.app.contextManager.once('contextSaved', () => {
        eventsReceived++;
        if (eventsReceived === expectedEvents) done();
      });

      // Trigger events
      testEnv.app.contextManager.saveContextImmediate('event-test-session', {
        title: 'Event Test Context',
        content: 'Testing event communication',
        type: 'general',
        tags: ['event-test'],
        metadata: {
          aiGenerated: true,
          source: 'event-test',
          importance: 'low',
        },
      });

      testEnv.app.searchService.buildIndex();

      // Timeout if events are not received
      setTimeout(() => {
        if (eventsReceived < expectedEvents) {
          done(new Error(`Only received ${eventsReceived}/${expectedEvents} events`));
        }
      }, 10000);
    });

    test('should coordinate service shutdowns properly', async () => {
      // Get initial service states
      const initialHealth = testEnv.app.getHealthStatus();
      expect(initialHealth.services).toBe(true);

      // Stop individual services
      testEnv.app.performanceMonitor.stop();
      testEnv.app.healthMonitor.stop();
      testEnv.app.backupRecovery.stop();

      // Core services should still be running
      const contextId = await testEnv.app.contextStore.saveContext({
        title: 'Shutdown Test Context',
        content: 'Testing service shutdown coordination',
        type: 'general',
        tags: ['shutdown-test'],
        sessionId: 'shutdown-session',
        metadata: {
          aiGenerated: true,
          source: 'shutdown-test',
          importance: 'low',
        },
      });

      expect(contextId).toBeDefined();

      // Restart stopped services
      testEnv.app.performanceMonitor.start();
      testEnv.app.healthMonitor.start();
      await testEnv.app.backupRecovery.start();

      // Verify all services are operational again
      const finalHealth = await testEnv.app.getDetailedHealthStatus();
      expect(finalHealth.status).toMatch(/healthy|warning/);
    });
  });
});

/**
 * Integration Test Utilities
 */
export class IntegrationTestUtils {
  static async waitForAllServices(app: any, timeout: number = 15000): Promise<void> {
    await waitForCondition(
      async () => {
        const health = await app.getDetailedHealthStatus();
        const criticalChecks = health.checks.filter((check: any) => check.status === 'critical');
        return criticalChecks.length === 0;
      },
      timeout
    );
  }

  static async performLoadTest(
    app: any,
    operations: Array<() => Promise<any>>,
    concurrency: number = 10
  ): Promise<{
    results: any[];
    totalTime: number;
    averageTime: number;
    successRate: number;
  }> {
    const startTime = Date.now();
    const results = [];
    let successCount = 0;

    // Execute operations in batches for controlled concurrency
    for (let i = 0; i < operations.length; i += concurrency) {
      const batch = operations.slice(i, i + concurrency);
      const batchPromises = batch.map(async (operation) => {
        try {
          const result = await operation();
          successCount++;
          return result;
        } catch (error) {
          return { error: error.message };
        }
      });

      const batchResults = await Promise.all(batchPromises);
      results.push(...batchResults);
    }

    const totalTime = Date.now() - startTime;
    const averageTime = totalTime / operations.length;
    const successRate = (successCount / operations.length) * 100;

    return {
      results,
      totalTime,
      averageTime,
      successRate,
    };
  }

  static validateServiceHealth(healthStatus: any): void {
    expect(healthStatus.status).toMatch(/healthy|warning|critical/);
    expect(healthStatus.checks).toBeInstanceOf(Array);
    expect(healthStatus.checks.length).toBeGreaterThan(0);
    expect(healthStatus.metrics).toBeDefined();
    expect(healthStatus.timestamp).toBeInstanceOf(Date);

    // Check for critical failures
    const criticalChecks = healthStatus.checks.filter(
      (check: any) => check.status === 'critical'
    );
    expect(criticalChecks.length).toBe(0);
  }

  static async createTestWorkload(
    app: any,
    contextCount: number = 10,
    searchCount: number = 5
  ): Promise<{
    contextIds: string[];
    searchResults: any[];
  }> {
    const contextIds: string[] = [];
    const searchResults: any[] = [];

    // Create contexts
    for (let i = 0; i < contextCount; i++) {
      const contextId = await app.contextStore.saveContext({
        title: `Workload Test Context ${i}`,
        content: `Content for workload test context ${i}`,
        type: 'development',
        tags: ['workload-test', `test-${i}`],
        sessionId: `workload-session-${i}`,
        metadata: {
          aiGenerated: true,
          source: 'workload-test',
          importance: 'medium',
        },
      });
      contextIds.push(contextId);
    }

    // Perform searches
    for (let i = 0; i < searchCount; i++) {
      const searchResult = await app.searchService.search({
        query: `test-${i}`,
        options: { limit: 10 },
      });
      searchResults.push(searchResult);
    }

    return { contextIds, searchResults };
  }
}