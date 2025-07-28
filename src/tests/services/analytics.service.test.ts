import { describe, test, expect, beforeEach, afterEach, vi, Mock } from 'vitest';
import { EventEmitter } from 'events';
import { AnalyticsService, AnalyticsQuery, ReportConfiguration } from '../../core/services/analytics.service.js';
import { ContextStore } from '../../core/context-store.js';
import { Logger } from '../../core/logger.js';
import { Context } from '../../core/types/context.js';

const mockContextStore = {
  getAllContexts: vi.fn(),
  getContext: vi.fn(),
  updateContext: vi.fn(),
} as unknown as ContextStore;

const mockLogger = {
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
} as unknown as Logger;

// Mock contexts for testing
const mockContexts: Context[] = [
  {
    id: '1',
    title: 'Test Context 1',
    content: 'This is a test context with some content',
    type: 'note',
    tags: ['test', 'example'],
    sessionId: 'session-1',
    createdAt: new Date('2024-01-01T10:00:00Z'),
    updatedAt: new Date('2024-01-01T10:00:00Z'),
    metadata: { userId: 'user1' },
  },
  {
    id: '2',
    title: 'Test Context 2',
    content: 'Another test context with different content and longer text to test token counting',
    type: 'analysis',
    tags: ['test', 'analysis', 'data'],
    sessionId: 'session-1',
    createdAt: new Date('2024-01-02T14:00:00Z'),
    updatedAt: new Date('2024-01-02T14:00:00Z'),
    metadata: { userId: 'user1' },
  },
  {
    id: '3',
    title: 'Test Context 3',
    content: 'A third context from a different user',
    type: 'note',
    tags: ['example', 'demo'],
    sessionId: 'session-2',
    createdAt: new Date('2024-01-03T09:00:00Z'),
    updatedAt: new Date('2024-01-03T09:00:00Z'),
    metadata: { userId: 'user2' },
  },
  {
    id: '4',
    title: 'Test Context 4',
    content: 'Fourth context for testing aggregation',
    type: 'research',
    tags: ['research', 'data'],
    sessionId: 'session-3',
    createdAt: new Date('2024-01-04T16:00:00Z'),
    updatedAt: new Date('2024-01-04T16:00:00Z'),
    metadata: { userId: 'user2' },
  },
];

describe('AnalyticsService', () => {
  let analyticsService: AnalyticsService;
  let originalDateNow: typeof Date.now;

  beforeEach(() => {
    // Mock Date.now to return a consistent timestamp
    originalDateNow = Date.now;
    Date.now = vi.fn(() => new Date('2024-01-05T12:00:00Z').getTime());

    // Clear all mocks
    vi.clearAllMocks();
    
    // Setup mock context store
    (mockContextStore.getAllContexts as Mock).mockResolvedValue(mockContexts);
    
    // Create service instance
    analyticsService = new AnalyticsService(mockContextStore, mockLogger);
  });

  afterEach(() => {
    Date.now = originalDateNow;
  });

  describe('Basic Analytics', () => {
    test('should calculate basic metrics correctly', async () => {
      const analytics = await analyticsService.getAnalytics();

      expect(analytics.totalContexts).toBe(4);
      expect(analytics.totalTokens).toBeGreaterThan(0);
      expect(analytics.activeUsers).toBe(2); // user1 and user2
      expect(analytics.uniqueSessions).toBe(3); // session-1, session-2, session-3
      expect(analytics.averageContextLength).toBe(analytics.totalTokens / analytics.totalContexts);
    });

    test('should group contexts by type correctly', async () => {
      const analytics = await analyticsService.getAnalytics();

      expect(analytics.contextsByType).toEqual({
        'note': 2,
        'analysis': 1,
        'research': 1,
      });
    });

    test('should aggregate tag counts correctly', async () => {
      const analytics = await analyticsService.getAnalytics();

      expect(analytics.contextsByTag).toEqual({
        'test': 2,
        'example': 2,
        'analysis': 1,
        'data': 2,
        'demo': 1,
        'research': 1,
      });
    });

    test('should calculate user activity correctly', async () => {
      const analytics = await analyticsService.getAnalytics();

      expect(analytics.userActivity).toHaveLength(2);
      
      const user1Activity = analytics.userActivity.find(u => u.userId === 'user1');
      const user2Activity = analytics.userActivity.find(u => u.userId === 'user2');

      expect(user1Activity).toBeDefined();
      expect(user1Activity?.contextCount).toBe(2);
      expect(user1Activity?.mostUsedTags).toContain('test');

      expect(user2Activity).toBeDefined();
      expect(user2Activity?.contextCount).toBe(2);
    });
  });

  describe('Filtering', () => {
    test('should filter by date range', async () => {
      const query: AnalyticsQuery = {
        startDate: new Date('2024-01-02T00:00:00Z'),
        endDate: new Date('2024-01-03T23:59:59Z'),
      };

      const analytics = await analyticsService.getAnalytics(query);

      expect(analytics.totalContexts).toBe(2); // contexts 2 and 3
    });

    test('should filter by user ID', async () => {
      const query: AnalyticsQuery = {
        userId: 'user1',
      };

      const analytics = await analyticsService.getAnalytics(query);

      expect(analytics.totalContexts).toBe(2);
      expect(analytics.activeUsers).toBe(1);
    });

    test('should filter by context type', async () => {
      const query: AnalyticsQuery = {
        contextType: 'note',
      };

      const analytics = await analyticsService.getAnalytics(query);

      expect(analytics.totalContexts).toBe(2);
      expect(analytics.contextsByType).toEqual({ 'note': 2 });
    });

    test('should filter by tags', async () => {
      const query: AnalyticsQuery = {
        tags: ['test'],
      };

      const analytics = await analyticsService.getAnalytics(query);

      expect(analytics.totalContexts).toBe(2);
      expect(analytics.contextsByTag.test).toBe(2);
    });
  });

  describe('Time Series Data', () => {
    test('should generate daily time series data', async () => {
      const analytics = await analyticsService.getAnalytics({
        aggregation: 'daily',
      });

      expect(analytics.timeSeriesData.daily).toHaveLength(4); // 4 different days
      
      const firstPoint = analytics.timeSeriesData.daily[0];
      expect(firstPoint).toHaveProperty('timestamp');
      expect(firstPoint).toHaveProperty('contextCount');
      expect(firstPoint).toHaveProperty('tokenCount');
    });

    test('should aggregate contexts by date correctly', async () => {
      const analytics = await analyticsService.getAnalytics({
        aggregation: 'daily',
      });

      // Each context is on a different day, so each should have count 1
      analytics.timeSeriesData.daily.forEach(point => {
        expect(point.contextCount).toBe(1);
      });
    });
  });

  describe('Report Generation', () => {
    test('should generate usage report', async () => {
      const config: ReportConfiguration = {
        type: 'usage',
        format: 'json',
      };

      const report = await analyticsService.generateReport(config);

      expect(report.id).toBeDefined();
      expect(report.type).toBe('usage');
      expect(report.format).toBe('json');
      expect(report.data).toHaveProperty('summary');
      expect(report.data).toHaveProperty('breakdown');
      expect(report.data).toHaveProperty('trends');
      expect(report.metadata).toHaveProperty('generatedAt');
      expect(report.metadata).toHaveProperty('recordCount');
    });

    test('should generate performance report', async () => {
      const config: ReportConfiguration = {
        type: 'performance',
        format: 'json',
      };

      const report = await analyticsService.generateReport(config);

      expect(report.type).toBe('performance');
      expect(report.data).toHaveProperty('performance');
      expect(report.data).toHaveProperty('usage');
      expect(report.data).toHaveProperty('efficiency');
    });

    test('should generate user activity report', async () => {
      const config: ReportConfiguration = {
        type: 'user-activity',
        format: 'json',
      };

      const report = await analyticsService.generateReport(config);

      expect(report.type).toBe('user-activity');
      expect(report.data).toHaveProperty('users');
      expect(report.data).toHaveProperty('summary');
      expect(Array.isArray(report.data.users)).toBe(true);
      expect(report.data.users).toHaveLength(2);
    });

    test('should generate content analysis report', async () => {
      const config: ReportConfiguration = {
        type: 'content-analysis',
        format: 'json',
      };

      const report = await analyticsService.generateReport(config);

      expect(report.type).toBe('content-analysis');
      expect(report.data).toHaveProperty('content');
      expect(report.data).toHaveProperty('tags');
      expect(report.data).toHaveProperty('trends');
      expect(report.data.tags).toHaveProperty('totalUniqueTags');
      expect(report.data.tags).toHaveProperty('mostPopular');
    });

    test('should convert data to CSV format', async () => {
      const config: ReportConfiguration = {
        type: 'user-activity',
        format: 'csv',
      };

      const report = await analyticsService.generateReport(config);

      expect(report.format).toBe('csv');
      expect(typeof report.data).toBe('string');
      expect(report.data).toContain('userId,contextCount');
      expect(report.data).toContain('user1');
      expect(report.data).toContain('user2');
    });
  });

  describe('Scheduled Reports', () => {
    test('should schedule a report', async () => {
      const config: ReportConfiguration = {
        type: 'usage',
        format: 'json',
        schedule: 'daily',
      };

      const reportId = await analyticsService.scheduleReport(config);

      expect(reportId).toBeDefined();
      expect(reportId).toMatch(/^scheduled_/);

      const scheduledReports = await analyticsService.getScheduledReports();
      expect(scheduledReports.has(reportId)).toBe(true);
      expect(scheduledReports.get(reportId)).toEqual(config);
    });

    test('should delete scheduled report', async () => {
      const config: ReportConfiguration = {
        type: 'usage',
        format: 'json',
        schedule: 'weekly',
      };

      const reportId = await analyticsService.scheduleReport(config);
      const deleted = await analyticsService.deleteScheduledReport(reportId);

      expect(deleted).toBe(true);

      const scheduledReports = await analyticsService.getScheduledReports();
      expect(scheduledReports.has(reportId)).toBe(false);
    });

    test('should return false when deleting non-existent report', async () => {
      const deleted = await analyticsService.deleteScheduledReport('non-existent-id');
      expect(deleted).toBe(false);
    });
  });

  describe('Performance Metrics', () => {
    test('should track request performance', () => {
      const initialMetrics = analyticsService.getPerformanceMetrics();
      expect(initialMetrics.totalRequests).toBe(0);
      expect(initialMetrics.averageResponseTime).toBe(0);

      analyticsService.recordRequest(100, true);
      analyticsService.recordRequest(200, true);
      analyticsService.recordRequest(150, false);

      const updatedMetrics = analyticsService.getPerformanceMetrics();
      expect(updatedMetrics.totalRequests).toBe(3);
      expect(updatedMetrics.averageResponseTime).toBe(150);
      expect(updatedMetrics.errorRate).toBeCloseTo(1/3, 2);
    });

    test('should update cache hit rate', () => {
      const initialMetrics = analyticsService.getPerformanceMetrics();
      expect(initialMetrics.cacheHitRate).toBe(0);

      analyticsService.updateCacheHitRate(0.85);

      const updatedMetrics = analyticsService.getPerformanceMetrics();
      expect(updatedMetrics.cacheHitRate).toBe(0.85);
    });
  });

  describe('Event Emission', () => {
    test('should emit analyticsGenerated event', async () => {
      const eventSpy = vi.fn();
      analyticsService.on('analyticsGenerated', eventSpy);

      const query: AnalyticsQuery = { aggregation: 'daily' };
      await analyticsService.getAnalytics(query);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          query,
          metrics: expect.any(Object),
          generatedAt: expect.any(Date),
        })
      );
    });

    test('should emit reportGenerated event', async () => {
      const eventSpy = vi.fn();
      analyticsService.on('reportGenerated', eventSpy);

      const config: ReportConfiguration = {
        type: 'usage',
        format: 'json',
      };

      await analyticsService.generateReport(config);

      expect(eventSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: expect.any(String),
          type: 'usage',
          format: 'json',
        })
      );
    });

    test('should emit reportScheduled event', async () => {
      const eventSpy = vi.fn();
      analyticsService.on('reportScheduled', eventSpy);

      const config: ReportConfiguration = {
        type: 'usage',
        format: 'json',
        schedule: 'daily',
      };

      const reportId = await analyticsService.scheduleReport(config);

      expect(eventSpy).toHaveBeenCalledWith({
        reportId,
        config,
      });
    });
  });

  describe('Error Handling', () => {
    test('should handle context store errors gracefully', async () => {
      (mockContextStore.getAllContexts as Mock).mockRejectedValue(new Error('Database error'));

      await expect(analyticsService.getAnalytics()).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate analytics', expect.any(Error));
    });

    test('should handle report generation errors', async () => {
      (mockContextStore.getAllContexts as Mock).mockRejectedValue(new Error('Database error'));

      const config: ReportConfiguration = {
        type: 'usage',
        format: 'json',
      };

      await expect(analyticsService.generateReport(config)).rejects.toThrow('Database error');
      expect(mockLogger.error).toHaveBeenCalledWith('Failed to generate report', expect.any(Error));
    });
  });

  describe('Data Formatting', () => {
    test('should format numbers correctly', async () => {
      const report = await analyticsService.generateReport({
        type: 'usage',
        format: 'json',
      });

      expect(report.data.summary.totalContexts).toBeTypeOf('number');
      expect(report.data.summary.totalTokens).toBeTypeOf('number');
      expect(report.data.summary.activeUsers).toBeTypeOf('number');
    });

    test('should handle empty data sets', async () => {
      (mockContextStore.getAllContexts as Mock).mockResolvedValue([]);

      const analytics = await analyticsService.getAnalytics();

      expect(analytics.totalContexts).toBe(0);
      expect(analytics.totalTokens).toBe(0);
      expect(analytics.activeUsers).toBe(0);
      expect(analytics.averageContextLength).toBe(0);
      expect(analytics.userActivity).toHaveLength(0);
    });

    test('should handle contexts without metadata', async () => {
      const contextsWithoutMetadata = mockContexts.map(ctx => ({
        ...ctx,
        metadata: undefined,
      }));

      (mockContextStore.getAllContexts as Mock).mockResolvedValue(contextsWithoutMetadata);

      const analytics = await analyticsService.getAnalytics();

      expect(analytics.activeUsers).toBe(1); // All contexts will be attributed to 'anonymous'
      expect(analytics.userActivity).toHaveLength(1);
      expect(analytics.userActivity[0].userId).toBe('anonymous');
    });
  });

  describe('CSV Export', () => {
    test('should convert flat array data to CSV', async () => {
      const testData = [
        { id: 1, name: 'Test 1', value: 100 },
        { id: 2, name: 'Test 2', value: 200 },
      ];

      const report = await analyticsService.generateReport({
        type: 'custom',
        format: 'csv',
      });

      // The service should handle the CSV conversion internally
      expect(typeof report.data).toBe('string');
    });

    test('should handle nested objects in CSV conversion', async () => {
      const config: ReportConfiguration = {
        type: 'content-analysis',
        format: 'csv',
      };

      const report = await analyticsService.generateReport(config);

      expect(typeof report.data).toBe('string');
      expect(report.data).toContain('Key,Value');
    });
  });

  describe('Growth Rate Calculation', () => {
    test('should calculate growth rate correctly', async () => {
      // Create contexts with a clear pattern for testing growth calculation
      const timeSeriesContexts = [
        ...mockContexts.slice(0, 2).map(ctx => ({ 
          ...ctx, 
          createdAt: new Date('2024-01-01T10:00:00Z') 
        })), // 2 contexts in first period
        ...mockContexts.slice(2).map(ctx => ({ 
          ...ctx, 
          createdAt: new Date('2024-01-02T10:00:00Z') 
        })), // 2 contexts in second period
      ];

      (mockContextStore.getAllContexts as Mock).mockResolvedValue(timeSeriesContexts);

      const report = await analyticsService.generateReport({
        type: 'content-analysis',
        format: 'json',
      });

      expect(report.data.trends.growth).toBeTypeOf('number');
    });
  });
});