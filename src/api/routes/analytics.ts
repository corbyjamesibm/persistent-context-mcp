import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { AnalyticsService, AnalyticsQuery, ReportConfiguration } from '../../core/services/analytics.service.js';
import { authenticateLLM } from '../middleware/auth.js';
import { validateRequest } from '../middleware/validation.js';
import { Logger } from '../../core/logger.js';

const router = Router();

// Input validation schemas
const AnalyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  userId: z.string().optional(),
  contextType: z.string().optional(),
  tags: z.array(z.string()).optional(),
  aggregation: z.enum(['hourly', 'daily', 'weekly', 'monthly']).optional(),
});

const ReportConfigSchema = z.object({
  type: z.enum(['usage', 'performance', 'user-activity', 'content-analysis', 'custom']),
  format: z.enum(['json', 'csv', 'pdf', 'xlsx']),
  schedule: z.enum(['daily', 'weekly', 'monthly']).optional(),
  recipients: z.array(z.string().email()).optional(),
  filters: AnalyticsQuerySchema.optional(),
  includeCharts: z.boolean().optional(),
  customFields: z.array(z.string()).optional(),
});

/**
 * GET /api/analytics
 * Get analytics data based on query parameters
 */
router.get('/', 
  authenticateLLM, 
  validateRequest(AnalyticsQuerySchema, 'query'), 
  async (req: Request, res: Response) => {
    try {
      const analyticsService = req.app.get('analyticsService') as AnalyticsService;
      const query: AnalyticsQuery = {
        startDate: req.query.startDate ? new Date(req.query.startDate as string) : undefined,
        endDate: req.query.endDate ? new Date(req.query.endDate as string) : undefined,
        userId: req.query.userId as string,
        contextType: req.query.contextType as string,
        tags: req.query.tags as string[],
        aggregation: req.query.aggregation as any,
      };

      const analytics = await analyticsService.getAnalytics(query);

      res.json({
        success: true,
        data: analytics,
        query,
        generatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const logger = req.app.get('logger') as Logger;
      logger.error('Failed to get analytics', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to retrieve analytics',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/analytics/overview
 * Get high-level analytics overview
 */
router.get('/overview', authenticateLLM, async (req: Request, res: Response) => {
  try {
    const analyticsService = req.app.get('analyticsService') as AnalyticsService;
    
    // Get analytics for different time periods
    const [
      last7Days,
      last30Days,
      last90Days,
      allTime
    ] = await Promise.all([
      analyticsService.getAnalytics({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      }),
      analyticsService.getAnalytics({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      }),
      analyticsService.getAnalytics({
        startDate: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
        endDate: new Date()
      }),
      analyticsService.getAnalytics({})
    ]);

    // Calculate growth rates
    const calculateGrowthRate = (current: number, previous: number): number => {
      if (previous === 0) return 0;
      return ((current - previous) / previous) * 100;
    };

    const overview = {
      summary: {
        totalContexts: allTime.totalContexts,
        totalTokens: allTime.totalTokens,
        activeUsers: allTime.activeUsers,
        uniqueSessions: allTime.uniqueSessions,
      },
      growth: {
        contexts: {
          last7Days: last7Days.totalContexts,
          last30Days: last30Days.totalContexts,
          growth7d: calculateGrowthRate(last7Days.totalContexts, last30Days.totalContexts - last7Days.totalContexts),
          growth30d: calculateGrowthRate(last30Days.totalContexts, last90Days.totalContexts - last30Days.totalContexts),
        },
        users: {
          last7Days: last7Days.activeUsers,
          last30Days: last30Days.activeUsers,
          growth7d: calculateGrowthRate(last7Days.activeUsers, last30Days.activeUsers - last7Days.activeUsers),
          growth30d: calculateGrowthRate(last30Days.activeUsers, last90Days.activeUsers - last30Days.activeUsers),
        },
      },
      topMetrics: {
        topTags: Object.entries(last30Days.contextsByTag)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([tag, count]) => ({ tag, count })),
        topTypes: Object.entries(last30Days.contextsByType)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([type, count]) => ({ type, count })),
        topUsers: last30Days.userActivity
          .sort((a, b) => b.contextCount - a.contextCount)
          .slice(0, 5)
          .map(user => ({
            userId: user.userId,
            contextCount: user.contextCount,
            totalTokens: user.totalTokens
          })),
      },
      performance: last30Days.performanceMetrics,
    };

    res.json({
      success: true,
      data: overview,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const logger = req.app.get('logger') as Logger;
    logger.error('Failed to get analytics overview', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve analytics overview',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/analytics/reports
 * Generate a custom report
 */
router.post('/reports', 
  authenticateLLM, 
  validateRequest(ReportConfigSchema), 
  async (req: Request, res: Response) => {
    try {
      const analyticsService = req.app.get('analyticsService') as AnalyticsService;
      const config: ReportConfiguration = req.body;

      const report = await analyticsService.generateReport(config);

      res.json({
        success: true,
        data: report,
      });
    } catch (error) {
      const logger = req.app.get('logger') as Logger;
      logger.error('Failed to generate report', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to generate report',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/analytics/reports/:reportId/download
 * Download a generated report
 */
router.get('/reports/:reportId/download', authenticateLLM, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const analyticsService = req.app.get('analyticsService') as AnalyticsService;
    
    // In a real implementation, you'd retrieve the report from storage
    // For now, we'll return a placeholder response
    
    res.status(404).json({
      success: false,
      message: 'Report download not yet implemented',
    });
  } catch (error) {
    const logger = req.app.get('logger') as Logger;
    logger.error('Failed to download report', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to download report',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/analytics/reports/schedule
 * Schedule a recurring report
 */
router.post('/reports/schedule', 
  authenticateLLM, 
  validateRequest(ReportConfigSchema), 
  async (req: Request, res: Response) => {
    try {
      const analyticsService = req.app.get('analyticsService') as AnalyticsService;
      const config: ReportConfiguration = req.body;

      if (!config.schedule) {
        return res.status(400).json({
          success: false,
          message: 'Schedule is required for scheduled reports',
        });
      }

      const reportId = await analyticsService.scheduleReport(config);

      res.json({
        success: true,
        data: {
          reportId,
          schedule: config.schedule,
          message: 'Report scheduled successfully',
        },
      });
    } catch (error) {
      const logger = req.app.get('logger') as Logger;
      logger.error('Failed to schedule report', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to schedule report',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

/**
 * GET /api/analytics/reports/scheduled
 * Get all scheduled reports
 */
router.get('/reports/scheduled', authenticateLLM, async (req: Request, res: Response) => {
  try {
    const analyticsService = req.app.get('analyticsService') as AnalyticsService;
    const scheduledReports = await analyticsService.getScheduledReports();
    
    const reportsArray = Array.from(scheduledReports.entries()).map(([id, config]) => ({
      id,
      ...config,
    }));

    res.json({
      success: true,
      data: reportsArray,
    });
  } catch (error) {
    const logger = req.app.get('logger') as Logger;
    logger.error('Failed to get scheduled reports', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve scheduled reports',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * DELETE /api/analytics/reports/scheduled/:reportId
 * Delete a scheduled report
 */
router.delete('/reports/scheduled/:reportId', authenticateLLM, async (req: Request, res: Response) => {
  try {
    const { reportId } = req.params;
    const analyticsService = req.app.get('analyticsService') as AnalyticsService;
    
    const deleted = await analyticsService.deleteScheduledReport(reportId);
    
    if (!deleted) {
      return res.status(404).json({
        success: false,
        message: 'Scheduled report not found',
      });
    }

    res.json({
      success: true,
      message: 'Scheduled report deleted successfully',
    });
  } catch (error) {
    const logger = req.app.get('logger') as Logger;
    logger.error('Failed to delete scheduled report', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to delete scheduled report',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/analytics/performance
 * Get real-time performance metrics
 */
router.get('/performance', authenticateLLM, async (req: Request, res: Response) => {
  try {
    const analyticsService = req.app.get('analyticsService') as AnalyticsService;
    const performanceMetrics = analyticsService.getPerformanceMetrics();

    res.json({
      success: true,
      data: performanceMetrics,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const logger = req.app.get('logger') as Logger;
    logger.error('Failed to get performance metrics', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve performance metrics',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * GET /api/analytics/dashboard
 * Get dashboard data with key metrics and charts
 */
router.get('/dashboard', authenticateLLM, async (req: Request, res: Response) => {
  try {
    const analyticsService = req.app.get('analyticsService') as AnalyticsService;
    
    // Get data for different time ranges for dashboard
    const [dailyData, weeklyData, monthlyData] = await Promise.all([
      analyticsService.getAnalytics({
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000),
        aggregation: 'hourly'
      }),
      analyticsService.getAnalytics({
        startDate: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        aggregation: 'daily'
      }),
      analyticsService.getAnalytics({
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        aggregation: 'daily'
      }),
    ]);

    const dashboardData = {
      summary: {
        contexts: {
          total: monthlyData.totalContexts,
          today: dailyData.totalContexts,
          thisWeek: weeklyData.totalContexts,
          growth: monthlyData.totalContexts > 0 ? 
            ((weeklyData.totalContexts / (monthlyData.totalContexts / 4)) - 1) * 100 : 0
        },
        users: {
          total: monthlyData.activeUsers,
          active: weeklyData.activeUsers,
          growth: monthlyData.activeUsers > 0 ? 
            ((weeklyData.activeUsers / monthlyData.activeUsers) - 0.25) * 400 : 0
        },
        tokens: {
          total: monthlyData.totalTokens,
          today: dailyData.totalTokens,
          average: monthlyData.averageContextLength,
        },
        performance: monthlyData.performanceMetrics
      },
      charts: {
        contextTrends: monthlyData.timeSeriesData.daily.slice(-30).map(point => ({
          date: point.timestamp,
          contexts: point.contextCount,
          tokens: point.tokenCount
        })),
        userActivity: monthlyData.userActivity.slice(0, 10),
        tagCloud: Object.entries(monthlyData.contextsByTag)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 20)
          .map(([tag, count]) => ({ tag, count })),
        typeDistribution: Object.entries(monthlyData.contextsByType)
          .map(([type, count]) => ({ type, count }))
      },
      alerts: [] // Placeholder for system alerts
    };

    res.json({
      success: true,
      data: dashboardData,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    const logger = req.app.get('logger') as Logger;
    logger.error('Failed to get dashboard data', error);
    
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve dashboard data',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/analytics/export
 * Export analytics data in various formats
 */
router.post('/export', 
  authenticateLLM, 
  validateRequest(z.object({
    query: AnalyticsQuerySchema.optional(),
    format: z.enum(['json', 'csv', 'xlsx']),
    includeCharts: z.boolean().optional()
  })), 
  async (req: Request, res: Response) => {
    try {
      const analyticsService = req.app.get('analyticsService') as AnalyticsService;
      const { query = {}, format, includeCharts = false } = req.body;

      // Convert string dates to Date objects
      const analyticsQuery: AnalyticsQuery = {
        ...query,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      };

      const report = await analyticsService.generateReport({
        type: 'custom',
        format,
        filters: analyticsQuery,
        includeCharts
      });

      // Set appropriate headers based on format
      const contentTypes: Record<string, string> = {
        json: 'application/json',
        csv: 'text/csv',
        xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      };

      const fileExtensions: Record<string, string> = {
        json: 'json',
        csv: 'csv',
        xlsx: 'xlsx'
      };

      res.setHeader('Content-Type', contentTypes[format]);
      res.setHeader('Content-Disposition', 
        `attachment; filename="analytics_export_${new Date().toISOString().split('T')[0]}.${fileExtensions[format]}"`
      );

      if (format === 'json') {
        res.json(report.data);
      } else {
        res.send(report.data);
      }
    } catch (error) {
      const logger = req.app.get('logger') as Logger;
      logger.error('Failed to export analytics data', error);
      
      res.status(500).json({
        success: false,
        message: 'Failed to export analytics data',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }
);

export default router;