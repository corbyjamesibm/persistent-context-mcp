/**
 * End-to-End Complete Workflow Tests
 * Tests the entire application workflow from initialization to shutdown
 */

import request from 'supertest';
import { setupTestEnvironment, setupTestData, waitForCondition, validateMcpToolResponse } from '../setup/test-environment.js';
import { PersistentContextMcpServer } from '../../mcp-server.js';
import { logger } from '../../utils/logger.js';

describe('End-to-End Complete Workflow Tests', () => {
  let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;
  let mcpServer: PersistentContextMcpServer;
  let testData: Awaited<ReturnType<typeof setupTestData>>;

  beforeAll(async () => {
    try {
      // Setup test environment with all features enabled
      testEnv = await setupTestEnvironment({
        enablePerformanceMonitoring: true,
        enableBackups: true,
        testDatabaseSuffix: 'e2e_complete_workflow',
      });
      
      // Setup test data
      testData = await setupTestData(testEnv.app);
      
      // Initialize MCP server
      mcpServer = new PersistentContextMcpServer();
      
      logger.info('End-to-end test environment initialized');
    } catch (error) {
      logger.error('Failed to setup end-to-end test environment:', error);
      throw error;
    }
  }, 30000); // 30 second timeout for setup

  afterAll(async () => {
    try {
      await testEnv.cleanup();
      logger.info('End-to-end test environment cleaned up');
    } catch (error) {
      logger.error('Failed to cleanup end-to-end test environment:', error);
    }
  }, 15000); // 15 second timeout for cleanup

  describe('Complete Application Lifecycle', () => {
    test('should initialize all services successfully', async () => {
      const healthStatus = testEnv.app.getHealthStatus();
      
      expect(healthStatus.database).toBe(true);
      expect(healthStatus.services).toBe(true);
      expect(healthStatus.uptime).toBeGreaterThan(0);
      
      // Verify all services are initialized
      expect(testEnv.app.contextStore).toBeDefined();
      expect(testEnv.app.contextManager).toBeDefined();
      expect(testEnv.app.searchService).toBeDefined();
      expect(testEnv.app.templateGenerator).toBeDefined();
      expect(testEnv.app.healthMonitor).toBeDefined();
      expect(testEnv.app.backupRecovery).toBeDefined();
      expect(testEnv.app.performanceMonitor).toBeDefined();
    });

    test('should provide detailed health status', async () => {
      const detailedHealth = await testEnv.app.getDetailedHealthStatus();
      
      expect(detailedHealth.status).toMatch(/healthy|warning|critical/);
      expect(detailedHealth.checks).toBeInstanceOf(Array);
      expect(detailedHealth.checks.length).toBeGreaterThan(0);
      expect(detailedHealth.metrics).toBeDefined();
      expect(detailedHealth.timestamp).toBeInstanceOf(Date);
      
      // Verify specific health checks are present
      const checkNames = detailedHealth.checks.map((check: any) => check.name);
      expect(checkNames).toContain('database');
      expect(checkNames).toContain('context_manager');
      expect(checkNames).toContain('search_service');
    });
  });

  describe('Context Management Workflow', () => {
    test('should complete full context lifecycle', async () => {
      const sessionId = 'e2e-test-session';
      
      // 1. Save context immediately
      const saveResult = await testEnv.app.contextManager.saveContextImmediate(sessionId, {
        title: 'E2E Test Context',
        content: 'This context is created during end-to-end testing',
        type: 'development',
        tags: ['e2e', 'testing'],
        metadata: {
          aiGenerated: true,
          source: 'e2e-test',
          importance: 'high',
        },
      });
      
      expect(saveResult.success).toBe(true);
      expect(saveResult.contextId).toBeDefined();
      
      // 2. Retrieve the saved context
      const savedContext = await testEnv.app.contextStore.getContext(saveResult.contextId!);
      expect(savedContext).toBeDefined();
      expect(savedContext?.title).toBe('E2E Test Context');
      expect(savedContext?.sessionId).toBe(sessionId);
      
      // 3. Search for the context
      const searchResults = await testEnv.app.searchService.search({
        query: 'E2E Test Context',
        options: { limit: 10 },
      });
      
      expect(searchResults.results.length).toBeGreaterThan(0);
      const foundContext = searchResults.results.find(r => r.context.id === saveResult.contextId);
      expect(foundContext).toBeDefined();
      
      // 4. Update the context
      const updatedContext = await testEnv.app.contextStore.updateContext(saveResult.contextId!, {
        content: 'Updated content during E2E testing',
        tags: ['e2e', 'testing', 'updated'],
      });
      
      expect(updatedContext).toBeDefined();
      expect(updatedContext?.content).toBe('Updated content during E2E testing');
      expect(updatedContext?.tags).toContain('updated');
      
      // 5. Get recent sessions
      const recentSessions = await testEnv.app.contextManager.getRecentSessions(10);
      expect(recentSessions.length).toBeGreaterThan(0);
      const testSession = recentSessions.find(s => s.sessionId === sessionId);
      expect(testSession).toBeDefined();
      
      // 6. Resume session
      const resumedContext = await testEnv.app.contextManager.resumeSession(sessionId);
      expect(resumedContext).toBeDefined();
      expect(resumedContext?.id).toBe(saveResult.contextId);
    });

    test('should handle session end prompts workflow', async () => {
      const sessionId = 'e2e-prompt-session';
      
      // Enable session end prompts
      testEnv.app.contextManager.setSessionEndPrompts(true);
      
      // Save context with prompt requirement
      const saveResult = await testEnv.app.contextManager.saveContextWithPrompt(
        sessionId,
        {
          title: 'Prompt Test Context',
          content: 'This context requires user confirmation',
          type: 'analysis',
          tags: ['prompt-test'],
          metadata: {
            aiGenerated: false,
            source: 'user',
            importance: 'medium',
          },
        },
        true // require prompt
      );
      
      expect(saveResult.promptRequired).toBe(true);
      expect(saveResult.contextId).toBeDefined();
      
      // Handle session end
      const sessionEndResult = await testEnv.app.contextManager.handleSessionEnd(sessionId);
      expect(sessionEndResult.promptRequired).toBe(true);
      
      // Get sessions awaiting prompt
      const awaitingSessions = testEnv.app.contextManager.getSessionsAwaitingPrompt();
      expect(awaitingSessions.some(s => s.sessionId === sessionId)).toBe(true);
      
      // Respond to save prompt
      const responseResult = testEnv.app.contextManager.respondToSavePrompt(sessionId, true);
      expect(responseResult).toBe(true);
      
      // Verify session is no longer awaiting prompt
      const updatedAwaitingSessions = testEnv.app.contextManager.getSessionsAwaitingPrompt();
      expect(updatedAwaitingSessions.some(s => s.sessionId === sessionId)).toBe(false);
    });
  });

  describe('Template Generation Workflow', () => {
    test('should complete template lifecycle', async () => {
      // Use existing test data contexts
      const sourceContextIds = testData.contexts.slice(0, 3).map(c => c.id);
      
      // Generate template
      const templateConfig = {
        title: 'E2E Test Template',
        description: 'Template generated during end-to-end testing',
        type: 'development',
      };
      
      const template = await testEnv.app.templateGenerator.generateTemplate(
        sourceContextIds,
        templateConfig
      );
      
      expect(template.id).toBeDefined();
      expect(template.title).toBe('E2E Test Template');
      expect(template.variables.length).toBeGreaterThan(0);
      
      // Apply template
      const variableValues = template.variables.reduce((acc, variable) => {
        acc[variable.name] = `test-value-${variable.name}`;
        return acc;
      }, {} as Record<string, string>);
      
      const contextConfig = {
        title: 'Applied Template Context',
        sessionId: 'e2e-template-session',
        tags: ['template-applied', 'e2e'],
      };
      
      const appliedContextId = await testEnv.app.templateGenerator.applyTemplate(
        template.id,
        variableValues,
        contextConfig
      );
      
      expect(appliedContextId).toBeDefined();
      
      // Verify applied context
      const appliedContext = await testEnv.app.contextStore.getContext(appliedContextId);
      expect(appliedContext).toBeDefined();
      expect(appliedContext?.title).toBe('Applied Template Context');
      expect(appliedContext?.tags).toContain('template-applied');
    });
  });

  describe('Health Monitoring Workflow', () => {
    test('should monitor system health continuously', async () => {
      // Get initial health metrics
      const initialMetrics = await testEnv.app.healthMonitor.getSystemMetrics();
      expect(initialMetrics.memory).toBeDefined();
      expect(initialMetrics.database.connected).toBe(true);
      
      // Perform health check
      const healthCheck = await testEnv.app.healthMonitor.performHealthCheck();
      expect(healthCheck.status).toMatch(/healthy|warning|critical/);
      expect(healthCheck.checks.length).toBeGreaterThan(0);
      
      // Get health summary
      const healthSummary = await testEnv.app.healthMonitor.getHealthSummary();
      expect(healthSummary.status).toMatch(/healthy|warning|critical/);
      expect(healthSummary.metrics).toBeDefined();
      
      // Record some requests for metrics
      testEnv.app.healthMonitor.recordRequest();
      testEnv.app.healthMonitor.recordRequest();
      testEnv.app.healthMonitor.recordError();
      
      const updatedMetrics = await testEnv.app.healthMonitor.getSystemMetrics();
      expect(updatedMetrics.requests.total).toBeGreaterThanOrEqual(2);
      expect(updatedMetrics.requests.errors).toBeGreaterThanOrEqual(1);
    });

    test('should provide metrics history', () => {
      const history = testEnv.app.healthMonitor.getMetricsHistory();
      expect(Array.isArray(history)).toBe(true);
      
      if (history.length > 0) {
        const latestMetrics = history[history.length - 1];
        expect(latestMetrics.memory).toBeDefined();
        expect(latestMetrics.database).toBeDefined();
        expect(latestMetrics.services).toBeDefined();
      }
    });
  });

  describe('Backup and Recovery Workflow', () => {
    test('should complete backup and recovery cycle', async () => {
      // Create a backup
      const backupResult = await testEnv.app.backupRecovery.createBackup('full');
      
      expect(backupResult.success).toBe(true);
      expect(backupResult.backupId).toBeDefined();
      expect(backupResult.size).toBeGreaterThan(0);
      expect(backupResult.metadata.contextCount).toBeGreaterThan(0);
      
      // List backups
      const backups = await testEnv.app.backupRecovery.listBackups();
      expect(backups.length).toBeGreaterThan(0);
      const ourBackup = backups.find(b => b.id === backupResult.backupId);
      expect(ourBackup).toBeDefined();
      
      // Validate backup
      const validation = await testEnv.app.backupRecovery.validateBackup(backupResult.backupId);
      expect(validation.isValid).toBe(true);
      expect(validation.issues.length).toBe(0);
      
      // Create a new context to test restoration
      const testContextId = await testEnv.app.contextStore.saveContext({
        title: 'Context for Restore Test',
        content: 'This context will be restored from backup',
        type: 'general',
        tags: ['restore-test'],
        sessionId: 'restore-test-session',
        metadata: {
          aiGenerated: false,
          source: 'restore-test',
          importance: 'low',
        },
      });
      
      // Delete the context to simulate data loss
      await testEnv.app.contextStore.deleteContext(testContextId);
      
      // Restore from backup
      const restoreResult = await testEnv.app.backupRecovery.restoreFromBackup(
        backupResult.backupId,
        { validateChecksum: true, overwriteExisting: true }
      );
      
      expect(restoreResult.success).toBe(true);
      expect(restoreResult.restoredContexts).toBeGreaterThan(0);
      
      // Get backup status
      const status = testEnv.app.backupRecovery.getStatus();
      expect(status.isRunning).toBe(true);
      expect(status.backupDirectory).toBeDefined();
      expect(status.config).toBeDefined();
    }, 20000); // 20 second timeout for backup operations
  });

  describe('Performance Monitoring Workflow', () => {
    test('should monitor and analyze performance', async () => {
      // Get current performance metrics
      const metrics = await testEnv.app.performanceMonitor.getCurrentMetrics();
      
      expect(metrics.timestamp).toBeInstanceOf(Date);
      expect(metrics.responseTime).toBeDefined();
      expect(metrics.throughput).toBeDefined();
      expect(metrics.resources).toBeDefined();
      expect(metrics.operations).toBeDefined();
      
      // Record some operations for testing
      testEnv.app.performanceMonitor.recordOperation('testOperation', 150, true);
      testEnv.app.performanceMonitor.recordOperation('testOperation', 300, false);
      testEnv.app.performanceMonitor.recordOperation('slowOperation', 6000, true);
      
      // Analyze performance
      const recommendations = await testEnv.app.performanceMonitor.analyzePerformance();
      expect(Array.isArray(recommendations)).toBe(true);
      
      // Get performance history
      const history = testEnv.app.performanceMonitor.getMetricsHistory(10);
      expect(Array.isArray(history)).toBe(true);
      
      // Clear history
      testEnv.app.performanceMonitor.clearHistory();
      const clearedHistory = testEnv.app.performanceMonitor.getMetricsHistory();
      expect(clearedHistory.length).toBe(0);
    });

    test('should run load test successfully', async () => {
      const loadTestResult = await testEnv.app.performanceMonitor.runLoadTest({
        concurrentUsers: 3,
        duration: 3000, // 3 seconds
        rampUpTime: 500, // 0.5 second ramp up
      });
      
      expect(loadTestResult.success).toBe(true);
      expect(loadTestResult.testId).toBeDefined();
      expect(loadTestResult.totalRequests).toBeGreaterThan(0);
      expect(loadTestResult.averageResponseTime).toBeGreaterThan(0);
      expect(loadTestResult.requestsPerSecond).toBeGreaterThan(0);
      expect(loadTestResult.metrics.length).toBeGreaterThan(0);
    }, 10000); // 10 second timeout for load test
  });

  describe('HTTP API Integration', () => {
    test('should handle context API endpoints', async () => {
      const app = testEnv.server;
      
      // Create context via API
      const createResponse = await request(app)
        .post('/api/v1/contexts')
        .send({
          title: 'API Test Context',
          content: 'Created via HTTP API',
          type: 'development',
          tags: ['api-test'],
          sessionId: 'api-test-session',
          metadata: {
            aiGenerated: false,
            source: 'http-api',
            importance: 'medium',
          },
        })
        .expect(201);
      
      expect(createResponse.body.data).toBeDefined();
      expect(createResponse.body.data.title).toBe('API Test Context');
      
      const contextId = createResponse.body.data.id;
      
      // Get context via API
      const getResponse = await request(app)
        .get(`/api/v1/contexts/${contextId}`)
        .expect(200);
      
      expect(getResponse.body.data.id).toBe(contextId);
      expect(getResponse.body.data.title).toBe('API Test Context');
      
      // Update context via API
      const updateResponse = await request(app)
        .put(`/api/v1/contexts/${contextId}`)
        .send({
          content: 'Updated via HTTP API',
          tags: ['api-test', 'updated'],
        })
        .expect(200);
      
      expect(updateResponse.body.data.content).toBe('Updated via HTTP API');
      expect(updateResponse.body.data.tags).toContain('updated');
      
      // Search contexts via API
      const searchResponse = await request(app)
        .get('/api/v1/contexts')
        .query({ q: 'API Test Context' })
        .expect(200);
      
      expect(searchResponse.body.data.length).toBeGreaterThan(0);
      const foundContext = searchResponse.body.data.find((c: any) => c.id === contextId);
      expect(foundContext).toBeDefined();
    });

    test('should handle health endpoints', async () => {
      const app = testEnv.server;
      
      // Basic health check
      const healthResponse = await request(app)
        .get('/health')
        .expect(200);
      
      expect(healthResponse.body.status).toBe('healthy');
      expect(healthResponse.body.timestamp).toBeDefined();
      
      // Detailed health status
      const detailedHealthResponse = await request(app)
        .get('/health/detailed')
        .expect(200);
      
      expect(detailedHealthResponse.body.status).toMatch(/healthy|warning|critical/);
      expect(detailedHealthResponse.body.checks).toBeInstanceOf(Array);
      
      // Readiness check
      const readinessResponse = await request(app)
        .get('/health/ready')
        .expect(200);
      
      expect(readinessResponse.body.ready).toBe(true);
      
      // Liveness check
      const livenessResponse = await request(app)
        .get('/health/live')
        .expect(200);
      
      expect(livenessResponse.body.alive).toBe(true);
    });

    test('should handle performance endpoints', async () => {
      const app = testEnv.server;
      
      // Get performance metrics
      const metricsResponse = await request(app)
        .get('/performance/metrics')
        .expect(200);
      
      expect(metricsResponse.body.success).toBe(true);
      expect(metricsResponse.body.data.responseTime).toBeDefined();
      expect(metricsResponse.body.data.throughput).toBeDefined();
      
      // Get performance status
      const statusResponse = await request(app)
        .get('/performance/status')
        .expect(200);
      
      expect(statusResponse.body.success).toBe(true);
      expect(statusResponse.body.data.monitoring).toBeDefined();
      expect(statusResponse.body.data.currentStatus).toBeDefined();
      
      // Analyze performance
      const analyzeResponse = await request(app)
        .get('/performance/analyze')
        .expect(200);
      
      expect(analyzeResponse.body.success).toBe(true);
      expect(analyzeResponse.body.data.analysis).toBeDefined();
      expect(analyzeResponse.body.data.recommendations).toBeInstanceOf(Array);
      
      // Run small load test via API
      const loadTestResponse = await request(app)
        .post('/performance/load-test')
        .send({
          concurrentUsers: 2,
          duration: 2000,
          rampUpTime: 500,
        })
        .expect(200);
      
      expect(loadTestResponse.body.success).toBe(true);
      expect(loadTestResponse.body.data.testId).toBeDefined();
      expect(loadTestResponse.body.data.results).toBeDefined();
    }, 15000); // 15 second timeout for load test
  });

  describe('MCP Server Integration', () => {
    test('should handle all MCP tools', async () => {
      const mockRequest = (toolName: string, args: any) => ({
        params: { name: toolName, arguments: args },
      });
      
      // Test save_context tool
      const saveContextResponse = await mcpServer['handleSaveContext']({
        title: 'MCP Test Context',
        content: 'Created via MCP tool',
        type: 'development',
        sessionId: 'mcp-test-session',
        tags: ['mcp-test'],
      });
      
      validateMcpToolResponse(saveContextResponse);
      const saveResult = JSON.parse(saveContextResponse.content[0].text);
      expect(saveResult.success).toBe(true);
      expect(saveResult.contextId).toBeDefined();
      
      // Test search_contexts tool
      const searchContextsResponse = await mcpServer['handleSearchContexts']({
        query: 'MCP Test',
        options: { limit: 10 },
      });
      
      validateMcpToolResponse(searchContextsResponse);
      const searchResult = JSON.parse(searchContextsResponse.content[0].text);
      expect(searchResult.success).toBe(true);
      expect(searchResult.results).toBeInstanceOf(Array);
      
      // Test get_context tool
      const getContextResponse = await mcpServer['handleGetContext']({
        contextId: saveResult.contextId,
      });
      
      validateMcpToolResponse(getContextResponse);
      const getResult = JSON.parse(getContextResponse.content[0].text);
      expect(getResult.success).toBe(true);
      expect(getResult.context.id).toBe(saveResult.contextId);
      
      // Test get_system_status tool
      const systemStatusResponse = await mcpServer['handleGetSystemStatus']({});
      
      validateMcpToolResponse(systemStatusResponse);
      const statusResult = JSON.parse(systemStatusResponse.content[0].text);
      expect(statusResult.success).toBe(true);
      expect(statusResult.health).toBeDefined();
      expect(statusResult.system).toBeDefined();
      
      // Test performance tools
      const performanceMetricsResponse = await mcpServer['handleGetPerformanceMetrics']({});
      
      validateMcpToolResponse(performanceMetricsResponse);
      const metricsResult = JSON.parse(performanceMetricsResponse.content[0].text);
      expect(metricsResult.success).toBe(true);
      expect(metricsResult.metrics).toBeDefined();
      
      // Test backup tools
      const createBackupResponse = await mcpServer['handleCreateBackup']({ type: 'full' });
      
      validateMcpToolResponse(createBackupResponse);
      const backupResult = JSON.parse(createBackupResponse.content[0].text);
      expect(backupResult.success).toBe(true);
      expect(backupResult.backupId).toBeDefined();
      
      const listBackupsResponse = await mcpServer['handleListBackups']({});
      
      validateMcpToolResponse(listBackupsResponse);
      const listResult = JSON.parse(listBackupsResponse.content[0].text);
      expect(listResult.success).toBe(true);
      expect(listResult.backups).toBeInstanceOf(Array);
    }, 30000); // 30 second timeout for all MCP tools
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle invalid context data gracefully', async () => {
      // Test with missing required fields
      const invalidSaveResult = await testEnv.app.contextManager.saveContextImmediate('invalid-session', {
        // Missing title and content
        type: 'development',
        tags: [],
        metadata: {},
      } as any);
      
      expect(invalidSaveResult.success).toBe(false);
      expect(invalidSaveResult.error).toBeDefined();
    });

    test('should handle non-existent context queries', async () => {
      const nonExistentContext = await testEnv.app.contextStore.getContext('non-existent-id');
      expect(nonExistentContext).toBeNull();
      
      const updateResult = await testEnv.app.contextStore.updateContext('non-existent-id', {
        title: 'Updated Title',
      });
      expect(updateResult).toBeNull();
    });

    test('should handle search with invalid parameters', async () => {
      const searchResult = await testEnv.app.searchService.search({
        query: '', // Empty query
        options: { limit: -1 }, // Invalid limit
      });
      
      expect(searchResult.results).toBeInstanceOf(Array);
      expect(searchResult.totalCount).toBeGreaterThanOrEqual(0);
    });

    test('should handle concurrent operations safely', async () => {
      const sessionId = 'concurrent-test-session';
      const promises = [];
      
      // Create multiple concurrent save operations
      for (let i = 0; i < 5; i++) {
        promises.push(
          testEnv.app.contextManager.saveContextImmediate(sessionId, {
            title: `Concurrent Context ${i}`,
            content: `Content for concurrent context ${i}`,
            type: 'development',
            tags: ['concurrent', `test-${i}`],
            metadata: {
              aiGenerated: true,
              source: 'concurrent-test',
              importance: 'low',
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
      
      // Verify all contexts were saved
      const sessionContexts = await testEnv.app.contextManager.getSessionContexts(sessionId, 10);
      expect(sessionContexts.length).toBe(5);
    });
  });

  describe('Performance Under Load', () => {
    test('should maintain performance under moderate load', async () => {
      const startTime = Date.now();
      const operations = [];
      
      // Perform 20 concurrent operations
      for (let i = 0; i < 20; i++) {
        operations.push(
          testEnv.app.contextStore.saveContext({
            title: `Load Test Context ${i}`,
            content: `Content for load test context ${i}`,
            type: 'development',
            tags: ['load-test'],
            sessionId: `load-test-session-${i}`,
            metadata: {
              aiGenerated: true,
              source: 'load-test',
              importance: 'low',
            },
          })
        );
      }
      
      const contextIds = await Promise.all(operations);
      const endTime = Date.now();
      
      expect(contextIds.length).toBe(20);
      expect(endTime - startTime).toBeLessThan(10000); // Should complete within 10 seconds
      
      // Verify all contexts are searchable
      const searchResult = await testEnv.app.searchService.search({
        query: 'Load Test Context',
        options: { limit: 25 },
      });
      
      expect(searchResult.results.length).toBeGreaterThanOrEqual(20);
    }, 15000); // 15 second timeout
  });
});

/**
 * Test helpers for end-to-end testing
 */
export class E2ETestHelpers {
  static async createTestSession(app: any, sessionId: string, contextCount: number = 3): Promise<string[]> {
    const contextIds: string[] = [];
    
    for (let i = 0; i < contextCount; i++) {
      const result = await app.contextManager.saveContextImmediate(sessionId, {
        title: `Test Context ${i + 1}`,
        content: `Content for test context ${i + 1}`,
        type: 'development',
        tags: ['test', `context-${i + 1}`],
        metadata: {
          aiGenerated: true,
          source: 'e2e-helper',
          importance: 'medium',
        },
      });
      
      if (result.success && result.contextId) {
        contextIds.push(result.contextId);
      }
    }
    
    return contextIds;
  }
  
  static async waitForServices(app: any, timeout: number = 10000): Promise<void> {
    await waitForCondition(
      async () => {
        const health = app.getHealthStatus();
        return health.database && health.services;
      },
      timeout
    );
  }
  
  static validatePerformanceMetrics(metrics: any): void {
    expect(metrics.responseTime).toBeDefined();
    expect(metrics.responseTime.average).toBeGreaterThanOrEqual(0);
    expect(metrics.responseTime.p95).toBeGreaterThanOrEqual(metrics.responseTime.average);
    expect(metrics.resources.memoryUsage).toBeGreaterThan(0);
    expect(metrics.resources.memoryUsage).toBeLessThan(100);
    expect(metrics.throughput.requestsPerSecond).toBeGreaterThanOrEqual(0);
  }
}