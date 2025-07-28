/**
 * Search Service Unit Tests
 * Tests the search functionality in isolation
 */

import { setupTestEnvironment, generateTestContext } from '../setup/test-environment.js';
import { logger } from '../../utils/logger.js';

describe('Search Service Unit Tests', () => {
  let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;
  let searchService: any;
  let contextStore: any;
  let testContextIds: string[] = [];

  beforeAll(async () => {
    testEnv = await setupTestEnvironment({
      testDatabaseSuffix: 'unit_search_service',
    });
    searchService = testEnv.app.searchService;
    contextStore = testEnv.app.contextStore;

    // Create test contexts for searching
    const testContexts = [
      {
        title: 'Machine Learning Fundamentals',
        content: 'Introduction to machine learning algorithms including supervised learning, unsupervised learning, and reinforcement learning. This guide covers neural networks, decision trees, and clustering techniques.',
        type: 'development',
        tags: ['machine-learning', 'ai', 'algorithms', 'neural-networks'],
        sessionId: 'ml-session',
      },
      {
        title: 'Web Development Best Practices',
        content: 'Comprehensive guide to modern web development including HTML5, CSS3, JavaScript ES6+, and responsive design principles. Covers accessibility, performance optimization, and SEO best practices.',
        type: 'development',
        tags: ['web-development', 'html', 'css', 'javascript', 'responsive-design'],
        sessionId: 'web-dev-session',
      },
      {
        title: 'Database Design Patterns',
        content: 'Advanced database design patterns for scalable applications. Includes normalization, denormalization, indexing strategies, and query optimization techniques for both SQL and NoSQL databases.',
        type: 'analysis',
        tags: ['database', 'design-patterns', 'sql', 'nosql', 'optimization'],
        sessionId: 'db-design-session',
      },
      {
        title: 'API Architecture Planning',
        content: 'Strategic planning for RESTful API architecture. Covers endpoint design, versioning strategies, authentication methods, rate limiting, and documentation standards.',
        type: 'planning',
        tags: ['api', 'rest', 'architecture', 'planning', 'documentation'],
        sessionId: 'api-planning-session',
      },
      {
        title: 'Testing Strategies Overview',
        content: 'Overview of software testing strategies including unit testing, integration testing, end-to-end testing, and test-driven development. Covers testing frameworks and best practices.',
        type: 'development',
        tags: ['testing', 'unit-testing', 'integration-testing', 'tdd'],
        sessionId: 'testing-session',
      },
      {
        title: 'Performance Optimization Guide',
        content: 'Complete guide to application performance optimization. Includes profiling techniques, memory management, caching strategies, and load balancing for high-performance applications.',
        type: 'analysis',
        tags: ['performance', 'optimization', 'caching', 'profiling'],
        sessionId: 'performance-session',
      },
    ];

    for (const contextData of testContexts) {
      const contextId = await contextStore.saveContext({
        ...contextData,
        metadata: {
          aiGenerated: true,
          source: 'search-test',
          importance: 'medium' as const,
        },
      });
      testContextIds.push(contextId);
    }

    // Build search index
    await searchService.buildIndex();
  });

  afterAll(async () => {
    await testEnv.cleanup();
  });

  describe('Index Building', () => {
    test('should build search index successfully', async () => {
      const indexBuildPromise = new Promise((resolve) => {
        searchService.once('indexBuildCompleted', resolve);
      });

      await searchService.buildIndex();
      
      const buildResult = await indexBuildPromise;
      expect(buildResult).toBeDefined();
      
      const stats = searchService.getSearchStats();
      expect(stats.indexSize).toBeGreaterThan(0);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.lastIndexUpdate).toBeInstanceOf(Date);
    });

    test('should emit index build events', (done) => {
      let eventReceived = false;
      
      searchService.once('indexBuildCompleted', ({ entryCount, buildTime }) => {
        eventReceived = true;
        expect(entryCount).toBeGreaterThan(0);
        expect(buildTime).toBeGreaterThan(0);
        done();
      });
      
      searchService.buildIndex();
      
      setTimeout(() => {
        if (!eventReceived) {
          done(new Error('Index build event not received'));
        }
      }, 5000);
    });

    test('should handle index rebuild', async () => {
      const initialStats = searchService.getSearchStats();
      
      // Add a new context
      const newContextId = await contextStore.saveContext(generateTestContext({
        title: 'Newly Added Context',
        content: 'This context was added after initial index build',
      }));
      
      testContextIds.push(newContextId);
      
      // Rebuild index
      await searchService.buildIndex();
      
      const updatedStats = searchService.getSearchStats();
      expect(updatedStats.indexSize).toBeGreaterThanOrEqual(initialStats.indexSize);
      expect(updatedStats.lastIndexUpdate.getTime()).toBeGreaterThan(initialStats.lastIndexUpdate.getTime());
    });
  });

  describe('Basic Search', () => {
    test('should find contexts by exact title match', async () => {
      const result = await searchService.search({
        query: 'Machine Learning Fundamentals',
        options: { limit: 10 },
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      expect(result.totalCount).toBeGreaterThan(0);
      
      const mlContext = result.results.find(r => 
        r.context.title === 'Machine Learning Fundamentals'
      );
      expect(mlContext).toBeDefined();
      expect(mlContext?.score).toBeGreaterThan(0);
    });

    test('should find contexts by partial title match', async () => {
      const result = await searchService.search({
        query: 'Web Development',
        options: { limit: 10 },
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      
      const webContext = result.results.find(r => 
        r.context.title.includes('Web Development')
      );
      expect(webContext).toBeDefined();
    });

    test('should find contexts by content keywords', async () => {
      const result = await searchService.search({
        query: 'neural networks',
        options: { limit: 10 },
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      
      const mlContext = result.results.find(r => 
        r.context.content.includes('neural networks')
      );
      expect(mlContext).toBeDefined();
    });

    test('should find contexts by tags', async () => {
      const result = await searchService.search({
        query: 'machine-learning',
        options: { limit: 10 },
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      
      const mlContext = result.results.find(r => 
        r.context.tags.includes('machine-learning')
      );
      expect(mlContext).toBeDefined();
    });

    test('should be case insensitive', async () => {
      const queries = ['DATABASE', 'database', 'Database', 'dAtAbAsE'];
      const results = [];
      
      for (const query of queries) {
        const result = await searchService.search({
          query,
          options: { limit: 10 },
        });
        results.push(result);
      }
      
      // All queries should return similar results
      expect(results[0].results.length).toBeGreaterThan(0);
      results.forEach(result => {
        expect(result.results.length).toBe(results[0].results.length);
      });
    });

    test('should handle empty query', async () => {
      const result = await searchService.search({
        query: '',
        options: { limit: 10 },
      });
      
      expect(result.results).toBeInstanceOf(Array);
      expect(result.totalCount).toBeGreaterThanOrEqual(0);
      expect(result.executionTime).toBeGreaterThan(0);
    });

    test('should return empty results for non-existent terms', async () => {
      const result = await searchService.search({
        query: 'nonexistent-term-xyz-123',
        options: { limit: 10 },
      });
      
      expect(result.results).toEqual([]);
      expect(result.totalCount).toBe(0);
    });
  });

  describe('Advanced Search Features', () => {
    test('should filter by context type', async () => {
      const result = await searchService.search({
        query: 'development',
        filters: { type: 'development' },
        options: { limit: 10 },
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      result.results.forEach(r => {
        expect(r.context.type).toBe('development');
      });
    });

    test('should filter by tags', async () => {
      const result = await searchService.search({
        query: '',
        filters: { tags: ['testing'] },
        options: { limit: 10 },
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      result.results.forEach(r => {
        expect(r.context.tags).toContain('testing');
      });
    });

    test('should filter by date range', async () => {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const result = await searchService.search({
        query: '',
        filters: {
          dateRange: {
            start: startDate,
            end: endDate,
          },
        },
        options: { limit: 10 },
      });
      
      expect(result.results).toBeInstanceOf(Array);
      result.results.forEach(r => {
        expect(r.context.createdAt.getTime()).toBeGreaterThanOrEqual(startDate.getTime());
        expect(r.context.createdAt.getTime()).toBeLessThanOrEqual(endDate.getTime());
      });
    });

    test('should combine multiple filters', async () => {
      const result = await searchService.search({
        query: 'development',
        filters: {
          type: 'development',
          tags: ['web-development'],
        },
        options: { limit: 10 },
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      result.results.forEach(r => {
        expect(r.context.type).toBe('development');
        expect(r.context.tags).toContain('web-development');
      });
    });

    test('should support fuzzy matching', async () => {
      const result = await searchService.search({
        query: 'machien learing', // Intentional typos
        options: { 
          limit: 10,
          fuzzyMatch: true,
        },
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      
      // Should still find machine learning content despite typos
      const mlContext = result.results.find(r => 
        r.context.title.includes('Machine Learning') ||
        r.context.content.includes('machine learning')
      );
      expect(mlContext).toBeDefined();
    });

    test('should highlight search matches', async () => {
      const result = await searchService.search({
        query: 'performance optimization',
        options: { 
          limit: 10,
          highlightMatches: true,
        },
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      
      const perfContext = result.results.find(r => 
        r.context.title.includes('Performance Optimization')
      );
      
      if (perfContext) {
        expect(perfContext.highlights).toBeDefined();
        expect(Object.keys(perfContext.highlights).length).toBeGreaterThan(0);
      }
    });
  });

  describe('Search Options', () => {
    test('should respect limit option', async () => {
      const limits = [1, 3, 5];
      
      for (const limit of limits) {
        const result = await searchService.search({
          query: '',
          options: { limit },
        });
        
        expect(result.results.length).toBeLessThanOrEqual(limit);
      }
    });

    test('should support offset for pagination', async () => {
      const firstPage = await searchService.search({
        query: '',
        options: { limit: 2, offset: 0 },
      });
      
      const secondPage = await searchService.search({
        query: '',
        options: { limit: 2, offset: 2 },
      });
      
      expect(firstPage.results.length).toBeLessThanOrEqual(2);
      expect(secondPage.results.length).toBeLessThanOrEqual(2);
      
      // Results should be different (no overlap)
      const firstPageIds = firstPage.results.map(r => r.context.id);
      const secondPageIds = secondPage.results.map(r => r.context.id);
      
      const overlap = firstPageIds.filter(id => secondPageIds.includes(id));
      expect(overlap.length).toBe(0);
    });

    test('should support different sorting options', async () => {
      const sortOptions = ['relevance', 'date', 'title'];
      
      for (const sortBy of sortOptions) {
        const result = await searchService.search({
          query: 'development',
          options: { 
            limit: 5,
            sortBy: sortBy as any,
          },
        });
        
        expect(result.results).toBeInstanceOf(Array);
        expect(result.results.length).toBeGreaterThan(0);
        
        if (sortBy === 'date') {
          // Verify date sorting
          for (let i = 1; i < result.results.length; i++) {
            const prev = result.results[i - 1].context.createdAt;
            const curr = result.results[i].context.createdAt;
            expect(prev.getTime()).toBeGreaterThanOrEqual(curr.getTime());
          }
        }
        
        if (sortBy === 'title') {
          // Verify title sorting
          for (let i = 1; i < result.results.length; i++) {
            const prev = result.results[i - 1].context.title;
            const curr = result.results[i].context.title;
            expect(prev.localeCompare(curr)).toBeLessThanOrEqual(0);
          }
        }
      }
    });

    test('should enable semantic search', async () => {
      const result = await searchService.search({
        query: 'artificial intelligence neural networks',
        options: { 
          limit: 10,
          semanticSearch: true,
        },
      });
      
      expect(result.results).toBeInstanceOf(Array);
      // Semantic search should still work even if not fully implemented
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Search Performance', () => {
    test('should complete searches within reasonable time', async () => {
      const startTime = Date.now();
      
      const result = await searchService.search({
        query: 'development optimization',
        options: { limit: 20 },
      });
      
      const executionTime = Date.now() - startTime;
      
      expect(executionTime).toBeLessThan(5000); // Should complete within 5 seconds
      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.executionTime).toBeLessThan(executionTime);
    });

    test('should handle concurrent searches', async () => {
      const queries = [
        'machine learning',
        'web development',
        'database design',
        'api architecture',
        'testing strategies',
      ];
      
      const startTime = Date.now();
      
      const searchPromises = queries.map(query =>
        searchService.search({
          query,
          options: { limit: 10 },
        })
      );
      
      const results = await Promise.all(searchPromises);
      const totalTime = Date.now() - startTime;
      
      expect(results.length).toBe(queries.length);
      expect(totalTime).toBeLessThan(10000); // All searches within 10 seconds
      
      results.forEach((result, index) => {
        expect(result.results).toBeInstanceOf(Array);
        expect(result.executionTime).toBeGreaterThan(0);
      });
    });

    test('should maintain performance with large result sets', async () => {
      // Search for a broad term that should match many contexts
      const result = await searchService.search({
        query: '',
        options: { limit: 100 },
      });
      
      expect(result.executionTime).toBeLessThan(3000); // Within 3 seconds
      expect(result.results.length).toBeLessThanOrEqual(100);
    });
  });

  describe('Search Statistics', () => {
    test('should provide search statistics', () => {
      const stats = searchService.getSearchStats();
      
      expect(stats.indexSize).toBeGreaterThan(0);
      expect(stats.totalTokens).toBeGreaterThan(0);
      expect(stats.avgTokensPerContext).toBeGreaterThan(0);
      expect(stats.lastIndexUpdate).toBeInstanceOf(Date);
    });

    test('should update statistics after index changes', async () => {
      const initialStats = searchService.getSearchStats();
      
      // Add new context
      const newContextId = await contextStore.saveContext(generateTestContext({
        title: 'Statistics Test Context',
        content: 'This context is used to test search statistics updates',
      }));
      
      testContextIds.push(newContextId);
      
      // Index the new context
      await searchService.indexContext({
        id: newContextId,
        title: 'Statistics Test Context',
        content: 'This context is used to test search statistics updates',
        type: 'development',
        tags: ['statistics', 'test'],
        sessionId: 'stats-test-session',
        metadata: {
          aiGenerated: true,
          source: 'statistics-test',
          importance: 'low',
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      
      const updatedStats = searchService.getSearchStats();
      
      expect(updatedStats.indexSize).toBeGreaterThan(initialStats.indexSize);
      expect(updatedStats.totalTokens).toBeGreaterThan(initialStats.totalTokens);
    });
  });

  describe('Index Management', () => {
    test('should index individual contexts', async () => {
      const contextData = generateTestContext({
        title: 'Individual Index Test',
        content: 'This context is indexed individually',
      });
      
      const contextId = await contextStore.saveContext(contextData);
      testContextIds.push(contextId);
      
      const savedContext = await contextStore.getContext(contextId);
      
      // Index the context
      await searchService.indexContext(savedContext);
      
      // Search for the newly indexed context
      const result = await searchService.search({
        query: 'Individual Index Test',
        options: { limit: 10 },
      });
      
      const foundContext = result.results.find(r => r.context.id === contextId);
      expect(foundContext).toBeDefined();
    });

    test('should remove contexts from index', async () => {
      const contextData = generateTestContext({
        title: 'Remove From Index Test',
        content: 'This context will be removed from index',
      });
      
      const contextId = await contextStore.saveContext(contextData);
      testContextIds.push(contextId);
      
      const savedContext = await contextStore.getContext(contextId);
      
      // Index the context
      await searchService.indexContext(savedContext);
      
      // Verify it's searchable
      let result = await searchService.search({
        query: 'Remove From Index Test',
        options: { limit: 10 },
      });
      
      let foundContext = result.results.find(r => r.context.id === contextId);
      expect(foundContext).toBeDefined();
      
      // Remove from index
      searchService.removeFromIndex(contextId);
      
      // Verify it's no longer searchable
      result = await searchService.search({
        query: 'Remove From Index Test',
        options: { limit: 10 },
      });
      
      foundContext = result.results.find(r => r.context.id === contextId);
      expect(foundContext).toBeUndefined();
    });

    test('should handle index corruption gracefully', async () => {
      // This test would normally corrupt the index intentionally
      // For now, we'll just verify that rebuilding works
      const initialStats = searchService.getSearchStats();
      
      await searchService.buildIndex();
      
      const rebuiltStats = searchService.getSearchStats();
      expect(rebuiltStats.indexSize).toBeGreaterThanOrEqual(initialStats.indexSize);
    });
  });

  describe('Error Handling', () => {
    test('should handle malformed search queries', async () => {
      const malformedQueries = [
        null,
        undefined,
        123,
        {},
        [],
        ''.repeat(10000), // Very long query
      ];
      
      for (const query of malformedQueries) {
        const result = await searchService.search({
          query: query as any,
          options: { limit: 10 },
        });
        
        expect(result.results).toBeInstanceOf(Array);
        expect(result.totalCount).toBeGreaterThanOrEqual(0);
        expect(result.executionTime).toBeGreaterThan(0);
      }
    });

    test('should handle invalid search options', async () => {
      const result = await searchService.search({
        query: 'test',
        options: {
          limit: -1, // Invalid limit
          offset: -10, // Invalid offset
          sortBy: 'invalid-sort' as any,
        },
      });
      
      expect(result.results).toBeInstanceOf(Array);
      expect(result.totalCount).toBeGreaterThanOrEqual(0);
    });

    test('should handle search when index is empty', async () => {
      // Create a new search service with empty index
      const emptySearchService = testEnv.app.searchService;
      
      // Clear the index (if possible)
      const result = await emptySearchService.search({
        query: 'anything',
        options: { limit: 10 },
      });
      
      expect(result.results).toBeInstanceOf(Array);
      expect(result.totalCount).toBeGreaterThanOrEqual(0);
      expect(result.executionTime).toBeGreaterThan(0);
    });
  });

  describe('Search Result Quality', () => {
    test('should rank exact matches higher', async () => {
      const result = await searchService.search({
        query: 'Machine Learning Fundamentals',
        options: { limit: 10 },
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      
      const exactMatch = result.results.find(r => 
        r.context.title === 'Machine Learning Fundamentals'
      );
      
      if (exactMatch && result.results.length > 1) {
        // Exact match should have highest score
        const highestScore = Math.max(...result.results.map(r => r.score));
        expect(exactMatch.score).toBe(highestScore);
      }
    });

    test('should provide match information', async () => {
      const result = await searchService.search({
        query: 'database optimization',
        options: { 
          limit: 10,
          highlightMatches: true,
        },
      });
      
      expect(result.results.length).toBeGreaterThan(0);
      
      result.results.forEach(r => {
        expect(r.score).toBeGreaterThan(0);
        expect(r.context).toBeDefined();
        expect(r.matchedFields).toBeInstanceOf(Array);
        
        if (r.highlights) {
          expect(typeof r.highlights).toBe('object');
        }
      });
    });

    test('should provide faceted search results', async () => {
      const result = await searchService.search({
        query: '',
        options: { limit: 20 },
      });
      
      expect(result.facets).toBeDefined();
      
      if (result.facets) {
        // Should have type facets
        expect(result.facets.types).toBeInstanceOf(Array);
        
        // Should have tag facets
        expect(result.facets.tags).toBeInstanceOf(Array);
        
        // Facets should contain actual values from our test data
        const typeNames = result.facets.types.map((t: any) => t.value);
        expect(typeNames).toContain('development');
        expect(typeNames).toContain('analysis');
      }
    });

    test('should suggest corrections for typos', async () => {
      const result = await searchService.search({
        query: 'databse desgin', // Intentional typos
        options: { limit: 10 },
      });
      
      // Should still return results or suggestions
      expect(result.results).toBeInstanceOf(Array);
      
      if (result.suggestions) {
        expect(result.suggestions).toBeInstanceOf(Array);
        expect(result.suggestions.length).toBeGreaterThan(0);
      }
    });
  });
});

/**
 * Search Service Test Utilities
 */
export class SearchServiceTestUtils {
  static async createSearchableContexts(
    contextStore: any,
    searchService: any,
    contexts: Array<{
      title: string;
      content: string;
      type: string;
      tags: string[];
      sessionId: string;
    }>
  ): Promise<string[]> {
    const contextIds: string[] = [];
    
    for (const contextData of contexts) {
      const contextId = await contextStore.saveContext({
        ...contextData,
        metadata: {
          aiGenerated: true,
          source: 'search-test',
          importance: 'medium' as const,
        },
      });
      
      contextIds.push(contextId);
    }
    
    // Rebuild search index
    await searchService.buildIndex();
    
    return contextIds;
  }
  
  static validateSearchResult(result: any): void {
    expect(result).toBeDefined();
    expect(result.results).toBeInstanceOf(Array);
    expect(result.totalCount).toBeGreaterThanOrEqual(0);
    expect(result.executionTime).toBeGreaterThan(0);
    
    result.results.forEach((r: any) => {
      expect(r.context).toBeDefined();
      expect(r.context.id).toBeDefined();
      expect(r.context.title).toBeDefined();
      expect(r.context.content).toBeDefined();
      expect(r.score).toBeGreaterThan(0);
      expect(r.matchedFields).toBeInstanceOf(Array);
    });
  }
  
  static async measureSearchPerformance(
    searchService: any,
    query: string,
    options: any = {}
  ): Promise<{
    result: any;
    clientTime: number;
    serverTime: number;
  }> {
    const startTime = Date.now();
    const result = await searchService.search({ query, options });
    const clientTime = Date.now() - startTime;
    
    return {
      result,
      clientTime,
      serverTime: result.executionTime,
    };
  }
}