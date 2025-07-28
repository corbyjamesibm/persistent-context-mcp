/**
 * Test Environment Setup
 * Provides utilities for setting up and tearing down test environments
 */

import { execSync } from 'child_process';
import { promises as fs } from 'fs';
import { join } from 'path';
import { createPersistentContextStoreApp, PersistentContextStoreApp } from '../../app.js';
import { createServer } from '../../api/server.js';
import { logger } from '../../utils/logger.js';

export interface TestEnvironment {
  app: PersistentContextStoreApp;
  server: ReturnType<typeof createServer>;
  cleanup: () => Promise<void>;
}

/**
 * Setup test environment with isolated database and services
 */
export async function setupTestEnvironment(options?: {
  enablePerformanceMonitoring?: boolean;
  enableBackups?: boolean;
  testDatabaseSuffix?: string;
}): Promise<TestEnvironment> {
  const testId = options?.testDatabaseSuffix || `test_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  
  // Set test-specific environment variables
  const originalEnv = { ...process.env };
  
  process.env.NODE_ENV = 'test';
  process.env.NEO4J_DATABASE = `contextstore_${testId}`;
  process.env.BACKUP_DIRECTORY = join(process.cwd(), 'test-backups', testId);
  process.env.PERFORMANCE_MONITORING = options?.enablePerformanceMonitoring ? 'true' : 'false';
  process.env.BACKUP_ENABLED = options?.enableBackups ? 'true' : 'false';
  process.env.LOG_LEVEL = 'error'; // Reduce test noise
  
  try {
    // Create test backup directory
    await fs.mkdir(process.env.BACKUP_DIRECTORY, { recursive: true });
    
    // Initialize application
    const app = createPersistentContextStoreApp();
    await app.initialize();
    
    // Create server instance
    const server = createServer(app.contextStore, app.contextManager, app);
    
    logger.info(`Test environment initialized: ${testId}`);
    
    return {
      app,
      server,
      cleanup: async () => {
        try {
          // Shutdown application
          await app.shutdown();
          
          // Clean up test backup directory
          try {
            await fs.rm(process.env.BACKUP_DIRECTORY, { recursive: true, force: true });
          } catch (error) {
            logger.warn('Failed to clean up test backup directory:', error);
          }
          
          // Clean up test database
          try {
            await cleanupTestDatabase(testId);
          } catch (error) {
            logger.warn('Failed to clean up test database:', error);
          }
          
          // Restore original environment
          process.env = originalEnv;
          
          logger.info(`Test environment cleaned up: ${testId}`);
        } catch (error) {
          logger.error('Error during test cleanup:', error);
          throw error;
        }
      },
    };
  } catch (error) {
    // Restore environment on setup failure
    process.env = originalEnv;
    throw error;
  }
}

/**
 * Clean up test database
 */
async function cleanupTestDatabase(testId: string): Promise<void> {
  try {
    // This would ideally connect to Neo4j and drop the test database
    // For now, we'll just log the cleanup attempt
    logger.debug(`Cleaning up test database: contextstore_${testId}`);
  } catch (error) {
    logger.warn('Failed to cleanup test database:', error);
  }
}

/**
 * Setup test data for comprehensive testing
 */
export async function setupTestData(app: PersistentContextStoreApp): Promise<{
  contexts: any[];
  sessions: string[];
  templates: any[];
}> {
  const contexts: any[] = [];
  const sessions: string[] = [];
  const templates: any[] = [];
  
  // Create test sessions
  const sessionIds = [
    'test-session-1',
    'test-session-2',
    'test-session-3',
    'development-session',
    'analysis-session',
  ];
  sessions.push(...sessionIds);
  
  // Create test contexts
  const testContexts = [
    {
      title: 'Test Context 1',
      content: 'This is a test context for unit testing',
      type: 'development',
      tags: ['test', 'unit-testing'],
      sessionId: sessionIds[0],
      metadata: {
        aiGenerated: true,
        source: 'test-setup',
        importance: 'high',
      },
    },
    {
      title: 'Analysis Context',
      content: 'This context contains analysis information and insights',
      type: 'analysis',
      tags: ['analysis', 'insights'],
      sessionId: sessionIds[1],
      metadata: {
        aiGenerated: false,
        source: 'manual',
        importance: 'medium',
      },
    },
    {
      title: 'Planning Context',
      content: 'Strategic planning and roadmap information',
      type: 'planning',
      tags: ['planning', 'strategy', 'roadmap'],
      sessionId: sessionIds[2],
      metadata: {
        aiGenerated: true,
        source: 'planning-tool',
        importance: 'high',
      },
    },
    {
      title: 'Development Notes',
      content: 'Technical implementation details and code snippets',
      type: 'development',
      tags: ['development', 'technical', 'code'],
      sessionId: sessionIds[3],
      metadata: {
        aiGenerated: false,
        source: 'developer',
        importance: 'medium',
      },
    },
    {
      title: 'General Information',
      content: 'General purpose context with miscellaneous information',
      type: 'general',
      tags: ['general', 'miscellaneous'],
      sessionId: sessionIds[4],
      metadata: {
        aiGenerated: true,
        source: 'general-assistant',
        importance: 'low',
      },
    },
  ];
  
  for (const contextData of testContexts) {
    const contextId = await app.contextStore.saveContext(contextData);
    const savedContext = await app.contextStore.getContext(contextId);
    if (savedContext) {
      contexts.push(savedContext);
    }
  }
  
  // Create test templates (if template generator is available)
  try {
    const templateConfig = {
      title: 'Test Template',
      description: 'A template created for testing purposes',
      type: 'development',
    };
    
    const template = await app.templateGenerator.generateTemplate(
      contexts.slice(0, 2).map(c => c.id),
      templateConfig
    );
    templates.push(template);
  } catch (error) {
    logger.warn('Failed to create test template:', error);
  }
  
  logger.info(`Test data created: ${contexts.length} contexts, ${sessions.length} sessions, ${templates.length} templates`);
  
  return { contexts, sessions, templates };
}

/**
 * Wait for condition with timeout
 */
export async function waitForCondition(
  condition: () => boolean | Promise<boolean>,
  timeout: number = 5000,
  interval: number = 100
): Promise<void> {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    if (await condition()) {
      return;
    }
    await new Promise(resolve => setTimeout(resolve, interval));
  }
  
  throw new Error(`Condition not met within ${timeout}ms timeout`);
}

/**
 * Generate test context data
 */
export function generateTestContext(overrides?: Partial<any>): any {
  return {
    title: `Test Context ${Date.now()}`,
    content: `This is test context content generated at ${new Date().toISOString()}`,
    type: 'development',
    tags: ['test', 'generated'],
    sessionId: `test-session-${Date.now()}`,
    metadata: {
      aiGenerated: true,
      source: 'test-generator',
      importance: 'medium',
    },
    ...overrides,
  };
}

/**
 * Assert array contains expected elements
 */
export function assertArrayContains<T>(
  actual: T[],
  expected: Partial<T>[],
  getMessage: (item: T) => string = (item) => JSON.stringify(item)
): void {
  for (const expectedItem of expected) {
    const found = actual.some(actualItem => {
      return Object.keys(expectedItem).every(key => {
        return actualItem[key as keyof T] === expectedItem[key as keyof Partial<T>];
      });
    });
    
    if (!found) {
      throw new Error(`Expected array to contain item: ${JSON.stringify(expectedItem)}\nActual array: ${actual.map(getMessage).join(', ')}`);
    }
  }
}

/**
 * Validate MCP tool response structure
 */
export function validateMcpToolResponse(response: any): void {
  expect(response).toBeDefined();
  expect(response.content).toBeDefined();
  expect(Array.isArray(response.content)).toBe(true);
  expect(response.content.length).toBeGreaterThan(0);
  expect(response.content[0].type).toBe('text');
  expect(response.content[0].text).toBeDefined();
  
  // Parse and validate JSON response
  const parsedResponse = JSON.parse(response.content[0].text);
  expect(parsedResponse.success).toBeDefined();
  expect(typeof parsedResponse.success).toBe('boolean');
}

/**
 * Create mock HTTP request for testing
 */
export function createMockRequest(options: {
  method?: string;
  path?: string;
  query?: Record<string, any>;
  body?: any;
  headers?: Record<string, string>;
}): any {
  return {
    method: options.method || 'GET',
    path: options.path || '/',
    query: options.query || {},
    body: options.body || {},
    headers: options.headers || {},
    ip: '127.0.0.1',
    get: (header: string) => options.headers?.[header],
  };
}

/**
 * Create mock HTTP response for testing
 */
export function createMockResponse(): any {
  const response = {
    statusCode: 200,
    headers: {},
    body: null,
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    on: jest.fn(),
  };
  
  response.status.mockImplementation((code: number) => {
    response.statusCode = code;
    return response;
  });
  
  response.json.mockImplementation((data: any) => {
    response.body = data;
    return response;
  });
  
  return response;
}