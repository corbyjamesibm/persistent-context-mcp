/**
 * MCP Tools Unit Tests
 * Tests all MCP tool implementations in isolation
 */

import { PersistentContextMcpServer } from '../../mcp-server.js';
import { setupTestEnvironment, setupTestData, validateMcpToolResponse } from '../setup/test-environment.js';
import { logger } from '../../utils/logger.js';

describe('MCP Tools Unit Tests', () => {
  let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;
  let mcpServer: PersistentContextMcpServer;
  let testData: Awaited<ReturnType<typeof setupTestData>>;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment({
      enablePerformanceMonitoring: true,
      enableBackups: true,
      testDatabaseSuffix: 'unit_mcp_tools',
    });
    
    testData = await setupTestData(testEnv.app);
    mcpServer = new PersistentContextMcpServer();
    
    logger.info('MCP tools test environment initialized');
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe('Context Management Tools', () => {
    describe('save_context tool', () => {
      test('should save valid context successfully', async () => {
        const response = await mcpServer['handleSaveContext']({
          title: 'MCP Tool Test Context',
          content: 'This context is created via MCP tool testing',
          type: 'development',
          sessionId: 'mcp-tool-test-session',
          tags: ['mcp', 'tool', 'test'],
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.contextId).toBeDefined();
        expect(typeof result.contextId).toBe('string');
        expect(result.validation.isValid).toBe(true);
      });

      test('should handle invalid context data', async () => {
        const response = await mcpServer['handleSaveContext']({
          // Missing required fields
          title: '',
          content: '',
          type: 'invalid-type',
          sessionId: '',
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });

      test('should apply auto-save settings', async () => {
        const response = await mcpServer['handleSaveContext']({
          title: 'Auto-Save Test Context',
          content: 'Testing auto-save functionality',
          type: 'general',
          sessionId: 'auto-save-session',
          tags: ['auto-save'],
          autoSave: true,
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.contextId).toBeDefined();
      });
    });

    describe('search_contexts tool', () => {
      test('should search contexts by query', async () => {
        const response = await mcpServer['handleSearchContexts']({
          query: 'test context',
          options: { limit: 10 },
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.results).toBeInstanceOf(Array);
        expect(result.totalCount).toBeGreaterThanOrEqual(0);
        expect(result.executionTime).toBeGreaterThan(0);
      });

      test('should apply search filters', async () => {
        const response = await mcpServer['handleSearchContexts']({
          query: '',
          filters: {
            type: 'development',
            tags: ['test'],
          },
          options: { limit: 5 },
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.results).toBeInstanceOf(Array);
        
        // Verify filtering worked
        result.results.forEach((item: any) => {
          expect(item.context.type).toBe('development');
        });
      });

      test('should handle date range filters', async () => {
        const endDate = new Date();
        const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);

        const response = await mcpServer['handleSearchContexts']({
          query: '',
          filters: {
            dateRange: {
              start: startDate.toISOString(),
              end: endDate.toISOString(),
            },
          },
          options: { limit: 10 },
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.results).toBeInstanceOf(Array);
      });

      test('should support search options', async () => {
        const response = await mcpServer['handleSearchContexts']({
          query: 'development',
          options: {
            limit: 3,
            offset: 1,
            sortBy: 'date',
            fuzzyMatch: true,
            highlightMatches: true,
          },
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.results.length).toBeLessThanOrEqual(3);
      });
    });

    describe('get_context tool', () => {
      test('should retrieve existing context', async () => {
        const contextId = testData.contexts[0].id;
        
        const response = await mcpServer['handleGetContext']({
          contextId,
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.context).toBeDefined();
        expect(result.context.id).toBe(contextId);
        expect(result.context.title).toBeDefined();
        expect(result.context.content).toBeDefined();
      });

      test('should handle non-existent context', async () => {
        const response = await mcpServer['handleGetContext']({
          contextId: 'non-existent-id',
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(false);
        expect(result.context).toBeNull();
      });
    });
  });

  describe('Template Management Tools', () => {
    describe('generate_template tool', () => {
      test('should generate template from contexts', async () => {
        const contextIds = testData.contexts.slice(0, 2).map(c => c.id);
        
        const response = await mcpServer['handleGenerateTemplate']({
          candidateContextIds: contextIds,
          templateConfig: {
            title: 'MCP Tool Test Template',
            description: 'Template generated via MCP tool',
            type: 'development',
          },
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.templateId).toBeDefined();
        expect(result.template.title).toBe('MCP Tool Test Template');
        expect(result.template.variableCount).toBeGreaterThan(0);
      });

      test('should handle invalid context IDs', async () => {
        const response = await mcpServer['handleGenerateTemplate']({
          candidateContextIds: ['invalid-id-1', 'invalid-id-2'],
          templateConfig: {
            title: 'Invalid Template',
            description: 'Template with invalid contexts',
            type: 'general',
          },
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        // Should handle gracefully, might succeed with empty template or fail appropriately
        expect(typeof result.success).toBe('boolean');
      });
    });

    describe('apply_template tool', () => {
      let templateId: string;

      beforeAll(async () => {
        // Create a template for testing
        const contextIds = testData.contexts.slice(0, 2).map(c => c.id);
        const templateResponse = await mcpServer['handleGenerateTemplate']({
          candidateContextIds: contextIds,
          templateConfig: {
            title: 'Apply Test Template',
            description: 'Template for apply testing',
            type: 'development',
          },
        });

        const templateResult = JSON.parse(templateResponse.content[0].text);
        templateId = templateResult.templateId;
      });

      test('should apply template successfully', async () => {
        const response = await mcpServer['handleApplyTemplate']({
          templateId,
          variableValues: {
            'variable1': 'test-value-1',
            'variable2': 'test-value-2',
          },
          contextConfig: {
            title: 'Applied Template Context',
            sessionId: 'template-apply-session',
            tags: ['template', 'applied'],
          },
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.contextId).toBeDefined();
        expect(result.contextTitle).toBe('Applied Template Context');
      });

      test('should handle invalid template ID', async () => {
        const response = await mcpServer['handleApplyTemplate']({
          templateId: 'invalid-template-id',
          variableValues: {},
          contextConfig: {
            title: 'Invalid Template Test',
            sessionId: 'invalid-session',
          },
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(false);
      });
    });
  });

  describe('Session Management Tools', () => {
    describe('get_recent_sessions tool', () => {
      test('should return recent sessions', async () => {
        const response = await mcpServer['handleGetRecentSessions']({
          limit: 5,
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.sessions).toBeInstanceOf(Array);
        expect(result.sessions.length).toBeLessThanOrEqual(5);
        
        if (result.sessions.length > 0) {
          const session = result.sessions[0];
          expect(session.sessionId).toBeDefined();
          expect(session.lastActivity).toBeDefined();
          expect(session.contextCount).toBeGreaterThanOrEqual(0);
        }
      });

      test('should handle different limits', async () => {
        const limits = [1, 3, 10];
        
        for (const limit of limits) {
          const response = await mcpServer['handleGetRecentSessions']({ limit });
          
          validateMcpToolResponse(response);
          
          const result = JSON.parse(response.content[0].text);
          expect(result.success).toBe(true);
          expect(result.sessions.length).toBeLessThanOrEqual(limit);
        }
      });
    });

    describe('resume_session tool', () => {
      test('should resume existing session', async () => {
        const sessionId = testData.sessions[0];
        
        const response = await mcpServer['handleResumeSession']({
          sessionId,
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        
        if (result.context) {
          expect(result.context.id).toBeDefined();
          expect(result.context.title).toBeDefined();
        }
      });

      test('should handle non-existent session', async () => {
        const response = await mcpServer['handleResumeSession']({
          sessionId: 'non-existent-session',
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(false);
        expect(result.context).toBeNull();
      });
    });
  });

  describe('System Status Tools', () => {
    describe('get_system_status tool', () => {
      test('should return system status', async () => {
        const response = await mcpServer['handleGetSystemStatus']({});

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.health).toBeDefined();
        expect(result.health.database).toBe(true);
        expect(result.health.services).toBe(true);
        expect(result.system).toBeDefined();
        expect(result.search).toBeDefined();
      });
    });

    describe('get_detailed_health_status tool', () => {
      test('should return detailed health information', async () => {
        const response = await mcpServer['handleGetDetailedHealthStatus']({});

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.status).toMatch(/healthy|warning|critical/);
        expect(result.checks).toBeInstanceOf(Array);
        expect(result.checks.length).toBeGreaterThan(0);
        expect(result.summary).toBeDefined();
        expect(result.summary.totalChecks).toBeGreaterThan(0);
      });
    });

    describe('get_health_metrics_history tool', () => {
      test('should return health metrics history', async () => {
        const response = await mcpServer['handleGetHealthMetricsHistory']({
          limit: 10,
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.metricsHistory).toBeInstanceOf(Array);
        expect(result.totalRecords).toBeGreaterThanOrEqual(0);
        expect(result.returnedRecords).toBeLessThanOrEqual(10);
      });
    });
  });

  describe('Backup Management Tools', () => {
    describe('create_backup tool', () => {
      test('should create full backup', async () => {
        const response = await mcpServer['handleCreateBackup']({
          type: 'full',
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.backupId).toBeDefined();
        expect(result.type).toBe('full');
        expect(result.size).toBeGreaterThan(0);
        expect(result.contextCount).toBeGreaterThan(0);
      }, 15000);

      test('should create incremental backup', async () => {
        const response = await mcpServer['handleCreateBackup']({
          type: 'incremental',
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.type).toBe('incremental');
      }, 10000);
    });

    describe('list_backups tool', () => {
      test('should list available backups', async () => {
        const response = await mcpServer['handleListBackups']({});

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.backups).toBeInstanceOf(Array);
        expect(result.totalBackups).toBeGreaterThanOrEqual(0);
        
        if (result.backups.length > 0) {
          const backup = result.backups[0];
          expect(backup.id).toBeDefined();
          expect(backup.timestamp).toBeDefined();
          expect(backup.type).toMatch(/full|incremental/);
          expect(backup.size).toBeGreaterThanOrEqual(0);
        }
      });
    });

    describe('validate_backup tool', () => {
      let backupId: string;

      beforeAll(async () => {
        // Create a backup for validation testing
        const createResponse = await mcpServer['handleCreateBackup']({ type: 'full' });
        const createResult = JSON.parse(createResponse.content[0].text);
        backupId = createResult.backupId;
      });

      test('should validate existing backup', async () => {
        const response = await mcpServer['handleValidateBackup']({
          backupId,
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.backupId).toBe(backupId);
        expect(result.isValid).toBe(true);
        expect(result.issues).toBeInstanceOf(Array);
        expect(result.issues.length).toBe(0);
      });

      test('should handle non-existent backup', async () => {
        const response = await mcpServer['handleValidateBackup']({
          backupId: 'non-existent-backup-id',
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
      });
    });

    describe('get_backup_status tool', () => {
      test('should return backup service status', async () => {
        const response = await mcpServer['handleGetBackupStatus']({});

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.status).toBeDefined();
        expect(result.status.isRunning).toBe(true);
        expect(result.status.backupDirectory).toBeDefined();
        expect(result.status.configuration).toBeDefined();
      });
    });
  });

  describe('Performance Monitoring Tools', () => {
    describe('get_performance_metrics tool', () => {
      test('should return current performance metrics', async () => {
        const response = await mcpServer['handleGetPerformanceMetrics']({});

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.metrics).toBeDefined();
        expect(result.metrics.responseTime).toBeDefined();
        expect(result.metrics.throughput).toBeDefined();
        expect(result.metrics.resources).toBeDefined();
        expect(result.summary).toBeDefined();
      });
    });

    describe('run_load_test tool', () => {
      test('should run load test successfully', async () => {
        const response = await mcpServer['handleRunLoadTest']({
          concurrentUsers: 2,
          duration: 3000,
          rampUpTime: 500,
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.testId).toBeDefined();
        expect(result.results).toBeDefined();
        expect(result.results.totalRequests).toBeGreaterThan(0);
        expect(result.results.successRate).toBeDefined();
      }, 10000);

      test('should validate load test parameters', async () => {
        const response = await mcpServer['handleRunLoadTest']({
          concurrentUsers: 1000, // Exceeds maximum
          duration: 1000, // Too short
          rampUpTime: 500000, // Too long
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        // Should either adjust parameters or fail gracefully
        expect(typeof result.success).toBe('boolean');
      });
    });

    describe('analyze_performance tool', () => {
      test('should analyze performance and provide recommendations', async () => {
        // Generate some performance data first
        for (let i = 0; i < 5; i++) {
          testEnv.app.performanceMonitor.recordOperation('testAnalyze', 100 + i * 50, true);
        }

        const response = await mcpServer['handleAnalyzePerformance']({});

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.analysis).toBeDefined();
        expect(result.recommendations).toBeInstanceOf(Array);
        expect(result.analysis.totalRecommendations).toBe(result.recommendations.length);
      });
    });

    describe('get_performance_history tool', () => {
      test('should return performance history', async () => {
        const response = await mcpServer['handleGetPerformanceHistory']({
          limit: 5,
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.history).toBeInstanceOf(Array);
        expect(result.history.length).toBeLessThanOrEqual(5);
        expect(result.totalRecords).toBeGreaterThanOrEqual(0);
      });
    });

    describe('clear_performance_history tool', () => {
      test('should clear performance history', async () => {
        const response = await mcpServer['handleClearPerformanceHistory']({});

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.message).toBe('Performance history cleared successfully');
        
        // Verify history is actually cleared
        const historyResponse = await mcpServer['handleGetPerformanceHistory']({ limit: 10 });
        const historyResult = JSON.parse(historyResponse.content[0].text);
        expect(historyResult.history.length).toBe(0);
      });
    });
  });

  describe('Session Prompt Tools', () => {
    describe('handle_session_end tool', () => {
      test('should handle session end without prompts', async () => {
        const response = await mcpServer['handleSessionEnd']({
          sessionId: 'simple-session-end',
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(typeof result.promptRequired).toBe('boolean');
      });
    });

    describe('set_session_end_prompts tool', () => {
      test('should enable session end prompts', async () => {
        const response = await mcpServer['handleSetSessionEndPrompts']({
          enabled: true,
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.enabled).toBe(true);
      });

      test('should disable session end prompts', async () => {
        const response = await mcpServer['handleSetSessionEndPrompts']({
          enabled: false,
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.enabled).toBe(false);
      });
    });

    describe('get_sessions_awaiting_prompt tool', () => {
      test('should return sessions awaiting prompts', async () => {
        const response = await mcpServer['handleGetSessionsAwaitingPrompt']({});

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.sessionsAwaitingPrompt).toBeInstanceOf(Array);
        expect(result.count).toBeGreaterThanOrEqual(0);
      });
    });

    describe('save_context_with_prompt tool', () => {
      test('should save context without prompt requirement', async () => {
        const response = await mcpServer['handleSaveContextWithPrompt']({
          title: 'Prompt Test Context',
          content: 'Testing prompt functionality',
          type: 'general',
          sessionId: 'prompt-test-session',
          tags: ['prompt-test'],
          requirePrompt: false,
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.contextId).toBeDefined();
        expect(result.promptRequired).toBe(false);
      });

      test('should save context with prompt requirement', async () => {
        const response = await mcpServer['handleSaveContextWithPrompt']({
          title: 'Prompt Required Context',
          content: 'This context requires user confirmation',
          type: 'analysis',
          sessionId: 'prompt-required-session',
          tags: ['prompt-required'],
          requirePrompt: true,
        });

        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.promptRequired).toBe(true);
        expect(result.contextId).toBeDefined();
      });
    });
  });

  describe('Tool Error Handling', () => {
    test('should handle missing required parameters', async () => {
      const response = await mcpServer['handleSaveContext']({
        // Missing required fields
      });

      validateMcpToolResponse(response);
      
      const result = JSON.parse(response.content[0].text);
      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('should handle invalid parameter types', async () => {
      const response = await mcpServer['handleSearchContexts']({
        query: 123, // Should be string
        options: 'invalid', // Should be object
      });

      validateMcpToolResponse(response);
      
      const result = JSON.parse(response.content[0].text);
      // Should handle gracefully
      expect(typeof result.success).toBe('boolean');
    });

    test('should handle service errors gracefully', async () => {
      // This would test behavior when underlying services throw errors
      // For now, we'll test with extreme parameters that might cause issues
      const response = await mcpServer['handleRunLoadTest']({
        concurrentUsers: -1,
        duration: -1000,
        rampUpTime: -500,
      });

      validateMcpToolResponse(response);
      
      const result = JSON.parse(response.content[0].text);
      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.error).toBeDefined();
      }
    });
  });

  describe('Tool Response Formats', () => {
    test('should return consistent response structure', async () => {
      const tools = [
        () => mcpServer['handleGetSystemStatus']({}),
        () => mcpServer['handleListBackups']({}),
        () => mcpServer['handleGetRecentSessions']({ limit: 5 }),
        () => mcpServer['handleGetPerformanceMetrics']({}),
      ];

      for (const tool of tools) {
        const response = await tool();
        
        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        expect(result).toHaveProperty('success');
        expect(typeof result.success).toBe('boolean');
        
        if (!result.success) {
          expect(result).toHaveProperty('error');
          expect(typeof result.error).toBe('string');
        }
      }
    });

    test('should include appropriate metadata in responses', async () => {
      const response = await mcpServer['handleSearchContexts']({
        query: 'test',
        options: { limit: 5 },
      });

      validateMcpToolResponse(response);
      
      const result = JSON.parse(response.content[0].text);
      expect(result.success).toBe(true);
      expect(result).toHaveProperty('totalCount');
      expect(result).toHaveProperty('executionTime');
      expect(result).toHaveProperty('results');
      
      if (result.results.length > 0) {
        const firstResult = result.results[0];
        expect(firstResult).toHaveProperty('context');
        expect(firstResult).toHaveProperty('score');
        expect(firstResult).toHaveProperty('matchedFields');
      }
    });
  });
});

/**
 * MCP Tools Test Utilities
 */
export class McpToolsTestUtils {
  static async testAllTools(mcpServer: PersistentContextMcpServer): Promise<{
    results: Array<{ tool: string; success: boolean; error?: string }>;
    successRate: number;
  }> {
    const tools = [
      { name: 'save_context', args: {
        title: 'Test Context',
        content: 'Test content',
        type: 'general',
        sessionId: 'test-session',
      }},
      { name: 'search_contexts', args: { query: 'test', options: { limit: 5 } }},
      { name: 'get_recent_sessions', args: { limit: 3 }},
      { name: 'get_system_status', args: {}},
      { name: 'get_detailed_health_status', args: {}},
      { name: 'list_backups', args: {}},
      { name: 'get_performance_metrics', args: {}},
      { name: 'analyze_performance', args: {}},
    ];

    const results = [];
    let successCount = 0;

    for (const tool of tools) {
      try {
        const methodName = `handle${tool.name.split('_').map(word => 
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join('')}`;
        
        const response = await (mcpServer as any)[methodName](tool.args);
        validateMcpToolResponse(response);
        
        const result = JSON.parse(response.content[0].text);
        if (result.success) {
          successCount++;
          results.push({ tool: tool.name, success: true });
        } else {
          results.push({ tool: tool.name, success: false, error: result.error });
        }
      } catch (error) {
        results.push({ 
          tool: tool.name, 
          success: false, 
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      results,
      successRate: (successCount / tools.length) * 100,
    };
  }

  static validateToolResponse(response: any, expectedProperties: string[] = []): void {
    validateMcpToolResponse(response);
    
    const result = JSON.parse(response.content[0].text);
    
    for (const property of expectedProperties) {
      expect(result).toHaveProperty(property);
    }
  }

  static createMockToolArgs(tool: string, overrides: any = {}): any {
    const defaultArgs: Record<string, any> = {
      save_context: {
        title: 'Mock Context',
        content: 'Mock content',
        type: 'general',
        sessionId: 'mock-session',
      },
      search_contexts: {
        query: 'mock',
        options: { limit: 10 },
      },
      get_context: {
        contextId: 'mock-context-id',
      },
      get_recent_sessions: {
        limit: 5,
      },
      resume_session: {
        sessionId: 'mock-session',
      },
      create_backup: {
        type: 'full',
      },
      run_load_test: {
        concurrentUsers: 2,
        duration: 2000,
        rampUpTime: 500,
      },
    };

    return {
      ...defaultArgs[tool],
      ...overrides,
    };
  }
}