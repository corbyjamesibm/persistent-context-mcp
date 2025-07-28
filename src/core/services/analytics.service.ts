import { EventEmitter } from 'events';
import { ContextStore } from '../context-store.js';
import { Logger } from '../logger.js';
import { Context } from '../types/context.js';

export interface AnalyticsMetrics {
  totalContexts: number;
  totalTokens: number;
  activeUsers: number;
  uniqueSessions: number;
  averageContextLength: number;
  contextsByType: Record<string, number>;
  contextsByTag: Record<string, number>;
  userActivity: UserActivityMetrics[];
  timeSeriesData: TimeSeriesData;
  performanceMetrics: PerformanceMetrics;
}

export interface UserActivityMetrics {
  userId: string;
  contextCount: number;
  totalTokens: number;
  averageTokensPerContext: number;
  lastActivity: Date;
  mostUsedTags: string[];
  contextTypes: Record<string, number>;
}

export interface TimeSeriesData {
  daily: TimeSeriesPoint[];
  hourly: TimeSeriesPoint[];
  weekly: TimeSeriesPoint[];
  monthly: TimeSeriesPoint[];
}

export interface TimeSeriesPoint {
  timestamp: Date;
  contextCount: number;
  tokenCount: number;
  userCount: number;
  sessionCount: number;
}

export interface PerformanceMetrics {
  averageResponseTime: number;
  totalRequests: number;
  errorRate: number;
  systemUptime: number;
  memoryUsage: number;
  cacheHitRate: number;
}

export interface AnalyticsQuery {
  startDate?: Date;
  endDate?: Date;
  userId?: string;
  contextType?: string;
  tags?: string[];
  aggregation?: 'hourly' | 'daily' | 'weekly' | 'monthly';
}

export interface ReportConfiguration {
  type: 'usage' | 'performance' | 'user-activity' | 'content-analysis' | 'custom';
  format: 'json' | 'csv' | 'pdf' | 'xlsx';
  schedule?: 'daily' | 'weekly' | 'monthly';
  recipients?: string[];
  filters?: AnalyticsQuery;
  includeCharts?: boolean;
  customFields?: string[];
}

export interface GeneratedReport {
  id: string;
  type: string;
  format: string;
  data: any;
  metadata: {
    generatedAt: Date;
    dataRange: { start: Date; end: Date };
    recordCount: number;
    filters: AnalyticsQuery;
  };
  downloadUrl?: string;
  expiresAt?: Date;
}

export class AnalyticsService extends EventEmitter {
  private contextStore: ContextStore;
  private logger: Logger;
  private metrics: Map<string, any> = new Map();
  private performanceData: PerformanceMetrics;
  private scheduledReports: Map<string, ReportConfiguration> = new Map();

  constructor(contextStore: ContextStore, logger: Logger) {
    super();
    this.contextStore = contextStore;
    this.logger = logger;
    this.performanceData = {
      averageResponseTime: 0,
      totalRequests: 0,
      errorRate: 0,
      systemUptime: Date.now(),
      memoryUsage: 0,
      cacheHitRate: 0,
    };

    this.initializeMetricsCollection();
  }

  private initializeMetricsCollection(): void {
    // Start performance monitoring
    setInterval(() => {
      this.collectPerformanceMetrics();
    }, 60000); // Every minute

    // Daily metrics aggregation
    setInterval(() => {
      this.aggregateDailyMetrics();
    }, 24 * 60 * 60 * 1000); // Every 24 hours
  }

  private collectPerformanceMetrics(): void {
    const memUsage = process.memoryUsage();
    this.performanceData.memoryUsage = memUsage.heapUsed / 1024 / 1024; // MB
    
    this.emit('metricsCollected', {
      timestamp: new Date(),
      metrics: this.performanceData
    });
  }

  private async aggregateDailyMetrics(): Promise<void> {
    try {
      const startDate = new Date();
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date();
      endDate.setHours(23, 59, 59, 999);

      const dailyMetrics = await this.getAnalytics({
        startDate,
        endDate,
        aggregation: 'daily'
      });

      this.metrics.set(`daily_${startDate.toISOString().split('T')[0]}`, dailyMetrics);
      
      this.emit('dailyMetricsAggregated', {
        date: startDate,
        metrics: dailyMetrics
      });

      this.logger.info('Daily metrics aggregated successfully', { date: startDate });
    } catch (error) {
      this.logger.error('Failed to aggregate daily metrics', error);
    }
  }

  async getAnalytics(query: AnalyticsQuery = {}): Promise<AnalyticsMetrics> {
    try {
      const {
        startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
        endDate = new Date(),
        userId,
        contextType,
        tags,
        aggregation = 'daily'
      } = query;

      // Get all contexts within the date range
      const contexts = await this.getContextsInRange(startDate, endDate, {
        userId,
        contextType,
        tags
      });

      // Calculate basic metrics
      const totalContexts = contexts.length;
      const totalTokens = contexts.reduce((sum, ctx) => sum + (ctx.content?.length || 0), 0);
      const uniqueUsers = new Set(contexts.map(ctx => ctx.metadata?.userId || 'anonymous')).size;
      const uniqueSessions = new Set(contexts.map(ctx => ctx.sessionId)).size;
      const averageContextLength = totalContexts > 0 ? totalTokens / totalContexts : 0;

      // Group by type and tags
      const contextsByType = this.groupByField(contexts, 'type');
      const contextsByTag = this.aggregateTagCounts(contexts);

      // Calculate user activity
      const userActivity = await this.calculateUserActivity(contexts);

      // Generate time series data
      const timeSeriesData = this.generateTimeSeriesData(contexts, aggregation);

      const metrics: AnalyticsMetrics = {
        totalContexts,
        totalTokens,
        activeUsers: uniqueUsers,
        uniqueSessions,
        averageContextLength,
        contextsByType,
        contextsByTag,
        userActivity,
        timeSeriesData,
        performanceMetrics: this.performanceData
      };

      this.emit('analyticsGenerated', {
        query,
        metrics,
        generatedAt: new Date()
      });

      return metrics;
    } catch (error) {
      this.logger.error('Failed to generate analytics', error);
      throw error;
    }
  }

  private async getContextsInRange(
    startDate: Date, 
    endDate: Date, 
    filters: { userId?: string; contextType?: string; tags?: string[] }
  ): Promise<Context[]> {
    // This would typically be a database query with proper filtering
    // For now, implementing basic filtering logic
    const allContexts = await this.contextStore.getAllContexts?.() || [];
    
    return allContexts.filter(context => {
      const contextDate = new Date(context.createdAt);
      if (contextDate < startDate || contextDate > endDate) {
        return false;
      }

      if (filters.userId && context.metadata?.userId !== filters.userId) {
        return false;
      }

      if (filters.contextType && context.type !== filters.contextType) {
        return false;
      }

      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(tag => 
          context.tags.includes(tag)
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      return true;
    });
  }

  private groupByField(contexts: Context[], field: keyof Context): Record<string, number> {
    const grouped: Record<string, number> = {};
    contexts.forEach(context => {
      const value = String(context[field] || 'unknown');
      grouped[value] = (grouped[value] || 0) + 1;
    });
    return grouped;
  }

  private aggregateTagCounts(contexts: Context[]): Record<string, number> {
    const tagCounts: Record<string, number> = {};
    contexts.forEach(context => {
      context.tags.forEach(tag => {
        tagCounts[tag] = (tagCounts[tag] || 0) + 1;
      });
    });
    return tagCounts;
  }

  private async calculateUserActivity(contexts: Context[]): Promise<UserActivityMetrics[]> {
    const userGroups: Record<string, Context[]> = {};
    
    contexts.forEach(context => {
      const userId = context.metadata?.userId || 'anonymous';
      if (!userGroups[userId]) {
        userGroups[userId] = [];
      }
      userGroups[userId].push(context);
    });

    return Object.entries(userGroups).map(([userId, userContexts]) => {
      const totalTokens = userContexts.reduce((sum, ctx) => sum + (ctx.content?.length || 0), 0);
      const contextTypes = this.groupByField(userContexts, 'type');
      const allTags = userContexts.flatMap(ctx => ctx.tags);
      const tagCounts = this.aggregateTagCounts(userContexts);
      const mostUsedTags = Object.entries(tagCounts)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 5)
        .map(([tag]) => tag);

      const lastActivity = userContexts.reduce((latest, ctx) => {
        const ctxDate = new Date(ctx.updatedAt);
        return ctxDate > latest ? ctxDate : latest;
      }, new Date(0));

      return {
        userId,
        contextCount: userContexts.length,
        totalTokens,
        averageTokensPerContext: userContexts.length > 0 ? totalTokens / userContexts.length : 0,
        lastActivity,
        mostUsedTags,
        contextTypes
      };
    });
  }

  private generateTimeSeriesData(contexts: Context[], aggregation: string): TimeSeriesData {
    const timeSeriesMap: Record<string, TimeSeriesPoint> = {};

    contexts.forEach(context => {
      const date = new Date(context.createdAt);
      let key: string;

      switch (aggregation) {
        case 'hourly':
          key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}-${date.getHours()}`;
          break;
        case 'weekly':
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          key = weekStart.toISOString().split('T')[0];
          break;
        case 'monthly':
          key = `${date.getFullYear()}-${date.getMonth()}`;
          break;
        default: // daily
          key = date.toISOString().split('T')[0];
      }

      if (!timeSeriesMap[key]) {
        timeSeriesMap[key] = {
          timestamp: new Date(key),
          contextCount: 0,
          tokenCount: 0,
          userCount: 0,
          sessionCount: 0
        };
      }

      timeSeriesMap[key].contextCount++;
      timeSeriesMap[key].tokenCount += context.content?.length || 0;
    });

    // Convert to sorted arrays
    const points = Object.values(timeSeriesMap).sort((a, b) => 
      a.timestamp.getTime() - b.timestamp.getTime()
    );

    return {
      daily: points,
      hourly: points,
      weekly: points,
      monthly: points
    };
  }

  async generateReport(config: ReportConfiguration): Promise<GeneratedReport> {
    try {
      const reportId = `report_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Get analytics data based on filters
      const analyticsData = await this.getAnalytics(config.filters || {});
      
      // Format data based on report type
      let reportData: any;
      switch (config.type) {
        case 'usage':
          reportData = this.formatUsageReport(analyticsData);
          break;
        case 'performance':
          reportData = this.formatPerformanceReport(analyticsData);
          break;
        case 'user-activity':
          reportData = this.formatUserActivityReport(analyticsData);
          break;
        case 'content-analysis':
          reportData = this.formatContentAnalysisReport(analyticsData);
          break;
        default:
          reportData = analyticsData;
      }

      // Generate the report in requested format
      const formattedReport = await this.formatReport(reportData, config.format);

      const report: GeneratedReport = {
        id: reportId,
        type: config.type,
        format: config.format,
        data: formattedReport,
        metadata: {
          generatedAt: new Date(),
          dataRange: {
            start: config.filters?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
            end: config.filters?.endDate || new Date()
          },
          recordCount: analyticsData.totalContexts,
          filters: config.filters || {}
        }
      };

      // Store report for download if needed
      if (config.format !== 'json') {
        report.downloadUrl = `/api/reports/${reportId}/download`;
        report.expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      }

      this.emit('reportGenerated', report);
      this.logger.info('Report generated successfully', { reportId, type: config.type });

      return report;
    } catch (error) {
      this.logger.error('Failed to generate report', error);
      throw error;
    }
  }

  private formatUsageReport(data: AnalyticsMetrics): any {
    return {
      summary: {
        totalContexts: data.totalContexts,
        totalTokens: data.totalTokens,
        activeUsers: data.activeUsers,
        uniqueSessions: data.uniqueSessions
      },
      breakdown: {
        contextsByType: data.contextsByType,
        topTags: Object.entries(data.contextsByTag)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 10)
          .map(([tag, count]) => ({ tag, count }))
      },
      trends: data.timeSeriesData.daily.slice(-30) // Last 30 days
    };
  }

  private formatPerformanceReport(data: AnalyticsMetrics): any {
    return {
      performance: data.performanceMetrics,
      usage: {
        totalContexts: data.totalContexts,
        averageContextLength: data.averageContextLength
      },
      efficiency: {
        contextsPerUser: data.totalContexts / data.activeUsers,
        tokensPerContext: data.averageContextLength
      }
    };
  }

  private formatUserActivityReport(data: AnalyticsMetrics): any {
    return {
      users: data.userActivity.map(user => ({
        userId: user.userId,
        contextCount: user.contextCount,
        totalTokens: user.totalTokens,
        efficiency: user.averageTokensPerContext,
        lastActivity: user.lastActivity,
        topTags: user.mostUsedTags.slice(0, 3)
      })),
      summary: {
        totalUsers: data.activeUsers,
        averageContextsPerUser: data.totalContexts / data.activeUsers,
        averageTokensPerUser: data.totalTokens / data.activeUsers
      }
    };
  }

  private formatContentAnalysisReport(data: AnalyticsMetrics): any {
    return {
      content: {
        totalContexts: data.totalContexts,
        averageLength: data.averageContextLength,
        typeDistribution: data.contextsByType
      },
      tags: {
        totalUniqueTags: Object.keys(data.contextsByTag).length,
        mostPopular: Object.entries(data.contextsByTag)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 20)
          .map(([tag, count]) => ({ tag, count }))
      },
      trends: {
        daily: data.timeSeriesData.daily.slice(-7), // Last 7 days
        growth: this.calculateGrowthRate(data.timeSeriesData.daily)
      }
    };
  }

  private calculateGrowthRate(timeSeries: TimeSeriesPoint[]): number {
    if (timeSeries.length < 2) return 0;
    
    const recent = timeSeries.slice(-7).reduce((sum, point) => sum + point.contextCount, 0);
    const previous = timeSeries.slice(-14, -7).reduce((sum, point) => sum + point.contextCount, 0);
    
    if (previous === 0) return 0;
    return ((recent - previous) / previous) * 100;
  }

  private async formatReport(data: any, format: string): Promise<any> {
    switch (format) {
      case 'json':
        return data;
      case 'csv':
        return this.convertToCSV(data);
      case 'pdf':
        return this.generatePDF(data);
      case 'xlsx':
        return this.generateExcel(data);
      default:
        return data;
    }
  }

  private convertToCSV(data: any): string {
    // Handle specific report formats
    if (data.users && Array.isArray(data.users)) {
      // User activity report
      const headers = ['userId', 'contextCount', 'totalTokens', 'efficiency', 'lastActivity', 'topTags'];
      const csvHeaders = headers.join(',');
      const csvRows = data.users.map((user: any) => 
        headers.map(header => `"${String(user[header] || '')}"`).join(',')
      );
      return [csvHeaders, ...csvRows].join('\n');
    }
    
    // Simple CSV conversion for flat data structures
    if (Array.isArray(data)) {
      if (data.length === 0) return '';
      
      const headers = Object.keys(data[0]);
      const csvHeaders = headers.join(',');
      const csvRows = data.map(row => 
        headers.map(header => `"${String(row[header] || '')}"`).join(',')
      );
      
      return [csvHeaders, ...csvRows].join('\n');
    }
    
    // For nested objects, flatten first level
    const flattened = this.flattenObject(data);
    const rows = Object.entries(flattened).map(([key, value]) => 
      `"${key}","${String(value)}"`
    );
    
    return ['Key,Value', ...rows].join('\n');
  }

  private flattenObject(obj: any, prefix = ''): Record<string, any> {
    const flattened: Record<string, any> = {};
    
    Object.keys(obj).forEach(key => {
      const value = obj[key];
      const newKey = prefix ? `${prefix}.${key}` : key;
      
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        Object.assign(flattened, this.flattenObject(value, newKey));
      } else {
        flattened[newKey] = value;
      }
    });
    
    return flattened;
  }

  private generatePDF(data: any): Buffer {
    // Placeholder for PDF generation
    // In a real implementation, you'd use a library like puppeteer or pdfkit
    const pdfContent = JSON.stringify(data, null, 2);
    return Buffer.from(pdfContent);
  }

  private generateExcel(data: any): Buffer {
    // Placeholder for Excel generation
    // In a real implementation, you'd use a library like exceljs
    const xlsxContent = JSON.stringify(data, null, 2);
    return Buffer.from(xlsxContent);
  }

  async scheduleReport(config: ReportConfiguration): Promise<string> {
    const reportId = `scheduled_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.scheduledReports.set(reportId, config);
    
    this.logger.info('Report scheduled', { reportId, schedule: config.schedule });
    this.emit('reportScheduled', { reportId, config });
    
    return reportId;
  }

  async getScheduledReports(): Promise<Map<string, ReportConfiguration>> {
    return new Map(this.scheduledReports);
  }

  async deleteScheduledReport(reportId: string): Promise<boolean> {
    const deleted = this.scheduledReports.delete(reportId);
    if (deleted) {
      this.emit('reportUnscheduled', { reportId });
    }
    return deleted;
  }

  recordRequest(responseTime: number, success: boolean): void {
    this.performanceData.totalRequests++;
    this.performanceData.averageResponseTime = 
      (this.performanceData.averageResponseTime * (this.performanceData.totalRequests - 1) + responseTime) / 
      this.performanceData.totalRequests;
    
    if (!success) {
      this.performanceData.errorRate = 
        (this.performanceData.errorRate * (this.performanceData.totalRequests - 1) + 1) / 
        this.performanceData.totalRequests;
    } else {
      this.performanceData.errorRate = 
        (this.performanceData.errorRate * (this.performanceData.totalRequests - 1)) / 
        this.performanceData.totalRequests;
    }
  }

  updateCacheHitRate(hitRate: number): void {
    this.performanceData.cacheHitRate = hitRate;
  }

  getPerformanceMetrics(): PerformanceMetrics {
    return { ...this.performanceData };
  }
}