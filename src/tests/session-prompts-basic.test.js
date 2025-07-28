/**
 * Basic Session Prompts Test
 * Simple test to validate core session prompt functionality
 */

const { createPersistentContextStoreApp } = require('../app.js');
const { PersistentContextMcpServer } = require('../mcp-server.js');

describe('Basic Session Prompts Test', () => {
  let app;
  let mcpServer;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.NEO4J_DATABASE = `test_session_prompts_${Date.now()}`;
    process.env.LOG_LEVEL = 'error';

    try {
      app = createPersistentContextStoreApp();
      await app.initialize();
      mcpServer = new PersistentContextMcpServer();
      
      console.log('Basic session prompts test environment initialized');
    } catch (error) {
      console.error('Failed to initialize test environment:', error);
      throw error;
    }
  }, 30000);

  afterAll(async () => {
    if (app) {
      await app.shutdown();
    }
  }, 15000);

  test('should enable session end prompts', async () => {
    const response = await mcpServer.handleSetSessionEndPrompts({
      enabled: true,
    });

    expect(response.content[0].text).toBeDefined();
    const result = JSON.parse(response.content[0].text);
    
    expect(result.success).toBe(true);
    expect(result.enabled).toBe(true);
    expect(result.message).toContain('enabled');

    // Verify configuration was applied
    const systemStatus = app.contextManager.getSystemStatus();
    expect(systemStatus.sessionEndPromptsEnabled).toBe(true);
  });

  test('should disable session end prompts', async () => {
    const response = await mcpServer.handleSetSessionEndPrompts({
      enabled: false,
    });

    const result = JSON.parse(response.content[0].text);
    
    expect(result.success).toBe(true);
    expect(result.enabled).toBe(false);
    expect(result.message).toContain('disabled');

    // Verify configuration was applied
    const systemStatus = app.contextManager.getSystemStatus();
    expect(systemStatus.sessionEndPromptsEnabled).toBe(false);
  });

  test('should create context requiring prompt', async () => {
    // First enable prompts
    await mcpServer.handleSetSessionEndPrompts({ enabled: true });

    const sessionId = 'test-prompt-session';
    
    const response = await mcpServer.handleSaveContextWithPrompt({
      sessionId,
      title: 'Test Prompt Context',
      content: 'This context requires user confirmation',
      type: 'general',
      tags: ['test'],
      requirePrompt: true,
    });

    const result = JSON.parse(response.content[0].text);
    
    expect(result.success).toBe(true);
    expect(result.promptRequired).toBe(true);
    expect(result.message).toContain('user prompt required');
  });

  test('should track sessions awaiting prompts', async () => {
    const response = await mcpServer.handleGetSessionsAwaitingPrompt({});
    const result = JSON.parse(response.content[0].text);
    
    expect(result.success).toBe(true);
    expect(result.count).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(result.sessionsAwaitingPrompt)).toBe(true);
  });

  test('should handle session end without pending changes', async () => {
    const sessionId = 'empty-session';
    
    const response = await mcpServer.handleSessionEnd({
      sessionId,
    });

    const result = JSON.parse(response.content[0].text);
    
    expect(result.success).toBe(true);
    expect(result.promptRequired).toBe(false);
    expect(result.message).toContain('No prompt required');
  });

  test('should respond to save prompt', async () => {
    const sessionId = 'response-test-session';
    
    // Create context requiring prompt
    await mcpServer.handleSaveContextWithPrompt({
      sessionId,
      title: 'Response Test Context',
      content: 'Testing prompt response',
      type: 'general',
      tags: ['response-test'],
      requirePrompt: true,
    });

    // Respond with save = true
    const response = await mcpServer.handleRespondToSavePrompt({
      sessionId,
      shouldSave: true,
    });

    const result = JSON.parse(response.content[0].text);
    
    expect(result.success).toBe(true);
    expect(result.sessionId).toBe(sessionId);
    expect(result.response).toBe('save');
    expect(result.message).toContain('will save');
  });

  test('should handle invalid session ID in response', async () => {
    const response = await mcpServer.handleRespondToSavePrompt({
      sessionId: 'non-existent-session',
      shouldSave: true,
    });

    const result = JSON.parse(response.content[0].text);
    
    expect(result.success).toBe(false);
    expect(result.message).toContain('No prompt found');
  });
});