/**
 * Session End Prompts Validation Tests
 * Comprehensive testing of session prompt functionality including:
 * - Session end detection and prompt triggering
 * - User response handling (save/discard)
 * - Timeout behavior
 * - Integration with auto-save service
 * - MCP tool interfaces
 */

import { setupTestEnvironment, setupTestData, waitForCondition } from '../setup/test-environment.js';
import { PersistentContextMcpServer } from '../../mcp-server.js';
import { logger } from '../../utils/logger.js';

describe('Session End Prompts Validation', () => {
  let testEnv: any;
  let mcpServer: PersistentContextMcpServer;
  let testData: any;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment({
      enablePerformanceMonitoring: true,
      enableBackups: true,
      testDatabaseSuffix: 'session_prompts_validation',
    });
    
    testData = await setupTestData(testEnv.app);
    mcpServer = new PersistentContextMcpServer();
    
    logger.info('Session prompts validation test environment initialized');
  }, 30000);

  afterAll(async () => {
    await testEnv.cleanup();
  }, 15000);

  describe('Session End Prompt Configuration', () => {
    test('should enable session end prompts via MCP tool', async () => {
      const response = await mcpServer['handleSetSessionEndPrompts']({
        enabled: true,
      });

      expect(response.content[0].text).toBeDefined();
      const result = JSON.parse(response.content[0].text);
      
      expect(result.success).toBe(true);
      expect(result.enabled).toBe(true);
      expect(result.message).toContain('enabled');

      // Verify configuration was applied
      const systemStatus = testEnv.app.contextManager.getSystemStatus();
      expect(systemStatus.sessionEndPromptsEnabled).toBe(true);
    });

    test('should disable session end prompts via MCP tool', async () => {
      const response = await mcpServer['handleSetSessionEndPrompts']({
        enabled: false,
      });

      const result = JSON.parse(response.content[0].text);
      
      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false);
      expect(result.message).toContain('disabled');

      // Verify configuration was applied
      const systemStatus = testEnv.app.contextManager.getSystemStatus();
      expect(systemStatus.sessionEndPromptsEnabled).toBe(false);
    });

    test('should persist session end prompt configuration', async () => {
      // Enable prompts
      await mcpServer['handleSetSessionEndPrompts']({ enabled: true });
      
      // Create some activity to test persistence
      await testEnv.app.contextManager.saveContextImmediate('persistence-test-session', {
        title: 'Persistence Test Context',
        content: 'Testing configuration persistence',
        type: 'general',
        tags: ['persistence-test'],
        metadata: {
          aiGenerated: true,
          source: 'persistence-test',
          importance: 'low',
        },
      });

      // Configuration should remain enabled
      const systemStatus = testEnv.app.contextManager.getSystemStatus();
      expect(systemStatus.sessionEndPromptsEnabled).toBe(true);
    });
  });

  describe('Session End Detection and Prompt Triggering', () => {
    beforeEach(async () => {
      // Enable session end prompts for these tests
      await mcpServer['handleSetSessionEndPrompts']({ enabled: true });
    });

    test('should detect session end without pending changes', async () => {
      const sessionId = 'no-pending-changes-session';
      
      const response = await mcpServer['handleSessionEnd']({
        sessionId,
      });

      const result = JSON.parse(response.content[0].text);
      
      expect(result.success).toBe(true);
      expect(result.promptRequired).toBe(false);
      expect(result.message).toContain('No prompt required');
    });

    test('should detect session end with pending changes and trigger prompt', async () => {
      const sessionId = 'pending-changes-session';
      
      // Create a context that requires a prompt
      const saveResponse = await mcpServer['handleSaveContextWithPrompt']({
        sessionId,
        title: 'Prompt Required Context',
        content: 'This context requires user confirmation',
        type: 'analysis',
        tags: ['prompt-test'],
        requirePrompt: true,
      });

      const saveResult = JSON.parse(saveResponse.content[0].text);
      expect(saveResult.promptRequired).toBe(true);

      // Now end the session
      const sessionEndResponse = await mcpServer['handleSessionEnd']({
        sessionId,
      });

      const sessionEndResult = JSON.parse(sessionEndResponse.content[0].text);
      
      expect(sessionEndResult.success).toBe(true);
      expect(sessionEndResult.promptRequired).toBe(true);
      expect(sessionEndResult.contextDetails).toBeDefined();
      expect(sessionEndResult.contextDetails.sessionId).toBe(sessionId);
      expect(sessionEndResult.message).toContain('Save prompt required');
    });

    test('should track sessions awaiting prompts', async () => {
      const sessionIds = ['prompt-session-1', 'prompt-session-2', 'prompt-session-3'];
      
      // Create multiple contexts requiring prompts
      for (const sessionId of sessionIds) {
        await mcpServer['handleSaveContextWithPrompt']({
          sessionId,
          title: `Prompt Context for ${sessionId}`,
          content: `Content requiring prompt for ${sessionId}`,
          type: 'general',
          tags: ['multi-prompt-test'],
          requirePrompt: true,
        });
      }

      // Check sessions awaiting prompts
      const response = await mcpServer['handleGetSessionsAwaitingPrompt']({});
      const result = JSON.parse(response.content[0].text);
      
      expect(result.success).toBe(true);
      expect(result.count).toBeGreaterThanOrEqual(3);
      expect(result.sessionsAwaitingPrompt).toEqual(
        expect.arrayContaining(sessionIds)
      );
      expect(result.message).toContain('sessions awaiting save prompts');
    });

    test('should handle multiple concurrent session ends', async () => {
      const sessionIds = ['concurrent-1', 'concurrent-2', 'concurrent-3'];
      
      // Create contexts requiring prompts for all sessions
      const savePromises = sessionIds.map(sessionId =>
        mcpServer['handleSaveContextWithPrompt']({
          sessionId,
          title: `Concurrent Context ${sessionId}`,
          content: `Content for concurrent session ${sessionId}`,
          type: 'development',
          tags: ['concurrent-test'],
          requirePrompt: true,
        })
      );

      await Promise.all(savePromises);

      // End all sessions concurrently
      const sessionEndPromises = sessionIds.map(sessionId =>
        mcpServer['handleSessionEnd']({ sessionId })
      );

      const responses = await Promise.all(sessionEndPromises);

      // All should trigger prompts
      responses.forEach((response, index) => {
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.promptRequired).toBe(true);
        expect(result.contextDetails.sessionId).toBe(sessionIds[index]);
      });
    });
  });

  describe('User Response Handling', () => {
    beforeEach(async () => {
      await mcpServer['handleSetSessionEndPrompts']({ enabled: true });
    });

    test('should handle user choosing to save context', async () => {
      const sessionId = 'save-response-session';
      
      // Create context requiring prompt
      await mcpServer['handleSaveContextWithPrompt']({
        sessionId,
        title: 'Save Response Test',
        content: 'User will choose to save this',
        type: 'general',
        tags: ['save-response-test'],
        requirePrompt: true,
      });

      // User responds with save = true
      const response = await mcpServer['handleRespondToSavePrompt']({
        sessionId,
        shouldSave: true,
      });

      const result = JSON.parse(response.content[0].text);
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionId);
      expect(result.response).toBe('save');
      expect(result.message).toContain('will save');

      // Wait for auto-save to process the response
      await waitForCondition(async () => {
        const systemStatus = testEnv.app.contextManager.getSystemStatus();
        return systemStatus.sessionsAwaitingPrompt === 0;
      }, 10000);

      // Verify context was saved
      const contexts = await testEnv.app.contextStore.searchContexts('Save Response Test');
      expect(contexts.length).toBeGreaterThan(0);
      const savedContext = contexts.find(c => c.title === 'Save Response Test');
      expect(savedContext).toBeDefined();
    });

    test('should handle user choosing to discard context', async () => {
      const sessionId = 'discard-response-session';
      
      // Create context requiring prompt
      await mcpServer['handleSaveContextWithPrompt']({
        sessionId,
        title: 'Discard Response Test',
        content: 'User will choose to discard this',
        type: 'general',
        tags: ['discard-response-test'],
        requirePrompt: true,
      });

      // User responds with save = false (discard)
      const response = await mcpServer['handleRespondToSavePrompt']({
        sessionId,
        shouldSave: false,
      });

      const result = JSON.parse(response.content[0].text);
      
      expect(result.success).toBe(true);
      expect(result.sessionId).toBe(sessionId);
      expect(result.response).toBe('discard');
      expect(result.message).toContain('will discard');

      // Wait a bit to ensure no save occurs
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify context was not saved
      const contexts = await testEnv.app.contextStore.searchContexts('Discard Response Test');
      const discardedContext = contexts.find(c => c.title === 'Discard Response Test');
      expect(discardedContext).toBeUndefined();

      // Session should no longer be awaiting prompt
      const promptsResponse = await mcpServer['handleGetSessionsAwaitingPrompt']({});
      const promptsResult = JSON.parse(promptsResponse.content[0].text);
      expect(promptsResult.sessionsAwaitingPrompt).not.toContain(sessionId);
    });

    test('should handle response to non-existent prompt', async () => {
      const response = await mcpServer['handleRespondToSavePrompt']({
        sessionId: 'non-existent-session',
        shouldSave: true,
      });

      const result = JSON.parse(response.content[0].text);
      
      expect(result.success).toBe(false);
      expect(result.message).toContain('No prompt found');
    });

    test('should handle multiple responses from same session', async () => {
      const sessionId = 'multiple-response-session';
      
      // Create context requiring prompt
      await mcpServer['handleSaveContextWithPrompt']({
        sessionId,
        title: 'Multiple Response Test',
        content: 'Testing multiple responses',
        type: 'general',
        tags: ['multiple-response-test'],
        requirePrompt: true,
      });

      // First response - save
      const firstResponse = await mcpServer['handleRespondToSavePrompt']({
        sessionId,
        shouldSave: true,
      });

      const firstResult = JSON.parse(firstResponse.content[0].text);
      expect(firstResult.success).toBe(true);

      // Second response should fail (no longer awaiting prompt)
      const secondResponse = await mcpServer['handleRespondToSavePrompt']({
        sessionId,
        shouldSave: false,
      });

      const secondResult = JSON.parse(secondResponse.content[0].text);
      expect(secondResult.success).toBe(false);
      expect(secondResult.message).toContain('No prompt found');
    });
  });

  describe('Timeout Behavior', () => {
    beforeEach(async () => {
      await mcpServer['handleSetSessionEndPrompts']({ enabled: true });
    });

    test('should handle prompt timeout with default save behavior', async () => {
      const sessionId = 'timeout-test-session';
      
      // Create context requiring prompt
      await mcpServer['handleSaveContextWithPrompt']({
        sessionId,
        title: 'Timeout Test Context',
        content: 'This context will timeout and default to save',
        type: 'general',
        tags: ['timeout-test'],
        requirePrompt: true,
      });

      // Don't respond to prompt, let it timeout
      // Note: In real implementation, timeout might be 30 seconds
      // For testing, we'll trigger the timeout mechanism
      
      // Simulate timeout by triggering auto-save cycle after timeout period
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Force auto-save service to process timeouts
      const autoSaveService = testEnv.app.contextManager.getAutoSaveService();
      await autoSaveService['handlePromptTimeouts']();

      // Wait for save processing
      await waitForCondition(async () => {
        const systemStatus = testEnv.app.contextManager.getSystemStatus();
        return systemStatus.sessionsAwaitingPrompt === 0;
      }, 5000);

      // Verify context was saved (default behavior)
      const contexts = await testEnv.app.contextStore.searchContexts('Timeout Test Context');
      expect(contexts.length).toBeGreaterThan(0);
      const timeoutContext = contexts.find(c => c.title === 'Timeout Test Context');
      expect(timeoutContext).toBeDefined();
    });

    test('should emit timeout events for monitoring', (done) => {
      const sessionId = 'timeout-event-session';
      let timeoutEventReceived = false;

      // Listen for timeout event
      testEnv.app.contextManager.once('promptTimeout', ({ sessionIds }) => {
        expect(sessionIds).toContain(sessionId);
        timeoutEventReceived = true;
        done();
      });

      // Create context and simulate timeout
      mcpServer['handleSaveContextWithPrompt']({
        sessionId,
        title: 'Timeout Event Test',
        content: 'Testing timeout event emission',
        type: 'general',
        tags: ['timeout-event-test'],
        requirePrompt: true,
      }).then(() => {
        // Simulate timeout after short delay
        setTimeout(() => {
          const autoSaveService = testEnv.app.contextManager.getAutoSaveService();
          autoSaveService['handlePromptTimeouts']();
        }, 100);
      });

      // Failsafe timeout
      setTimeout(() => {
        if (!timeoutEventReceived) {
          done(new Error('Timeout event not received'));
        }
      }, 5000);
    });
  });

  describe('Integration with Auto-Save Service', () => {
    beforeEach(async () => {
      await mcpServer['handleSetSessionEndPrompts']({ enabled: true });
    });

    test('should integrate with auto-save cycle', async () => {
      const sessionId = 'autosave-integration-session';
      
      // Create context requiring prompt
      await mcpServer['handleSaveContextWithPrompt']({
        sessionId,
        title: 'Auto-Save Integration Test',
        content: 'Testing integration with auto-save service',
        type: 'development',
        tags: ['autosave-integration-test'],
        requirePrompt: true,
      });

      // Respond to save the context
      await mcpServer['handleRespondToSavePrompt']({
        sessionId,
        shouldSave: true,
      });

      // Wait for auto-save cycle to process
      await waitForCondition(async () => {
        const systemStatus = testEnv.app.contextManager.getSystemStatus();
        return systemStatus.pendingContexts === 0;
      }, 10000);

      // Verify context was saved through auto-save
      const contexts = await testEnv.app.contextStore.searchContexts('Auto-Save Integration Test');
      expect(contexts.length).toBeGreaterThan(0);
      const savedContext = contexts.find(c => c.title === 'Auto-Save Integration Test');
      expect(savedContext).toBeDefined();
      expect(savedContext?.metadata?.source).toBe('mcp-tool-with-prompt');
    });

    test('should handle auto-save service events properly', (done) => {
      const sessionId = 'autosave-events-session';
      let eventCount = 0;
      const expectedEvents = 2; // contextSaved and saveSuccess

      // Listen for save events
      testEnv.app.contextManager.on('contextSaved', ({ sessionId: eventSessionId }) => {
        if (eventSessionId === sessionId) {
          eventCount++;
          if (eventCount === expectedEvents) done();
        }
      });

      testEnv.app.contextManager.on('saveSuccess', ({ sessionId: eventSessionId }) => {
        if (eventSessionId === sessionId) {
          eventCount++;
          if (eventCount === expectedEvents) done();
        }
      });

      // Create and save context with prompt
      mcpServer['handleSaveContextWithPrompt']({
        sessionId,
        title: 'Auto-Save Events Test',
        content: 'Testing auto-save event handling',
        type: 'general',
        tags: ['autosave-events-test'],
        requirePrompt: true,
      }).then(() => {
        return mcpServer['handleRespondToSavePrompt']({
          sessionId,
          shouldSave: true,
        });
      });

      // Failsafe timeout
      setTimeout(() => {
        if (eventCount < expectedEvents) {
          done(new Error(`Only received ${eventCount}/${expectedEvents} events`));
        }
      }, 10000);
    });

    test('should maintain system status accuracy', async () => {
      const sessionIds = ['status-1', 'status-2', 'status-3'];
      
      // Create multiple contexts requiring prompts
      for (const sessionId of sessionIds) {
        await mcpServer['handleSaveContextWithPrompt']({
          sessionId,
          title: `Status Test ${sessionId}`,
          content: `Testing system status for ${sessionId}`,
          type: 'general',
          tags: ['status-test'],
          requirePrompt: true,
        });
      }

      // Check system status
      let systemStatus = testEnv.app.contextManager.getSystemStatus();
      expect(systemStatus.sessionsAwaitingPrompt).toBe(3);
      expect(systemStatus.pendingContexts).toBe(3);
      expect(systemStatus.sessionEndPromptsEnabled).toBe(true);

      // Respond to one prompt - save
      await mcpServer['handleRespondToSavePrompt']({
        sessionId: sessionIds[0],
        shouldSave: true,
      });

      // Respond to another prompt - discard
      await mcpServer['handleRespondToSavePrompt']({
        sessionId: sessionIds[1],
        shouldSave: false,
      });

      // Wait for processing
      await waitForCondition(async () => {
        const status = testEnv.app.contextManager.getSystemStatus();
        return status.sessionsAwaitingPrompt === 1;
      }, 5000);

      // Check updated system status
      systemStatus = testEnv.app.contextManager.getSystemStatus();
      expect(systemStatus.sessionsAwaitingPrompt).toBe(1);
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle session end when prompts are disabled', async () => {
      // Disable session end prompts
      await mcpServer['handleSetSessionEndPrompts']({ enabled: false });

      const sessionId = 'disabled-prompts-session';
      
      // Create context that would normally require prompt
      await mcpServer['handleSaveContextWithPrompt']({
        sessionId,
        title: 'Disabled Prompts Test',
        content: 'This should save without prompt when disabled',
        type: 'general',
        tags: ['disabled-prompts-test'],
        requirePrompt: true,
      });

      // End session - should not require prompt
      const response = await mcpServer['handleSessionEnd']({
        sessionId,
      });

      const result = JSON.parse(response.content[0].text);
      
      expect(result.success).toBe(true);
      expect(result.promptRequired).toBe(false);
      expect(result.message).toContain('No prompt required');

      // Wait for auto-save
      await waitForCondition(async () => {
        const systemStatus = testEnv.app.contextManager.getSystemStatus();
        return systemStatus.pendingContexts === 0;
      }, 5000);

      // Context should be saved automatically
      const contexts = await testEnv.app.contextStore.searchContexts('Disabled Prompts Test');
      expect(contexts.length).toBeGreaterThan(0);
    });

    test('should handle invalid session IDs gracefully', async () => {
      const invalidSessionIds = ['', '   ', null, undefined, 123, {}];
      
      for (const invalidId of invalidSessionIds) {
        const response = await mcpServer['handleSessionEnd']({
          sessionId: invalidId,
        });

        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
        expect(result.promptRequired).toBe(false);
      }
    });

    test('should handle concurrent prompt responses', async () => {
      const sessionId = 'concurrent-responses-session';
      
      // Create context requiring prompt
      await mcpServer['handleSaveContextWithPrompt']({
        sessionId,
        title: 'Concurrent Responses Test',
        content: 'Testing concurrent response handling',
        type: 'general',
        tags: ['concurrent-responses-test'],
        requirePrompt: true,
      });

      // Send multiple concurrent responses
      const responses = await Promise.all([
        mcpServer['handleRespondToSavePrompt']({ sessionId, shouldSave: true }),
        mcpServer['handleRespondToSavePrompt']({ sessionId, shouldSave: false }),
        mcpServer['handleRespondToSavePrompt']({ sessionId, shouldSave: true }),
      ]);

      // Only first should succeed
      const results = responses.map(r => JSON.parse(r.content[0].text));
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(false);
      expect(results[2].success).toBe(false);
    });

    test('should handle service restart with pending prompts', async () => {
      const sessionId = 'service-restart-session';
      
      // Create context requiring prompt
      await mcpServer['handleSaveContextWithPrompt']({
        sessionId,
        title: 'Service Restart Test',
        content: 'Testing service restart with pending prompts',
        type: 'general',
        tags: ['service-restart-test'],
        requirePrompt: true,
      });

      // Simulate service restart by stopping and starting auto-save
      const autoSaveService = testEnv.app.contextManager.getAutoSaveService();
      autoSaveService.stop();
      autoSaveService.start();

      // System should still track the pending prompt
      const response = await mcpServer['handleGetSessionsAwaitingPrompt']({});
      const result = JSON.parse(response.content[0].text);
      
      expect(result.sessionsAwaitingPrompt).toContain(sessionId);
    });
  });

  describe('Performance and Load Testing', () => {
    test('should handle many concurrent prompts efficiently', async () => {
      await mcpServer['handleSetSessionEndPrompts']({ enabled: true });

      const sessionCount = 20;
      const sessionIds = Array.from({ length: sessionCount }, (_, i) => `load-test-${i}`);
      
      const startTime = Date.now();

      // Create many contexts requiring prompts
      const createPromises = sessionIds.map((sessionId, index) =>
        mcpServer['handleSaveContextWithPrompt']({
          sessionId,
          title: `Load Test Context ${index}`,
          content: `Load testing with context ${index}`,
          type: 'general',
          tags: ['load-test'],
          requirePrompt: true,
        })
      );

      await Promise.all(createPromises);

      // Respond to all prompts
      const responsePromises = sessionIds.map(sessionId =>
        mcpServer['handleRespondToSavePrompt']({
          sessionId,
          shouldSave: true,
        })
      );

      const responses = await Promise.all(responsePromises);
      
      const totalTime = Date.now() - startTime;

      // All responses should succeed
      responses.forEach(response => {
        const result = JSON.parse(response.content[0].text);
        expect(result.success).toBe(true);
      });

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(10000); // 10 seconds

      // Wait for all saves to complete
      await waitForCondition(async () => {
        const systemStatus = testEnv.app.contextManager.getSystemStatus();
        return systemStatus.pendingContexts === 0;
      }, 15000);

      // All contexts should be saved
      const contexts = await testEnv.app.contextStore.searchContexts('Load Test Context');
      expect(contexts.length).toBe(sessionCount);
    }, 20000);
  });
});

/**
 * Session Prompts Test Utilities
 */
export class SessionPromptsTestUtils {
  static async createPromptRequiredContext(
    mcpServer: PersistentContextMcpServer,
    sessionId: string,
    overrides: any = {}
  ): Promise<{ sessionId: string; contextTitle: string }> {
    const contextTitle = overrides.title || `Prompt Required Context ${Date.now()}`;
    
    await mcpServer['handleSaveContextWithPrompt']({
      sessionId,
      title: contextTitle,
      content: overrides.content || 'This context requires user confirmation',
      type: overrides.type || 'general',
      tags: overrides.tags || ['prompt-test'],
      requirePrompt: true,
    });

    return { sessionId, contextTitle };
  }

  static async validatePromptWorkflow(
    mcpServer: PersistentContextMcpServer,
    sessionId: string,
    shouldSave: boolean
  ): Promise<{ promptWorkflowValid: boolean; contextSaved: boolean }> {
    try {
      // Check sessions awaiting prompt
      const awaitingResponse = await mcpServer['handleGetSessionsAwaitingPrompt']({});
      const awaitingResult = JSON.parse(awaitingResponse.content[0].text);
      
      if (!awaitingResult.sessionsAwaitingPrompt.includes(sessionId)) {
        return { promptWorkflowValid: false, contextSaved: false };
      }

      // Respond to prompt
      const responseResult = await mcpServer['handleRespondToSavePrompt']({
        sessionId,
        shouldSave,
      });

      const response = JSON.parse(responseResult.content[0].text);
      if (!response.success) {
        return { promptWorkflowValid: false, contextSaved: false };
      }

      return { 
        promptWorkflowValid: true, 
        contextSaved: shouldSave 
      };
    } catch (error) {
      return { promptWorkflowValid: false, contextSaved: false };
    }
  }

  static async measurePromptResponseTime(
    mcpServer: PersistentContextMcpServer,
    sessionId: string
  ): Promise<{ responseTime: number; success: boolean }> {
    const startTime = Date.now();
    
    try {
      const response = await mcpServer['handleRespondToSavePrompt']({
        sessionId,
        shouldSave: true,
      });

      const responseTime = Date.now() - startTime;
      const result = JSON.parse(response.content[0].text);
      
      return {
        responseTime,
        success: result.success,
      };
    } catch (error) {
      return {
        responseTime: Date.now() - startTime,
        success: false,
      };
    }
  }
}