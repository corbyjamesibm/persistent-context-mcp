/**
 * API Endpoints End-to-End Tests
 * Tests all HTTP API endpoints comprehensively
 */

import request from 'supertest';
import { setupTestEnvironment, setupTestData } from '../setup/test-environment.js';
import { logger } from '../../utils/logger.js';

describe('API Endpoints End-to-End Tests', () => {
  let testEnv: Awaited<ReturnType<typeof setupTestEnvironment>>;
  let testData: Awaited<ReturnType<typeof setupTestData>>;
  let app: any;

  beforeAll(async () => {
    testEnv = await setupTestEnvironment({
      enablePerformanceMonitoring: true,
      enableBackups: true,
      testDatabaseSuffix: 'e2e_api_endpoints',
    });
    
    testData = await setupTestData(testEnv.app);
    app = testEnv.server;
    
    logger.info('API endpoints test environment initialized');
  }, 30000);

  afterAll(async () => {
    await testEnv.cleanup();
  }, 15000);

  describe('Context API Endpoints', () => {
    describe('POST /api/v1/contexts', () => {
      test('should create new context successfully', async () => {
        const contextData = {
          title: 'API Test Context',
          content: 'This is a test context created via API',
          type: 'development',
          tags: ['api', 'test', 'endpoint'],
          sessionId: 'api-test-session',
          metadata: {
            aiGenerated: false,
            source: 'api-test',
            importance: 'medium',
          },
        };

        const response = await request(app)
          .post('/api/v1/contexts')
          .send(contextData)
          .expect(201);

        expect(response.body.data).toBeDefined();
        expect(response.body.data.id).toBeDefined();
        expect(response.body.data.title).toBe(contextData.title);
        expect(response.body.data.content).toBe(contextData.content);
        expect(response.body.data.type).toBe(contextData.type);
        expect(response.body.data.tags).toEqual(contextData.tags);
        expect(response.body.data.sessionId).toBe(contextData.sessionId);
        expect(response.body.data.createdAt).toBeDefined();
        expect(response.body.data.updatedAt).toBeDefined();
      });

      test('should handle invalid context data', async () => {
        const invalidData = {
          // Missing required fields
          title: '',
          content: '',
          type: 'invalid-type',
        };

        await request(app)
          .post('/api/v1/contexts')
          .send(invalidData)
          .expect(500); // Should return error for invalid data
      });

      test('should handle large context data', async () => {
        const largeContextData = {
          title: 'Large Context Test',
          content: 'Large content: ' + 'x'.repeat(50000),
          type: 'general',
          tags: Array.from({ length: 20 }, (_, i) => `tag-${i}`),
          sessionId: 'large-context-session',
          metadata: {
            aiGenerated: true,
            source: 'large-context-test',
            importance: 'low',
          },
        };

        const response = await request(app)
          .post('/api/v1/contexts')
          .send(largeContextData)
          .expect(201);

        expect(response.body.data.content.length).toBeGreaterThan(50000);
        expect(response.body.data.tags.length).toBe(20);
      });
    });

    describe('GET /api/v1/contexts', () => {
      test('should list contexts without query', async () => {
        const response = await request(app)
          .get('/api/v1/contexts')
          .expect(200);

        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThan(0);
        
        if (response.body.data.length > 0) {
          const context = response.body.data[0];
          expect(context.id).toBeDefined();
          expect(context.title).toBeDefined();
          expect(context.content).toBeDefined();
          expect(context.type).toBeDefined();
        }
      });

      test('should search contexts with query parameter', async () => {
        const response = await request(app)
          .get('/api/v1/contexts')
          .query({ q: 'test' })
          .expect(200);

        expect(response.body.data).toBeInstanceOf(Array);
        
        response.body.data.forEach((context: any) => {
          const hasMatch = 
            context.title.toLowerCase().includes('test') ||
            context.content.toLowerCase().includes('test') ||
            context.tags.some((tag: string) => tag.toLowerCase().includes('test'));
          expect(hasMatch).toBe(true);
        });
      });

      test('should filter contexts by type', async () => {
        const response = await request(app)
          .get('/api/v1/contexts')
          .query({ type: 'development' })
          .expect(200);

        expect(response.body.data).toBeInstanceOf(Array);
        
        response.body.data.forEach((context: any) => {
          expect(context.type).toBe('development');
        });
      });

      test('should handle pagination parameters', async () => {
        const firstPage = await request(app)
          .get('/api/v1/contexts')
          .query({ limit: 2, offset: 0 })
          .expect(200);

        const secondPage = await request(app)
          .get('/api/v1/contexts')
          .query({ limit: 2, offset: 2 })
          .expect(200);

        expect(firstPage.body.data.length).toBeLessThanOrEqual(2);
        expect(secondPage.body.data.length).toBeLessThanOrEqual(2);

        // Ensure different results
        if (firstPage.body.data.length > 0 && secondPage.body.data.length > 0) {
          const firstPageIds = firstPage.body.data.map((c: any) => c.id);
          const secondPageIds = secondPage.body.data.map((c: any) => c.id);
          const overlap = firstPageIds.filter((id: string) => secondPageIds.includes(id));
          expect(overlap.length).toBe(0);
        }
      });
    });

    describe('GET /api/v1/contexts/:id', () => {
      test('should retrieve existing context by ID', async () => {
        const contextId = testData.contexts[0].id;

        const response = await request(app)
          .get(`/api/v1/contexts/${contextId}`)
          .expect(200);

        expect(response.body.data).toBeDefined();
        expect(response.body.data.id).toBe(contextId);
        expect(response.body.data.title).toBeDefined();
        expect(response.body.data.content).toBeDefined();
      });

      test('should return 404 for non-existent context', async () => {
        await request(app)
          .get('/api/v1/contexts/non-existent-id')
          .expect(404);
      });

      test('should include all context properties', async () => {
        const contextId = testData.contexts[0].id;

        const response = await request(app)
          .get(`/api/v1/contexts/${contextId}`)
          .expect(200);

        const context = response.body.data;
        expect(context.id).toBeDefined();
        expect(context.title).toBeDefined();
        expect(context.content).toBeDefined();
        expect(context.type).toBeDefined();
        expect(context.tags).toBeInstanceOf(Array);
        expect(context.sessionId).toBeDefined();
        expect(context.metadata).toBeDefined();
        expect(context.createdAt).toBeDefined();
        expect(context.updatedAt).toBeDefined();
      });
    });

    describe('PUT /api/v1/contexts/:id', () => {
      let testContextId: string;

      beforeEach(async () => {
        // Create a context for updating
        const response = await request(app)
          .post('/api/v1/contexts')
          .send({
            title: 'Context for Update Test',
            content: 'Original content for update testing',
            type: 'general',
            tags: ['update-test', 'original'],
            sessionId: 'update-test-session',
            metadata: {
              aiGenerated: false,
              source: 'update-test',
              importance: 'low',
            },
          });

        testContextId = response.body.data.id;
      });

      test('should update context successfully', async () => {
        const updates = {
          title: 'Updated Context Title',
          content: 'Updated content for testing',
          tags: ['update-test', 'updated'],
        };

        const response = await request(app)
          .put(`/api/v1/contexts/${testContextId}`)
          .send(updates)
          .expect(200);

        expect(response.body.data.id).toBe(testContextId);
        expect(response.body.data.title).toBe(updates.title);
        expect(response.body.data.content).toBe(updates.content);
        expect(response.body.data.tags).toEqual(updates.tags);
        
        // Updated timestamp should be different from created timestamp
        expect(new Date(response.body.data.updatedAt).getTime()).toBeGreaterThan(
          new Date(response.body.data.createdAt).getTime()
        );
      });

      test('should handle partial updates', async () => {
        const partialUpdate = {
          title: 'Partially Updated Title',
        };

        const response = await request(app)
          .put(`/api/v1/contexts/${testContextId}`)
          .send(partialUpdate)
          .expect(200);

        expect(response.body.data.title).toBe(partialUpdate.title);
        expect(response.body.data.content).toBe('Original content for update testing'); // Unchanged
      });

      test('should return 404 for non-existent context', async () => {
        await request(app)
          .put('/api/v1/contexts/non-existent-id')
          .send({ title: 'Updated Title' })
          .expect(404);
      });

      test('should validate update data', async () => {
        const invalidUpdate = {
          type: 'invalid-type',
        };

        await request(app)
          .put(`/api/v1/contexts/${testContextId}`)
          .send(invalidUpdate)
          .expect(500); // Should validate and reject invalid data
      });
    });
  });

  describe('Session Management Endpoints', () => {
    describe('POST /api/v1/contexts/save', () => {
      test('should save context immediately', async () => {
        const contextData = {
          sessionId: 'immediate-save-session',
          title: 'Immediate Save Test',
          content: 'Testing immediate save functionality',
          type: 'development',
          tags: ['immediate-save'],
          metadata: {
            aiGenerated: true,
            source: 'immediate-save-test',
            importance: 'medium',
          },
        };

        const response = await request(app)
          .post('/api/v1/contexts/save')
          .send(contextData)
          .expect(201);

        expect(response.body.data.contextId).toBeDefined();
        expect(response.body.message).toBe('Context saved successfully');
      });

      test('should require sessionId', async () => {
        const contextData = {
          // Missing sessionId
          title: 'Missing Session ID Test',
          content: 'Testing missing session ID',
          type: 'general',
        };

        await request(app)
          .post('/api/v1/contexts/save')
          .send(contextData)
          .expect(400);
      });
    });

    describe('GET /api/v1/sessions/recent', () => {
      beforeAll(async () => {
        // Create some contexts in different sessions
        const sessions = ['recent-session-1', 'recent-session-2', 'recent-session-3'];
        
        for (const sessionId of sessions) {
          await request(app)
            .post('/api/v1/contexts')
            .send({
              title: `Context for ${sessionId}`,
              content: `Content for session ${sessionId}`,
              type: 'general',
              tags: ['recent-session-test'],
              sessionId,
              metadata: {
                aiGenerated: true,
                source: 'recent-session-test',
                importance: 'low',
              },
            });
        }
      });

      test('should return recent sessions', async () => {
        const response = await request(app)
          .get('/api/v1/sessions/recent')
          .expect(200);

        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBeGreaterThan(0);

        if (response.body.data.length > 0) {
          const session = response.body.data[0];
          expect(session.sessionId).toBeDefined();
          expect(session.lastActivity).toBeDefined();
          expect(session.contextCount).toBeGreaterThanOrEqual(0);
        }
      });

      test('should respect limit parameter', async () => {
        const limit = 2;
        const response = await request(app)
          .get('/api/v1/sessions/recent')
          .query({ limit })
          .expect(200);

        expect(response.body.data.length).toBeLessThanOrEqual(limit);
      });
    });

    describe('POST /api/v1/sessions/:sessionId/resume', () => {
      let testSessionId: string;

      beforeAll(async () => {
        testSessionId = 'resume-test-session';
        
        // Create a context in the session
        await request(app)
          .post('/api/v1/contexts')
          .send({
            title: 'Resume Test Context',
            content: 'Context for resume testing',
            type: 'development',
            tags: ['resume-test'],
            sessionId: testSessionId,
            metadata: {
              aiGenerated: false,
              source: 'resume-test',
              importance: 'high',
            },
          });
      });

      test('should resume existing session', async () => {
        const response = await request(app)
          .post(`/api/v1/sessions/${testSessionId}/resume`)
          .expect(200);

        expect(response.body.data).toBeDefined();
        expect(response.body.data.sessionId).toBe(testSessionId);
        expect(response.body.message).toBe('Session resumed successfully');
      });

      test('should handle non-existent session', async () => {
        await request(app)
          .post('/api/v1/sessions/non-existent-session/resume')
          .expect(404);
      });
    });

    describe('GET /api/v1/sessions/:sessionId/contexts', () => {
      let testSessionId: string;

      beforeAll(async () => {
        testSessionId = 'session-contexts-test';
        
        // Create multiple contexts in the session
        for (let i = 1; i <= 3; i++) {
          await request(app)
            .post('/api/v1/contexts')
            .send({
              title: `Session Context ${i}`,
              content: `Content for session context ${i}`,
              type: 'general',
              tags: ['session-contexts-test'],
              sessionId: testSessionId,
              metadata: {
                aiGenerated: true,
                source: 'session-contexts-test',
                importance: 'medium',
              },
            });
        }
      });

      test('should return contexts for session', async () => {
        const response = await request(app)
          .get(`/api/v1/sessions/${testSessionId}/contexts`)
          .expect(200);

        expect(response.body.data).toBeInstanceOf(Array);
        expect(response.body.data.length).toBe(3);

        response.body.data.forEach((context: any) => {
          expect(context.sessionId).toBe(testSessionId);
          expect(context.tags).toContain('session-contexts-test');
        });
      });

      test('should respect limit parameter', async () => {
        const response = await request(app)
          .get(`/api/v1/sessions/${testSessionId}/contexts`)
          .query({ limit: 2 })
          .expect(200);

        expect(response.body.data.length).toBe(2);
      });
    });

    describe('GET /api/v1/system/status', () => {
      test('should return system status', async () => {
        const response = await request(app)
          .get('/api/v1/system/status')
          .expect(200);

        expect(response.body.data).toBeDefined();
        expect(response.body.data.isActive).toBeDefined();
        expect(response.body.data.pendingContexts).toBeGreaterThanOrEqual(0);
        expect(response.body.data.activeSessions).toBeGreaterThanOrEqual(0);
      });
    });
  });

  describe('Health Monitoring Endpoints', () => {
    describe('GET /health', () => {
      test('should return basic health status', async () => {
        const response = await request(app)
          .get('/health')
          .expect(200);

        expect(response.body.status).toBe('healthy');
        expect(response.body.timestamp).toBeDefined();
        expect(response.body.service).toBe('persistent-context-store');
      });
    });

    describe('GET /health/detailed', () => {
      test('should return detailed health information', async () => {
        const response = await request(app)
          .get('/health/detailed')
          .expect(200);

        expect(response.body.status).toMatch(/healthy|warning|critical/);
        expect(response.body.checks).toBeInstanceOf(Array);
        expect(response.body.checks.length).toBeGreaterThan(0);
        expect(response.body.metrics).toBeDefined();
        expect(response.body.timestamp).toBeDefined();

        // Verify check structure
        response.body.checks.forEach((check: any) => {
          expect(check.name).toBeDefined();
          expect(check.status).toMatch(/healthy|warning|critical|unknown/);
          expect(check.message).toBeDefined();
          expect(check.responseTime).toBeGreaterThanOrEqual(0);
        });
      });
    });

    describe('GET /health/ready', () => {
      test('should return readiness status', async () => {
        const response = await request(app)
          .get('/health/ready')
          .expect(200);

        expect(response.body.ready).toBe(true);
        expect(response.body.timestamp).toBeDefined();
        expect(response.body.checks).toBeInstanceOf(Array);
      });
    });

    describe('GET /health/live', () => {
      test('should return liveness status', async () => {
        const response = await request(app)
          .get('/health/live')
          .expect(200);

        expect(response.body.alive).toBe(true);
        expect(response.body.timestamp).toBeDefined();
        expect(response.body.uptime).toBeGreaterThan(0);
      });
    });

    describe('GET /health/metrics', () => {
      test('should return health metrics', async () => {
        const response = await request(app)
          .get('/health/metrics')
          .expect(200);

        expect(response.body.metrics).toBeDefined();
        expect(response.body.metrics.memory).toBeDefined();
        expect(response.body.metrics.database).toBeDefined();
        expect(response.body.metrics.services).toBeDefined();
      });
    });

    describe('GET /health/prometheus', () => {
      test('should return Prometheus-formatted metrics', async () => {
        const response = await request(app)
          .get('/health/prometheus')
          .expect(200);

        expect(response.text).toContain('# HELP');
        expect(response.text).toContain('# TYPE');
        expect(response.text).toContain('context_store_');
        expect(response.headers['content-type']).toContain('text/plain');
      });
    });
  });

  describe('Performance Monitoring Endpoints', () => {
    describe('GET /performance/metrics', () => {
      test('should return current performance metrics', async () => {
        const response = await request(app)
          .get('/performance/metrics')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.responseTime).toBeDefined();
        expect(response.body.data.throughput).toBeDefined();
        expect(response.body.data.resources).toBeDefined();
        expect(response.body.data.database).toBeDefined();
        expect(response.body.data.operations).toBeDefined();
      });
    });

    describe('GET /performance/history', () => {
      test('should return performance history', async () => {
        const response = await request(app)
          .get('/performance/history')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.history).toBeInstanceOf(Array);
        expect(response.body.data.totalRecords).toBeGreaterThanOrEqual(0);
        expect(response.body.data.limit).toBeDefined();
      });

      test('should respect limit parameter', async () => {
        const limit = 5;
        const response = await request(app)
          .get('/performance/history')
          .query({ limit })
          .expect(200);

        expect(response.body.data.history.length).toBeLessThanOrEqual(limit);
        expect(response.body.data.limit).toBe(limit);
      });
    });

    describe('POST /performance/load-test', () => {
      test('should run load test successfully', async () => {
        const loadTestConfig = {
          concurrentUsers: 2,
          duration: 3000,
          rampUpTime: 500,
        };

        const response = await request(app)
          .post('/performance/load-test')
          .send(loadTestConfig)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.testId).toBeDefined();
        expect(response.body.data.results).toBeDefined();
        expect(response.body.data.results.totalRequests).toBeGreaterThan(0);
        expect(response.body.data.results.successRate).toBeDefined();
      }, 10000);

      test('should validate load test parameters', async () => {
        const invalidConfig = {
          concurrentUsers: 1000, // Exceeds maximum
          duration: 500, // Too short
          rampUpTime: 400000, // Too long
        };

        await request(app)
          .post('/performance/load-test')
          .send(invalidConfig)
          .expect(400);
      });

      test('should handle missing parameters with defaults', async () => {
        const response = await request(app)
          .post('/performance/load-test')
          .send({})
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.testId).toBeDefined();
      }, 10000);
    });

    describe('GET /performance/analyze', () => {
      test('should analyze performance and return recommendations', async () => {
        const response = await request(app)
          .get('/performance/analyze')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.analysis).toBeDefined();
        expect(response.body.data.recommendations).toBeInstanceOf(Array);
        expect(response.body.data.analysis.totalRecommendations).toBe(
          response.body.data.recommendations.length
        );

        if (response.body.data.recommendations.length > 0) {
          const recommendation = response.body.data.recommendations[0];
          expect(recommendation.category).toBeDefined();
          expect(recommendation.severity).toMatch(/low|medium|high|critical/);
          expect(recommendation.title).toBeDefined();
          expect(recommendation.description).toBeDefined();
          expect(recommendation.recommendation).toBeDefined();
        }
      });
    });

    describe('DELETE /performance/history', () => {
      test('should clear performance history', async () => {
        const response = await request(app)
          .delete('/performance/history')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Performance history cleared successfully');

        // Verify history is cleared
        const historyResponse = await request(app)
          .get('/performance/history')
          .expect(200);

        expect(historyResponse.body.data.history.length).toBe(0);
      });
    });

    describe('GET /performance/status', () => {
      test('should return performance monitoring status', async () => {
        const response = await request(app)
          .get('/performance/status')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data.monitoring).toBeDefined();
        expect(response.body.data.currentStatus).toBeDefined();
        expect(response.body.data.thresholds).toBeDefined();
      });
    });

    describe('POST /performance/monitoring/start', () => {
      test('should start performance monitoring', async () => {
        const response = await request(app)
          .post('/performance/monitoring/start')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Performance monitoring started');
      });
    });

    describe('POST /performance/monitoring/stop', () => {
      test('should stop performance monitoring', async () => {
        const response = await request(app)
          .post('/performance/monitoring/stop')
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Performance monitoring stopped');
      });
    });

    describe('GET /performance/prometheus', () => {
      test('should return Prometheus-formatted performance metrics', async () => {
        const response = await request(app)
          .get('/performance/prometheus')
          .expect(200);

        expect(response.text).toContain('# HELP context_store_response_time_seconds');
        expect(response.text).toContain('# TYPE context_store_response_time_seconds');
        expect(response.text).toContain('context_store_memory_usage_percent');
        expect(response.text).toContain('context_store_requests_per_second');
        expect(response.headers['content-type']).toContain('text/plain');
      });
    });
  });

  describe('Error Handling and Edge Cases', () => {
    test('should handle malformed JSON requests', async () => {
      const response = await request(app)
        .post('/api/v1/contexts')
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);

      expect(response.body.error).toBeDefined();
    });

    test('should handle requests with unsupported Content-Type', async () => {
      await request(app)
        .post('/api/v1/contexts')
        .set('Content-Type', 'text/plain')
        .send('plain text content')
        .expect(400);
    });

    test('should handle very large request bodies', async () => {
      const largeContent = 'x'.repeat(12 * 1024 * 1024); // 12MB (exceeds 10MB limit)

      await request(app)
        .post('/api/v1/contexts')
        .send({
          title: 'Large Content Test',
          content: largeContent,
          type: 'general',
          sessionId: 'large-content-session',
        })
        .expect(413); // Payload too large
    });

    test('should handle invalid URL parameters', async () => {
      await request(app)
        .get('/api/v1/contexts/invalid%20id%20with%20spaces')
        .expect(404);
    });

    test('should handle SQL injection attempts', async () => {
      const maliciousQuery = "'; DROP TABLE contexts; --";

      const response = await request(app)
        .get('/api/v1/contexts')
        .query({ q: maliciousQuery })
        .expect(200);

      // Should return safe results, not crash
      expect(response.body.data).toBeInstanceOf(Array);
    });

    test('should handle XSS attempts in context content', async () => {
      const xssContent = '<script>alert("XSS")</script>';

      const response = await request(app)
        .post('/api/v1/contexts')
        .send({
          title: 'XSS Test Context',
          content: xssContent,
          type: 'general',
          sessionId: 'xss-test-session',
          metadata: {
            aiGenerated: false,
            source: 'xss-test',
            importance: 'low',
          },
        })
        .expect(201);

      // Content should be stored as-is (XSS prevention happens on frontend)
      expect(response.body.data.content).toBe(xssContent);
    });

    test('should handle concurrent requests safely', async () => {
      const requests = Array.from({ length: 10 }, (_, i) =>
        request(app)
          .post('/api/v1/contexts')
          .send({
            title: `Concurrent Request ${i}`,
            content: `Content for concurrent request ${i}`,
            type: 'development',
            sessionId: `concurrent-session-${i}`,
            tags: ['concurrent-test'],
            metadata: {
              aiGenerated: true,
              source: 'concurrent-test',
              importance: 'low',
            },
          })
      );

      const responses = await Promise.all(requests);

      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body.data.title).toBe(`Concurrent Request ${index}`);
      });

      // Verify all contexts were created with unique IDs
      const contextIds = responses.map(r => r.body.data.id);
      const uniqueIds = new Set(contextIds);
      expect(uniqueIds.size).toBe(contextIds.length);
    });
  });

  describe('CORS and Security Headers', () => {
    test('should include security headers', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      // Helmet security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBeDefined();
      expect(response.headers['x-xss-protection']).toBeDefined();
    });

    test('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/v1/contexts')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'POST')
        .set('Access-Control-Request-Headers', 'Content-Type')
        .expect(204);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
      expect(response.headers['access-control-allow-methods']).toBeDefined();
      expect(response.headers['access-control-allow-headers']).toBeDefined();
    });

    test('should handle CORS for actual requests', async () => {
      const response = await request(app)
        .get('/api/v1/contexts')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBeDefined();
    });
  });

  describe('Rate Limiting and Performance', () => {
    test('should handle multiple rapid requests', async () => {
      const rapidRequests = Array.from({ length: 20 }, () =>
        request(app).get('/health')
      );

      const responses = await Promise.all(rapidRequests);

      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    test('should maintain response times under load', async () => {
      const startTime = Date.now();
      
      const loadRequests = Array.from({ length: 50 }, (_, i) =>
        request(app)
          .get('/api/v1/contexts')
          .query({ q: `load-test-${i % 10}` })
      );

      const responses = await Promise.all(loadRequests);
      const totalTime = Date.now() - startTime;

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Should complete within reasonable time
      expect(totalTime).toBeLessThan(15000); // 15 seconds
      
      // Average response time should be reasonable
      const averageTime = totalTime / responses.length;
      expect(averageTime).toBeLessThan(300); // 300ms average
    }, 20000);
  });

  describe('Content Compression', () => {
    test('should compress large responses', async () => {
      const response = await request(app)
        .get('/api/v1/contexts')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // Should include compression header for large responses
      if (JSON.stringify(response.body).length > 1000) {
        expect(response.headers['content-encoding']).toBeDefined();
      }
    });

    test('should handle requests without compression support', async () => {
      const response = await request(app)
        .get('/api/v1/contexts')
        .expect(200);

      expect(response.body.data).toBeInstanceOf(Array);
    });
  });
});

/**
 * API Test Utilities
 */
export class ApiTestUtils {
  static async createTestContext(app: any, overrides: any = {}): Promise<any> {
    const contextData = {
      title: 'Test Context',
      content: 'Test content for API testing',
      type: 'general',
      tags: ['api-test'],
      sessionId: 'api-test-session',
      metadata: {
        aiGenerated: true,
        source: 'api-test',
        importance: 'medium',
      },
      ...overrides,
    };

    const response = await request(app)
      .post('/api/v1/contexts')
      .send(contextData)
      .expect(201);

    return response.body.data;
  }

  static async testEndpointPerformance(
    app: any,
    endpoint: string,
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
    payload?: any
  ): Promise<{
    responseTime: number;
    statusCode: number;
    success: boolean;
  }> {
    const startTime = Date.now();
    
    let response;
    switch (method) {
      case 'GET':
        response = await request(app).get(endpoint);
        break;
      case 'POST':
        response = await request(app).post(endpoint).send(payload || {});
        break;
      case 'PUT':
        response = await request(app).put(endpoint).send(payload || {});
        break;
      case 'DELETE':
        response = await request(app).delete(endpoint);
        break;
    }
    
    const responseTime = Date.now() - startTime;
    
    return {
      responseTime,
      statusCode: response.status,
      success: response.status >= 200 && response.status < 300,
    };
  }

  static validateApiResponse(response: any, expectedStatus: number = 200): void {
    expect(response.status).toBe(expectedStatus);
    
    if (expectedStatus >= 200 && expectedStatus < 300) {
      expect(response.body).toBeDefined();
      
      if (response.body.data) {
        expect(response.body.data).toBeDefined();
      }
    } else {
      expect(response.body.error).toBeDefined();
    }
  }

  static async testConcurrentRequests(
    app: any,
    requestFactory: () => Promise<any>,
    concurrency: number = 10
  ): Promise<{
    responses: any[];
    totalTime: number;
    successRate: number;
  }> {
    const startTime = Date.now();
    const requests = Array.from({ length: concurrency }, requestFactory);
    
    const responses = await Promise.all(requests);
    const totalTime = Date.now() - startTime;
    
    const successfulResponses = responses.filter(r => r.status >= 200 && r.status < 300);
    const successRate = (successfulResponses.length / responses.length) * 100;
    
    return {
      responses,
      totalTime,
      successRate,
    };
  }
}