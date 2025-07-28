/**
 * Performance Monitor Service for Production Optimization
 * Provides comprehensive performance testing, monitoring, and optimization
 */

import { EventEmitter } from 'events';
import { Neo4jContextStore } from '../storage/neo4j-store.js';
import { ContextManagerService } from './context-manager.service.js';
import { SearchService } from './search.service.js';
import { logger } from '../../utils/logger.js';

export interface PerformanceConfig {
  enableContinuousMonitoring: boolean;
  monitoringInterval: number; // milliseconds
  performanceThresholds: {
    maxResponseTime: number; // milliseconds
    maxMemoryUsage: number; // percentage
    maxCpuUsage: number; // percentage
    maxDatabaseResponseTime: number; // milliseconds
  };
  loadTestConfig: {
    maxConcurrentUsers: number;
    testDuration: number; // milliseconds
    rampUpTime: number; // milliseconds
  };
}

export interface PerformanceMetrics {
  timestamp: Date;
  responseTime: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
    min: number;
    max: number;
  };
  throughput: {
    requestsPerSecond: number;
    contextsPerSecond: number;
  };
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    diskUsage: number;
  };
  database: {
    connectionCount: number;
    queryResponseTime: number;
    transactionCount: number;
  };
  operations: {
    saveContext: PerformanceStats;
    searchContext: PerformanceStats;
    loadContext: PerformanceStats;
  };
}

export interface PerformanceStats {
  totalCalls: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  errorCount: number;
  errorRate: number;
}

export interface LoadTestResult {
  success: boolean;
  testId: string;
  duration: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errors: string[];
  metrics: PerformanceMetrics[];
}

export interface OptimizationRecommendation {
  category: 'database' | 'memory' | 'cpu' | 'network' | 'caching';
  severity: 'low' | 'medium' | 'high' | 'critical';
  title: string;
  description: string;
  recommendation: string;
  estimatedImpact: string;
  implementationComplexity: 'low' | 'medium' | 'high';
}

export class PerformanceMonitorService extends EventEmitter {
  private config: PerformanceConfig;
  private contextStore: Neo4jContextStore;
  private contextManager: ContextManagerService;
  private searchService: SearchService;
  
  private isMonitoring = false;
  private monitoringTimer: NodeJS.Timeout | null = null;
  private metricsHistory: PerformanceMetrics[] = [];
  private responseTimes: number[] = [];
  private operationStats: Map<string, PerformanceStats> = new Map();
  
  constructor(
    contextStore: Neo4jContextStore,
    contextManager: ContextManagerService,
    searchService: SearchService,
    config?: Partial<PerformanceConfig>
  ) {
    super();
    
    this.contextStore = contextStore;
    this.contextManager = contextManager;
    this.searchService = searchService;
    
    this.config = {
      enableContinuousMonitoring: true,
      monitoringInterval: 60000, // 1 minute
      performanceThresholds: {
        maxResponseTime: 5000, // 5 seconds
        maxMemoryUsage: 80, // 80%
        maxCpuUsage: 70, // 70%
        maxDatabaseResponseTime: 1000, // 1 second
      },
      loadTestConfig: {
        maxConcurrentUsers: 100,
        testDuration: 300000, // 5 minutes
        rampUpTime: 60000, // 1 minute
      },
      ...config,
    };
    
    this.initializeOperationStats();
  }

  /**
   * Start continuous performance monitoring
   */
  start(): void {
    if (this.isMonitoring) {
      logger.warn('Performance monitoring is already running');
      return;
    }

    this.isMonitoring = true;
    this.scheduleNextMonitoring();
    
    logger.info(`Performance monitoring started with ${this.config.monitoringInterval}ms interval`);
    this.emit('monitoringStarted');
  }

  /**
   * Stop continuous performance monitoring
   */
  stop(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.isMonitoring = false;
    if (this.monitoringTimer) {
      clearTimeout(this.monitoringTimer);
      this.monitoringTimer = null;
    }

    logger.info('Performance monitoring stopped');
    this.emit('monitoringStopped');
  }

  /**
   * Record operation performance
   */
  recordOperation(operation: string, duration: number, success: boolean = true): void {
    const stats = this.operationStats.get(operation) || {
      totalCalls: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      errorCount: 0,
      errorRate: 0,
    };

    stats.totalCalls++;
    stats.averageTime = (stats.averageTime * (stats.totalCalls - 1) + duration) / stats.totalCalls;
    stats.minTime = Math.min(stats.minTime, duration);
    stats.maxTime = Math.max(stats.maxTime, duration);
    
    if (!success) {
      stats.errorCount++;
    }
    stats.errorRate = (stats.errorCount / stats.totalCalls) * 100;

    this.operationStats.set(operation, stats);
    this.responseTimes.push(duration);
    
    // Keep only recent response times (last 1000)
    if (this.responseTimes.length > 1000) {
      this.responseTimes = this.responseTimes.slice(-1000);
    }
  }

  /**
   * Get current performance metrics
   */
  async getCurrentMetrics(): Promise<PerformanceMetrics> {
    const timestamp = new Date();
    
    // Calculate response time percentiles
    const sortedTimes = [...this.responseTimes].sort((a, b) => a - b);
    const responseTime = {
      average: sortedTimes.length > 0 ? sortedTimes.reduce((a, b) => a + b, 0) / sortedTimes.length : 0,
      p50: this.calculatePercentile(sortedTimes, 50),
      p95: this.calculatePercentile(sortedTimes, 95),
      p99: this.calculatePercentile(sortedTimes, 99),
      min: sortedTimes.length > 0 ? sortedTimes[0] : 0,
      max: sortedTimes.length > 0 ? sortedTimes[sortedTimes.length - 1] : 0,
    };

    // Get system resource metrics
    const memUsage = process.memoryUsage();
    const resources = {
      memoryUsage: (memUsage.heapUsed / memUsage.heapTotal) * 100,
      cpuUsage: await this.getCpuUsage(),
      diskUsage: await this.getDiskUsage(),
    };

    // Get database metrics
    const database = await this.getDatabaseMetrics();

    // Calculate throughput (requests per last minute)
    const recentMetrics = this.metricsHistory.filter(
      m => Date.now() - m.timestamp.getTime() < 60000
    );
    const throughput = {
      requestsPerSecond: recentMetrics.reduce((sum, m) => sum + m.throughput.requestsPerSecond, 0) / Math.max(recentMetrics.length, 1),
      contextsPerSecond: recentMetrics.reduce((sum, m) => sum + m.throughput.contextsPerSecond, 0) / Math.max(recentMetrics.length, 1),
    };

    return {
      timestamp,
      responseTime,
      throughput,
      resources,
      database,
      operations: {
        saveContext: this.operationStats.get('saveContext') || this.getEmptyStats(),
        searchContext: this.operationStats.get('searchContext') || this.getEmptyStats(),
        loadContext: this.operationStats.get('loadContext') || this.getEmptyStats(),
      },
    };
  }

  /**
   * Run comprehensive load test
   */
  async runLoadTest(options?: {
    concurrentUsers?: number;
    duration?: number;
    rampUpTime?: number;
  }): Promise<LoadTestResult> {
    const testId = `load-test-${Date.now()}`;
    const startTime = Date.now();
    
    const concurrentUsers = options?.concurrentUsers || this.config.loadTestConfig.maxConcurrentUsers;
    const duration = options?.duration || this.config.loadTestConfig.testDuration;
    const rampUpTime = options?.rampUpTime || this.config.loadTestConfig.rampUpTime;
    
    logger.info(`Starting load test: ${testId} (${concurrentUsers} users, ${duration}ms duration)`);
    
    const results: LoadTestResult = {
      success: false,
      testId,
      duration: 0,
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      requestsPerSecond: 0,
      errors: [],
      metrics: [],
    };

    try {
      const testPromises: Promise<void>[] = [];
      const responseTimes: number[] = [];
      const errors: string[] = [];
      let totalRequests = 0;
      let successfulRequests = 0;

      // Create user simulation promises
      for (let userId = 0; userId < concurrentUsers; userId++) {
        const userPromise = this.simulateUser(
          userId,
          duration,
          rampUpTime * (userId / concurrentUsers),
          (requestTime: number, success: boolean, error?: string) => {
            totalRequests++;
            if (success) {
              successfulRequests++;
              responseTimes.push(requestTime);
            } else {
              if (error) errors.push(error);
            }
          }
        );
        testPromises.push(userPromise);
      }

      // Collect metrics during test
      const metricsCollectionInterval = setInterval(async () => {
        try {
          const metrics = await this.getCurrentMetrics();
          results.metrics.push(metrics);
        } catch (error) {
          logger.warn('Failed to collect metrics during load test:', error);
        }
      }, 5000); // Collect metrics every 5 seconds

      // Wait for all users to complete
      await Promise.all(testPromises);
      clearInterval(metricsCollectionInterval);

      const testDuration = Date.now() - startTime;
      
      results.success = true;
      results.duration = testDuration;
      results.totalRequests = totalRequests;
      results.successfulRequests = successfulRequests;
      results.failedRequests = totalRequests - successfulRequests;
      results.averageResponseTime = responseTimes.length > 0 ? 
        responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : 0;
      results.maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;
      results.requestsPerSecond = totalRequests / (testDuration / 1000);
      results.errors = errors.slice(0, 100); // Limit error list

      logger.info(`Load test completed: ${testId} (${successfulRequests}/${totalRequests} requests successful)`);
      this.emit('loadTestCompleted', results);
      
      return results;

    } catch (error) {
      const testDuration = Date.now() - startTime;
      results.duration = testDuration;
      results.errors.push(error instanceof Error ? error.message : 'Unknown error');
      
      logger.error(`Load test failed: ${testId}`, error);
      this.emit('loadTestFailed', { testId, error: error instanceof Error ? error.message : 'Unknown error' });
      
      return results;
    }
  }

  /**
   * Analyze performance and provide optimization recommendations
   */
  async analyzePerformance(): Promise<OptimizationRecommendation[]> {
    const recommendations: OptimizationRecommendation[] = [];
    const currentMetrics = await this.getCurrentMetrics();
    
    // Analyze response times
    if (currentMetrics.responseTime.p95 > this.config.performanceThresholds.maxResponseTime) {
      recommendations.push({
        category: 'database',
        severity: 'high',
        title: 'High Response Times Detected',
        description: `95th percentile response time (${currentMetrics.responseTime.p95}ms) exceeds threshold (${this.config.performanceThresholds.maxResponseTime}ms)`,
        recommendation: 'Optimize database queries, add database indexes, or implement caching',
        estimatedImpact: 'Up to 50% reduction in response times',
        implementationComplexity: 'medium',
      });
    }

    // Analyze memory usage
    if (currentMetrics.resources.memoryUsage > this.config.performanceThresholds.maxMemoryUsage) {
      recommendations.push({
        category: 'memory',
        severity: 'high',
        title: 'High Memory Usage',
        description: `Memory usage (${currentMetrics.resources.memoryUsage.toFixed(1)}%) exceeds threshold (${this.config.performanceThresholds.maxMemoryUsage}%)`,
        recommendation: 'Implement object pooling, reduce memory leaks, or increase available memory',
        estimatedImpact: 'Improved stability and reduced garbage collection overhead',
        implementationComplexity: 'medium',
      });
    }

    // Analyze database performance
    if (currentMetrics.database.queryResponseTime > this.config.performanceThresholds.maxDatabaseResponseTime) {
      recommendations.push({
        category: 'database',
        severity: 'medium',
        title: 'Slow Database Queries',
        description: `Database query response time (${currentMetrics.database.queryResponseTime}ms) exceeds threshold (${this.config.performanceThresholds.maxDatabaseResponseTime}ms)`,
        recommendation: 'Add database indexes, optimize query patterns, or implement query caching',
        estimatedImpact: 'Up to 70% improvement in database query performance',
        implementationComplexity: 'low',
      });
    }

    // Analyze error rates
    const operations = Object.values(currentMetrics.operations);
    const highErrorRateOps = operations.filter(op => op.errorRate > 5); // 5% error rate threshold
    if (highErrorRateOps.length > 0) {
      recommendations.push({
        category: 'network',
        severity: 'high',
        title: 'High Error Rates',
        description: `Some operations have error rates above 5%`,
        recommendation: 'Implement retry logic, improve error handling, and investigate root causes',
        estimatedImpact: 'Improved reliability and user experience',
        implementationComplexity: 'medium',
      });
    }

    // Analyze throughput patterns
    if (currentMetrics.throughput.requestsPerSecond < 1 && this.metricsHistory.length > 5) {
      recommendations.push({
        category: 'caching',
        severity: 'medium',
        title: 'Low Throughput',
        description: 'System throughput is below optimal levels',
        recommendation: 'Implement response caching, connection pooling, or horizontal scaling',
        estimatedImpact: 'Up to 300% improvement in throughput',
        implementationComplexity: 'high',
      });
    }

    return recommendations;
  }

  /**
   * Get performance metrics history
   */
  getMetricsHistory(limit: number = 100): PerformanceMetrics[] {
    return this.metricsHistory.slice(-limit);
  }

  /**
   * Clear performance history
   */
  clearHistory(): void {
    this.metricsHistory = [];
    this.responseTimes = [];
    this.operationStats.clear();
    this.initializeOperationStats();
    
    logger.info('Performance history cleared');
    this.emit('historyCleared');
  }

  // Private helper methods

  private initializeOperationStats(): void {
    const operations = ['saveContext', 'searchContext', 'loadContext'];
    operations.forEach(op => {
      this.operationStats.set(op, this.getEmptyStats());
    });
  }

  private getEmptyStats(): PerformanceStats {
    return {
      totalCalls: 0,
      averageTime: 0,
      minTime: 0,
      maxTime: 0,
      errorCount: 0,
      errorRate: 0,
    };
  }

  private calculatePercentile(sortedArray: number[], percentile: number): number {
    if (sortedArray.length === 0) return 0;
    
    const index = Math.ceil((percentile / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  private async getCpuUsage(): Promise<number> {
    // Simplified CPU usage calculation
    // In production, you might want to use a more accurate method
    const usage = process.cpuUsage();
    return (usage.user + usage.system) / 1000000; // Convert to percentage approximation
  }

  private async getDiskUsage(): Promise<number> {
    // Simplified disk usage - would need platform-specific implementation
    return 0; // Placeholder
  }

  private async getDatabaseMetrics(): Promise<{
    connectionCount: number;
    queryResponseTime: number;
    transactionCount: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Test database response time with a simple query
      await this.contextStore.searchContexts('');
      const queryResponseTime = Date.now() - startTime;
      
      return {
        connectionCount: 1, // Neo4j driver manages connection pooling internally
        queryResponseTime,
        transactionCount: 0, // Would need to track this in the store implementation
      };
    } catch (error) {
      return {
        connectionCount: 0,
        queryResponseTime: Date.now() - startTime,
        transactionCount: 0,
      };
    }
  }

  private async simulateUser(
    userId: number,
    duration: number,
    delay: number,
    onRequest: (responseTime: number, success: boolean, error?: string) => void
  ): Promise<void> {
    // Wait for ramp-up delay
    await new Promise(resolve => setTimeout(resolve, delay));
    
    const endTime = Date.now() + duration;
    
    while (Date.now() < endTime) {
      const startTime = Date.now();
      
      try {
        // Simulate different types of operations
        const operation = Math.random();
        
        if (operation < 0.4) {
          // 40% search operations
          await this.contextStore.searchContexts(`test-query-${userId}`);
          this.recordOperation('searchContext', Date.now() - startTime, true);
        } else if (operation < 0.7) {
          // 30% save operations
          await this.contextStore.saveContext({
            title: `Load Test Context ${userId}-${Date.now()}`,
            content: `This is a load test context created by user ${userId}`,
            type: 'development',
            tags: ['load-test'],
            sessionId: `load-test-session-${userId}`,
            metadata: {
              source: 'load-test',
              aiGenerated: false,
              importance: 'low' as const,
            },
          });
          this.recordOperation('saveContext', Date.now() - startTime, true);
        } else {
          // 30% load operations (search and then load specific context)
          const searchResults = await this.contextStore.searchContexts('');
          if (searchResults.length > 0) {
            const randomResult = searchResults[Math.floor(Math.random() * searchResults.length)];
            await this.contextStore.getContext(randomResult.id);
          }
          this.recordOperation('loadContext', Date.now() - startTime, true);
        }
        
        onRequest(Date.now() - startTime, true);
        
      } catch (error) {
        const responseTime = Date.now() - startTime;
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        
        this.recordOperation('error', responseTime, false);
        onRequest(responseTime, false, errorMessage);
      }
      
      // Wait between requests (simulate think time)
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 500));
    }
  }

  private scheduleNextMonitoring(): void {
    if (!this.isMonitoring) {
      return;
    }

    this.monitoringTimer = setTimeout(async () => {
      try {
        const metrics = await this.getCurrentMetrics();
        this.metricsHistory.push(metrics);
        
        // Keep only recent history (last 1000 entries)
        if (this.metricsHistory.length > 1000) {
          this.metricsHistory = this.metricsHistory.slice(-1000);
        }
        
        // Emit performance check event
        this.emit('performanceCheck', metrics);
        
        // Check for performance issues
        const recommendations = await this.analyzePerformance();
        if (recommendations.length > 0) {
          this.emit('performanceAlert', {
            level: 'warning',
            message: `${recommendations.length} performance issues detected`,
            recommendations,
          });
        }
        
      } catch (error) {
        logger.error('Performance monitoring check failed:', error);
        this.emit('monitoringError', { error: error instanceof Error ? error.message : 'Unknown error' });
      }
      
      this.scheduleNextMonitoring();
    }, this.config.monitoringInterval);
  }
}

/**
 * Factory function to create performance monitor service
 */
export function createPerformanceMonitorService(
  contextStore: Neo4jContextStore,
  contextManager: ContextManagerService,
  searchService: SearchService,
  config?: Partial<PerformanceConfig>
): PerformanceMonitorService {
  return new PerformanceMonitorService(contextStore, contextManager, searchService, config);
}