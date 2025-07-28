/**
 * Context Store Unit Tests
 * Tests the core context storage functionality in isolation
 */

import { createNeo4jContextStore } from '../../core/storage/neo4j-store.js';
import { generateTestContext, setupTestEnvironment } from '../setup/test-environment.js';
import { logger } from '../../utils/logger.js';

describe('Context Store Unit Tests', () => {
  let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;
  let contextStore: ReturnType<typeof createNeo4jContextStore>;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment({
      testDatabaseSuffix: 'unit_context_store',
    });
    contextStore = testEnv.app.contextStore;
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe('Context Creation', () => {
    test('should save valid context successfully', async () => {
      const contextData = generateTestContext({
        title: 'Unit Test Context',
        content: 'This is a unit test context',
        type: 'development',
      });

      const contextId = await contextStore.saveContext(contextData);
      
      expect(contextId).toBeDefined();
      expect(typeof contextId).toBe('string');
      expect(contextId.length).toBeGreaterThan(0);
    });

    test('should generate unique IDs for different contexts', async () => {
      const context1Data = generateTestContext({ title: 'Context 1' });
      const context2Data = generateTestContext({ title: 'Context 2' });

      const context1Id = await contextStore.saveContext(context1Data);
      const context2Id = await contextStore.saveContext(context2Data);

      expect(context1Id).not.toBe(context2Id);
    });

    test('should preserve all context properties', async () => {
      const originalContext = generateTestContext({
        title: 'Property Preservation Test',
        content: 'Testing property preservation',
        type: 'analysis',
        tags: ['test', 'properties', 'preservation'],
        sessionId: 'property-test-session',
        metadata: {
          aiGenerated: false,
          source: 'unit-test',
          importance: 'high',
        },
      });

      const contextId = await contextStore.saveContext(originalContext);
      const savedContext = await contextStore.getContext(contextId);

      expect(savedContext).toBeDefined();
      expect(savedContext?.title).toBe(originalContext.title);
      expect(savedContext?.content).toBe(originalContext.content);
      expect(savedContext?.type).toBe(originalContext.type);
      expect(savedContext?.tags).toEqual(originalContext.tags);
      expect(savedContext?.sessionId).toBe(originalContext.sessionId);
      expect(savedContext?.metadata.aiGenerated).toBe(originalContext.metadata.aiGenerated);
      expect(savedContext?.metadata.source).toBe(originalContext.metadata.source);
      expect(savedContext?.metadata.importance).toBe(originalContext.metadata.importance);
    });

    test('should set creation and update timestamps', async () => {
      const beforeSave = new Date();
      const contextData = generateTestContext();
      
      const contextId = await contextStore.saveContext(contextData);
      const savedContext = await contextStore.getContext(contextId);
      const afterSave = new Date();

      expect(savedContext?.createdAt).toBeInstanceOf(Date);
      expect(savedContext?.updatedAt).toBeInstanceOf(Date);
      expect(savedContext?.createdAt.getTime()).toBeGreaterThanOrEqual(beforeSave.getTime());
      expect(savedContext?.createdAt.getTime()).toBeLessThanOrEqual(afterSave.getTime());
      expect(savedContext?.updatedAt.getTime()).toBeGreaterThanOrEqual(savedContext?.createdAt.getTime());
    });

    test('should handle contexts with minimal data', async () => {
      const minimalContext = {
        title: 'Minimal Context',
        content: 'Minimal content',
        type: 'general' as const,
        tags: [],
        sessionId: 'minimal-session',
        metadata: {
          aiGenerated: true,
          source: 'test',
          importance: 'low' as const,
        },
      };

      const contextId = await contextStore.saveContext(minimalContext);
      const savedContext = await contextStore.getContext(contextId);

      expect(savedContext).toBeDefined();
      expect(savedContext?.title).toBe('Minimal Context');
      expect(savedContext?.tags).toEqual([]);
    });

    test('should handle contexts with maximum data', async () => {
      const maximalContext = generateTestContext({
        title: 'Maximal Context with Very Long Title That Tests Length Limits',
        content: 'This is a maximal context with extensive content that includes multiple paragraphs.\n\nParagraph 2 with more details and information.\n\nParagraph 3 with even more comprehensive data to test storage capabilities.',
        type: 'development',
        tags: ['test', 'maximal', 'comprehensive', 'storage', 'validation', 'unit-testing'],
        sessionId: 'maximal-test-session-with-long-name',
        metadata: {
          aiGenerated: true,
          source: 'comprehensive-unit-test',
          importance: 'high',
        },
      });

      const contextId = await contextStore.saveContext(maximalContext);
      const savedContext = await contextStore.getContext(contextId);

      expect(savedContext).toBeDefined();
      expect(savedContext?.title).toBe(maximalContext.title);
      expect(savedContext?.content).toBe(maximalContext.content);
      expect(savedContext?.tags).toEqual(maximalContext.tags);
    });
  });

  describe('Context Retrieval', () => {
    let testContextId: string;

    beforeAll(async () => {
      const contextData = generateTestContext({
        title: 'Retrieval Test Context',
        content: 'This context is used for retrieval testing',
      });
      testContextId = await contextStore.saveContext(contextData);
    });

    test('should retrieve existing context by ID', async () => {
      const context = await contextStore.getContext(testContextId);
      
      expect(context).toBeDefined();
      expect(context?.id).toBe(testContextId);
      expect(context?.title).toBe('Retrieval Test Context');
    });

    test('should return null for non-existent context', async () => {
      const context = await contextStore.getContext('non-existent-id');
      
      expect(context).toBeNull();
    });

    test('should return null for invalid context ID', async () => {
      const invalidIds = ['', '   ', 'invalid-id-format', '123', null, undefined];
      
      for (const invalidId of invalidIds) {
        const context = await contextStore.getContext(invalidId as any);
        expect(context).toBeNull();
      }
    });

    test('should retrieve context with all relationships', async () => {
      const context = await contextStore.getContext(testContextId);
      
      expect(context).toBeDefined();
      expect(context?.id).toBeDefined();
      expect(context?.title).toBeDefined();
      expect(context?.content).toBeDefined();
      expect(context?.type).toBeDefined();
      expect(context?.tags).toBeDefined();
      expect(context?.sessionId).toBeDefined();
      expect(context?.metadata).toBeDefined();
      expect(context?.createdAt).toBeDefined();
      expect(context?.updatedAt).toBeDefined();
    });
  });

  describe('Context Updates', () => {
    let testContextId: string;
    let originalContext: any;

    beforeEach(async () => {
      const contextData = generateTestContext({
        title: 'Update Test Context',
        content: 'Original content for update testing',
        type: 'development',
        tags: ['original', 'update-test'],
      });
      testContextId = await contextStore.saveContext(contextData);
      originalContext = await contextStore.getContext(testContextId);
    });

    test('should update context title', async () => {
      const updates = { title: 'Updated Title' };
      
      const updatedContext = await contextStore.updateContext(testContextId, updates);
      
      expect(updatedContext).toBeDefined();
      expect(updatedContext?.title).toBe('Updated Title');
      expect(updatedContext?.content).toBe(originalContext.content); // Unchanged
      expect(updatedContext?.id).toBe(testContextId);
    });

    test('should update context content', async () => {
      const updates = { content: 'Updated content with new information' };
      
      const updatedContext = await contextStore.updateContext(testContextId, updates);
      
      expect(updatedContext).toBeDefined();
      expect(updatedContext?.content).toBe('Updated content with new information');
      expect(updatedContext?.title).toBe(originalContext.title); // Unchanged
    });

    test('should update context tags', async () => {
      const updates = { tags: ['updated', 'new-tags', 'modified'] };
      
      const updatedContext = await contextStore.updateContext(testContextId, updates);
      
      expect(updatedContext).toBeDefined();
      expect(updatedContext?.tags).toEqual(['updated', 'new-tags', 'modified']);
    });

    test('should update multiple properties simultaneously', async () => {
      const updates = {
        title: 'Multi-Update Title',
        content: 'Multi-update content',
        tags: ['multi', 'update'],
        metadata: {
          ...originalContext.metadata,
          importance: 'critical' as const,
        },
      };
      
      const updatedContext = await contextStore.updateContext(testContextId, updates);
      
      expect(updatedContext).toBeDefined();
      expect(updatedContext?.title).toBe('Multi-Update Title');
      expect(updatedContext?.content).toBe('Multi-update content');
      expect(updatedContext?.tags).toEqual(['multi', 'update']);
      expect(updatedContext?.metadata.importance).toBe('critical');
    });

    test('should update timestamp on modification', async () => {
      const originalUpdatedAt = originalContext.updatedAt;
      
      // Wait a small amount to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updates = { title: 'Timestamp Test Update' };
      const updatedContext = await contextStore.updateContext(testContextId, updates);
      
      expect(updatedContext).toBeDefined();
      expect(updatedContext?.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime());
      expect(updatedContext?.createdAt.getTime()).toBe(originalContext.createdAt.getTime()); // Unchanged
    });

    test('should return null when updating non-existent context', async () => {
      const updates = { title: 'Non-existent Update' };
      
      const result = await contextStore.updateContext('non-existent-id', updates);
      
      expect(result).toBeNull();
    });

    test('should handle empty updates gracefully', async () => {
      const updates = {};
      
      const updatedContext = await contextStore.updateContext(testContextId, updates);
      
      expect(updatedContext).toBeDefined();
      expect(updatedContext?.title).toBe(originalContext.title);
      expect(updatedContext?.content).toBe(originalContext.content);
      // Updated timestamp should still change even with empty updates
      expect(updatedContext?.updatedAt.getTime()).toBeGreaterThanOrEqual(originalContext.updatedAt.getTime());
    });
  });

  describe('Context Search', () => {
    beforeAll(async () => {
      // Create test contexts for search
      const searchTestContexts = [
        {
          title: 'JavaScript Development Guide',
          content: 'Comprehensive guide for JavaScript development with best practices',
          type: 'development',
          tags: ['javascript', 'development', 'guide'],
          sessionId: 'search-test-1',
        },
        {
          title: 'React Component Testing',
          content: 'How to test React components effectively using Jest and Testing Library',
          type: 'development',
          tags: ['react', 'testing', 'components'],
          sessionId: 'search-test-2',
        },
        {
          title: 'Database Design Principles',
          content: 'Key principles for designing efficient and scalable databases',
          type: 'analysis',
          tags: ['database', 'design', 'principles'],
          sessionId: 'search-test-3',
        },
        {
          title: 'API Documentation Standards',
          content: 'Standards and best practices for API documentation',
          type: 'planning',
          tags: ['api', 'documentation', 'standards'],
          sessionId: 'search-test-4',
        },
      ];

      for (const contextData of searchTestContexts) {
        await contextStore.saveContext({
          ...contextData,
          metadata: {
            aiGenerated: true,
            source: 'search-test',
            importance: 'medium' as const,
          },
        });
      }
    });

    test('should find contexts by title', async () => {
      const results = await contextStore.searchContexts('JavaScript Development');
      
      expect(results.length).toBeGreaterThan(0);
      const jsContext = results.find(c => c.title.includes('JavaScript Development'));
      expect(jsContext).toBeDefined();
    });

    test('should find contexts by content', async () => {
      const results = await contextStore.searchContexts('React components');
      
      expect(results.length).toBeGreaterThan(0);
      const reactContext = results.find(c => c.content.includes('React components'));
      expect(reactContext).toBeDefined();
    });

    test('should find contexts by tags', async () => {
      const results = await contextStore.searchContexts('testing');
      
      expect(results.length).toBeGreaterThan(0);
      const testingContext = results.find(c => c.tags.includes('testing'));
      expect(testingContext).toBeDefined();
    });

    test('should filter by context type', async () => {
      const results = await contextStore.searchContexts('', { type: 'development' });
      
      expect(results.length).toBeGreaterThan(0);
      results.forEach(context => {
        expect(context.type).toBe('development');
      });
    });

    test('should return empty array for no matches', async () => {
      const results = await contextStore.searchContexts('nonexistent-search-term-xyz');
      
      expect(results).toEqual([]);
    });

    test('should handle empty search query', async () => {
      const results = await contextStore.searchContexts('');
      
      expect(Array.isArray(results)).toBe(true);
      expect(results.length).toBeGreaterThan(0); // Should return all contexts
    });

    test('should be case insensitive', async () => {
      const upperCaseResults = await contextStore.searchContexts('JAVASCRIPT');
      const lowerCaseResults = await contextStore.searchContexts('javascript');
      const mixedCaseResults = await contextStore.searchContexts('JavaScript');
      
      expect(upperCaseResults.length).toBeGreaterThan(0);
      expect(lowerCaseResults.length).toBeGreaterThan(0);
      expect(mixedCaseResults.length).toBeGreaterThan(0);
      
      // All should return similar results
      expect(upperCaseResults.length).toBe(lowerCaseResults.length);
      expect(lowerCaseResults.length).toBe(mixedCaseResults.length);
    });
  });

  describe('Context Deletion', () => {
    test('should delete existing context', async () => {
      const contextData = generateTestContext({
        title: 'Context to Delete',
        content: 'This context will be deleted',
      });
      
      const contextId = await contextStore.saveContext(contextData);
      
      // Verify context exists
      const savedContext = await contextStore.getContext(contextId);
      expect(savedContext).toBeDefined();
      
      // Delete context
      const deleteResult = await contextStore.deleteContext(contextId);
      expect(deleteResult).toBe(true);
      
      // Verify context no longer exists
      const deletedContext = await contextStore.getContext(contextId);
      expect(deletedContext).toBeNull();
    });

    test('should return false when deleting non-existent context', async () => {
      const deleteResult = await contextStore.deleteContext('non-existent-id');
      
      expect(deleteResult).toBe(false);
    });

    test('should handle deletion of already deleted context', async () => {
      const contextData = generateTestContext();
      const contextId = await contextStore.saveContext(contextData);
      
      // Delete once
      const firstDeleteResult = await contextStore.deleteContext(contextId);
      expect(firstDeleteResult).toBe(true);
      
      // Try to delete again
      const secondDeleteResult = await contextStore.deleteContext(contextId);
      expect(secondDeleteResult).toBe(false);
    });
  });

  describe('Database Connection Management', () => {
    test('should report connection status correctly', () => {
      const isConnected = contextStore.isConnectedToDatabase();
      
      expect(typeof isConnected).toBe('boolean');
      expect(isConnected).toBe(true); // Should be connected during tests
    });

    test('should handle database operations when connected', async () => {
      if (contextStore.isConnectedToDatabase()) {
        const contextData = generateTestContext();
        const contextId = await contextStore.saveContext(contextData);
        
        expect(contextId).toBeDefined();
        
        const retrievedContext = await contextStore.getContext(contextId);
        expect(retrievedContext).toBeDefined();
      }
    });
  });

  describe('Data Validation and Edge Cases', () => {
    test('should handle special characters in content', async () => {
      const specialContent = 'Content with special characters: !@#$%^&*()_+-=[]{}|;:,.<>?`~"\'\\';
      const contextData = generateTestContext({
        title: 'Special Characters Test',
        content: specialContent,
      });
      
      const contextId = await contextStore.saveContext(contextData);
      const savedContext = await contextStore.getContext(contextId);
      
      expect(savedContext?.content).toBe(specialContent);
    });

    test('should handle unicode content', async () => {
      const unicodeContent = 'Unicode content: 你好世界 🌍 café naïve résumé';
      const contextData = generateTestContext({
        title: 'Unicode Test',
        content: unicodeContent,
      });
      
      const contextId = await contextStore.saveContext(contextData);
      const savedContext = await contextStore.getContext(contextId);
      
      expect(savedContext?.content).toBe(unicodeContent);
    });

    test('should handle large content', async () => {
      const largeContent = 'Large content test: ' + 'x'.repeat(10000);
      const contextData = generateTestContext({
        title: 'Large Content Test',
        content: largeContent,
      });
      
      const contextId = await contextStore.saveContext(contextData);
      const savedContext = await contextStore.getContext(contextId);
      
      expect(savedContext?.content).toBe(largeContent);
      expect(savedContext?.content.length).toBe(largeContent.length);
    });

    test('should handle contexts with many tags', async () => {
      const manyTags = Array.from({ length: 50 }, (_, i) => `tag-${i}`);
      const contextData = generateTestContext({
        title: 'Many Tags Test',
        tags: manyTags,
      });
      
      const contextId = await contextStore.saveContext(contextData);
      const savedContext = await contextStore.getContext(contextId);
      
      expect(savedContext?.tags).toEqual(manyTags);
      expect(savedContext?.tags.length).toBe(50);
    });

    test('should handle duplicate tags', async () => {
      const tagsWithDuplicates = ['tag1', 'tag2', 'tag1', 'tag3', 'tag2'];
      const contextData = generateTestContext({
        title: 'Duplicate Tags Test',
        tags: tagsWithDuplicates,
      });
      
      const contextId = await contextStore.saveContext(contextData);
      const savedContext = await contextStore.getContext(contextId);
      
      expect(savedContext?.tags).toEqual(tagsWithDuplicates); // Should preserve original array
    });
  });

  describe('Performance and Concurrency', () => {
    test('should handle multiple concurrent saves', async () => {
      const concurrentSaves = Array.from({ length: 10 }, (_, i) => 
        contextStore.saveContext(generateTestContext({
          title: `Concurrent Save ${i}`,
          sessionId: `concurrent-session-${i}`,
        }))
      );
      
      const contextIds = await Promise.all(concurrentSaves);
      
      expect(contextIds.length).toBe(10);
      contextIds.forEach(id => {
        expect(id).toBeDefined();
        expect(typeof id).toBe('string');
      });
      
      // Verify all contexts are unique
      const uniqueIds = new Set(contextIds);
      expect(uniqueIds.size).toBe(10);
    });

    test('should handle concurrent reads and writes', async () => {
      const contextData = generateTestContext({
        title: 'Concurrent R/W Test',
      });
      
      const contextId = await contextStore.saveContext(contextData);
      
      // Perform concurrent reads and updates
      const operations = [
        contextStore.getContext(contextId),
        contextStore.updateContext(contextId, { title: 'Updated Title 1' }),
        contextStore.getContext(contextId),
        contextStore.updateContext(contextId, { title: 'Updated Title 2' }),
        contextStore.getContext(contextId),
      ];
      
      const results = await Promise.all(operations);
      
      // All operations should complete successfully
      expect(results[0]).toBeDefined(); // First read
      expect(results[1]).toBeDefined(); // First update
      expect(results[2]).toBeDefined(); // Second read
      expect(results[3]).toBeDefined(); // Second update
      expect(results[4]).toBeDefined(); // Third read
      
      // Final context should have the last update
      const finalContext = results[4] as any;
      expect(finalContext.title).toBe('Updated Title 2');
    });

    test('should maintain data consistency under concurrent operations', async () => {
      const sessionId = 'consistency-test-session';
      const baseContext = generateTestContext({
        title: 'Consistency Test',
        sessionId,
      });
      
      const contextId = await contextStore.saveContext(baseContext);
      
      // Perform multiple concurrent updates to the same context
      const updates = Array.from({ length: 5 }, (_, i) => 
        contextStore.updateContext(contextId, {
          content: `Updated content ${i}`,
          tags: [`update-${i}`],
        })
      );
      
      const updateResults = await Promise.all(updates);
      
      // All updates should succeed
      updateResults.forEach(result => {
        expect(result).toBeDefined();
        expect(result?.id).toBe(contextId);
      });
      
      // Final state should be consistent
      const finalContext = await contextStore.getContext(contextId);
      expect(finalContext).toBeDefined();
      expect(finalContext?.id).toBe(contextId);
      expect(finalContext?.sessionId).toBe(sessionId);
    });
  });
});

/**
 * Context Store Test Utilities
 */
export class ContextStoreTestUtils {
  static async createTestContexts(
    contextStore: any, 
    count: number, 
    overrides?: Partial<any>
  ): Promise<string[]> {
    const contextIds: string[] = [];
    
    for (let i = 0; i < count; i++) {
      const contextData = generateTestContext({
        title: `Test Context ${i + 1}`,
        sessionId: `test-session-${i + 1}`,
        ...overrides,
      });
      
      const contextId = await contextStore.saveContext(contextData);
      contextIds.push(contextId);
    }
    
    return contextIds;
  }
  
  static async verifyContextExists(
    contextStore: any, 
    contextId: string, 
    expectedProperties?: Partial<any>
  ): Promise<void> {
    const context = await contextStore.getContext(contextId);
    
    expect(context).toBeDefined();
    expect(context?.id).toBe(contextId);
    
    if (expectedProperties) {
      Object.keys(expectedProperties).forEach(key => {
        expect(context?.[key]).toBe(expectedProperties[key]);
      });
    }
  }
  
  static async measureOperationTime<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const startTime = Date.now();
    const result = await operation();
    const duration = Date.now() - startTime;
    
    return { result, duration };
  }
}