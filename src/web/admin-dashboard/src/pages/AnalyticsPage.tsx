import React, { useState, useEffect } from 'react';
import {
  Grid,
  Column,
  Tile,
  Button,
  Dropdown,
  DatePicker,
  DatePickerInput,
  Modal,
  TextInput,
  Toggle,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Tag,
  ProgressBar,
  InlineNotification,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Loading,
  CodeSnippet,
  Select,
  SelectItem,
} from '@carbon/react';
import {
  Analytics,
  Download,
  Calendar,
  Report,
  TrendUp,
  TrendDown,
  Users,
  Document,
  Time,
  Settings,
  ChartLine,
  Dashboard,
  Export,
} from '@carbon/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useNotification } from '../hooks/useNotification';

interface AnalyticsData {
  totalContexts: number;
  totalTokens: number;
  activeUsers: number;
  uniqueSessions: number;
  averageContextLength: number;
  contextsByType: Record<string, number>;
  contextsByTag: Record<string, number>;
  userActivity: UserActivity[];
  timeSeriesData: TimeSeriesData;
  performanceMetrics: PerformanceMetrics;
}

interface UserActivity {
  userId: string;
  contextCount: number;
  totalTokens: number;
  averageTokensPerContext: number;
  lastActivity: string;
  mostUsedTags: string[];
}

interface TimeSeriesData {
  daily: TimeSeriesPoint[];
  hourly: TimeSeriesPoint[];
  weekly: TimeSeriesPoint[];
  monthly: TimeSeriesPoint[];
}

interface TimeSeriesPoint {
  timestamp: string;
  contextCount: number;
  tokenCount: number;
  userCount: number;
  sessionCount: number;
}

interface PerformanceMetrics {
  averageResponseTime: number;
  totalRequests: number;
  errorRate: number;
  systemUptime: number;
  memoryUsage: number;
  cacheHitRate: number;
}

interface ReportConfig {
  type: 'usage' | 'performance' | 'user-activity' | 'content-analysis' | 'custom';
  format: 'json' | 'csv' | 'pdf' | 'xlsx';
  schedule?: 'daily' | 'weekly' | 'monthly';
  recipients?: string[];
  includeCharts?: boolean;
}

const timeRangeOptions = [
  { id: '24h', text: 'Last 24 Hours' },
  { id: '7d', text: 'Last 7 Days' },
  { id: '30d', text: 'Last 30 Days' },
  { id: '90d', text: 'Last 90 Days' },
  { id: 'custom', text: 'Custom Range' },
];

const aggregationOptions = [
  { id: 'hourly', text: 'Hourly' },
  { id: 'daily', text: 'Daily' },
  { id: 'weekly', text: 'Weekly' },
  { id: 'monthly', text: 'Monthly' },
];

const reportTypeOptions = [
  { id: 'usage', text: 'Usage Report' },
  { id: 'performance', text: 'Performance Report' },
  { id: 'user-activity', text: 'User Activity Report' },
  { id: 'content-analysis', text: 'Content Analysis Report' },
  { id: 'custom', text: 'Custom Report' },
];

const formatOptions = [
  { id: 'json', text: 'JSON' },
  { id: 'csv', text: 'CSV' },
  { id: 'pdf', text: 'PDF' },
  { id: 'xlsx', text: 'Excel (XLSX)' },
];

export const AnalyticsPage: React.FC = () => {
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [selectedAggregation, setSelectedAggregation] = useState('daily');
  const [customDateRange, setCustomDateRange] = useState<[Date?, Date?]>([]);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig>({
    type: 'usage',
    format: 'json',
    includeCharts: false,
  });

  const { showSuccess, showError } = useNotification();
  const queryClient = useQueryClient();

  // Calculate date range based on selection
  const getDateRange = () => {
    const endDate = new Date();
    let startDate = new Date();

    if (selectedTimeRange === 'custom') {
      return {
        startDate: customDateRange[0]?.toISOString(),
        endDate: customDateRange[1]?.toISOString(),
      };
    }

    switch (selectedTimeRange) {
      case '24h':
        startDate.setHours(startDate.getHours() - 24);
        break;
      case '7d':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case '30d':
        startDate.setDate(startDate.getDate() - 30);
        break;
      case '90d':
        startDate.setDate(startDate.getDate() - 90);
        break;
    }

    return {
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    };
  };

  // Fetch analytics data
  const {
    data: analyticsData,
    isLoading: analyticsLoading,
    error: analyticsError,
  } = useQuery({
    queryKey: ['analytics', selectedTimeRange, selectedAggregation, customDateRange],
    queryFn: async () => {
      const dateRange = getDateRange();
      const params = new URLSearchParams({
        aggregation: selectedAggregation,
        ...(dateRange.startDate && { startDate: dateRange.startDate }),
        ...(dateRange.endDate && { endDate: dateRange.endDate }),
      });

      const response = await api.get(`/analytics?${params.toString()}`);
      return response.data.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch dashboard overview
  const {
    data: overviewData,
    isLoading: overviewLoading,
  } = useQuery({
    queryKey: ['analytics-overview'],
    queryFn: async () => {
      const response = await api.get('/analytics/overview');
      return response.data.data;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  // Generate report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (config: ReportConfig) => {
      const response = await api.post('/analytics/reports', config);
      return response.data;
    },
    onSuccess: (data) => {
      showSuccess('Report Generated', 'Your report has been generated successfully');
      setIsReportModalOpen(false);
      // Download report if it's not JSON
      if (reportConfig.format !== 'json' && data.data.downloadUrl) {
        window.open(data.data.downloadUrl, '_blank');
      }
    },
    onError: (error: any) => {
      showError('Report Generation Failed', error.message || 'Failed to generate report');
    },
  });

  // Export data mutation
  const exportDataMutation = useMutation({
    mutationFn: async (config: { format: string; includeCharts: boolean }) => {
      const dateRange = getDateRange();
      const response = await api.post('/analytics/export', {
        query: {
          ...dateRange,
          aggregation: selectedAggregation,
        },
        format: config.format,
        includeCharts: config.includeCharts,
      }, {
        responseType: config.format === 'json' ? 'json' : 'blob',
      });
      return { data: response.data, format: config.format };
    },
    onSuccess: (result) => {
      if (result.format === 'json') {
        // For JSON, create a downloadable file
        const blob = new Blob([JSON.stringify(result.data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_export_${new Date().toISOString().split('T')[0]}.json`;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // For other formats, the blob is already handled by axios
        const url = URL.createObjectURL(result.data);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_export_${new Date().toISOString().split('T')[0]}.${result.format}`;
        a.click();
        URL.revokeObjectURL(url);
      }
      
      showSuccess('Export Complete', 'Analytics data has been exported successfully');
      setIsExportModalOpen(false);
    },
    onError: (error: any) => {
      showError('Export Failed', error.message || 'Failed to export analytics data');
    },
  });

  const handleGenerateReport = () => {
    generateReportMutation.mutate(reportConfig);
  };

  const handleExportData = (format: string, includeCharts: boolean) => {
    exportDataMutation.mutate({ format, includeCharts });
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const formatGrowth = (growth: number): JSX.Element => {
    const isPositive = growth >= 0;
    const Icon = isPositive ? TrendUp : TrendDown;
    const color = isPositive ? 'var(--cds-support-success)' : 'var(--cds-support-error)';
    
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', color }}>
        <Icon size={16} />
        <span>{Math.abs(growth).toFixed(1)}%</span>
      </div>
    );
  };

  if (analyticsLoading || overviewLoading) {
    return <LoadingSpinner size="lg" description="Loading analytics..." />;
  }

  if (analyticsError) {
    return (
      <InlineNotification
        kind="error"
        title="Loading Error"
        subtitle="Failed to load analytics data"
      />
    );
  }

  return (
    <div className="analytics-page">
      <Grid>
        {/* Header */}
        <Column lg={16} md={8} sm={4} className="page-header">
          <div className="header-content">
            <div className="header-text">
              <h1 className="page-title">
                <Analytics size={32} />
                Analytics & Reporting
              </h1>
              <p className="page-subtitle">
                Comprehensive insights into system usage, performance, and user activity
              </p>
            </div>
            <div className="header-actions">
              <Button
                kind="secondary"
                renderIcon={Export}
                onClick={() => setIsExportModalOpen(true)}
              >
                Export Data
              </Button>
              <Button
                kind="primary"
                renderIcon={Report}
                onClick={() => setIsReportModalOpen(true)}
              >
                Generate Report
              </Button>
            </div>
          </div>
        </Column>

        {/* Time Range Controls */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="controls-tile">
            <div className="controls-content">
              <Dropdown
                id="time-range"
                titleText="Time Range"
                label="Select time range"
                items={timeRangeOptions}
                selectedItem={timeRangeOptions.find(r => r.id === selectedTimeRange)}
                onChange={({ selectedItem }) => setSelectedTimeRange(selectedItem?.id || '30d')}
              />

              <Dropdown
                id="aggregation"
                titleText="Aggregation"
                label="Select aggregation"
                items={aggregationOptions}
                selectedItem={aggregationOptions.find(a => a.id === selectedAggregation)}
                onChange={({ selectedItem }) => setSelectedAggregation(selectedItem?.id || 'daily')}
              />

              {selectedTimeRange === 'custom' && (
                <DatePicker
                  datePickerType="range"
                  onChange={(dates) => setCustomDateRange(dates)}
                >
                  <DatePickerInput
                    id="start-date"
                    placeholder="mm/dd/yyyy"
                    labelText="Start date"
                    size="md"
                  />
                  <DatePickerInput
                    id="end-date"
                    placeholder="mm/dd/yyyy"
                    labelText="End date"
                    size="md"
                  />
                </DatePicker>
              )}
            </div>
          </Tile>
        </Column>

        {/* Key Metrics Overview */}
        <Column lg={4} md={2} sm={1}>
          <Tile className="metric-tile">
            <div className="metric-content">
              <div className="metric-icon">
                <Document size={24} />
              </div>
              <div className="metric-text">
                <h3>{formatNumber(analyticsData?.totalContexts || 0)}</h3>
                <p>Total Contexts</p>
                {overviewData?.growth?.contexts && (
                  <div className="metric-growth">
                    {formatGrowth(overviewData.growth.contexts.growth30d)}
                  </div>
                )}
              </div>
            </div>
          </Tile>
        </Column>

        <Column lg={4} md={2} sm={1}>
          <Tile className="metric-tile">
            <div className="metric-content">
              <div className="metric-icon">
                <ChartLine size={24} />
              </div>
              <div className="metric-text">
                <h3>{formatNumber(analyticsData?.totalTokens || 0)}</h3>
                <p>Total Tokens</p>
                <div className="metric-growth">
                  {formatGrowth(8.5)}
                </div>
              </div>
            </div>
          </Tile>
        </Column>

        <Column lg={4} md={2} sm={1}>
          <Tile className="metric-tile">
            <div className="metric-content">
              <div className="metric-icon">
                <Users size={24} />
              </div>
              <div className="metric-text">
                <h3>{analyticsData?.activeUsers || 0}</h3>
                <p>Active Users</p>
                {overviewData?.growth?.users && (
                  <div className="metric-growth">
                    {formatGrowth(overviewData.growth.users.growth30d)}
                  </div>
                )}
              </div>
            </div>
          </Tile>
        </Column>

        <Column lg={4} md={2} sm={1}>
          <Tile className="metric-tile">
            <div className="metric-content">
              <div className="metric-icon">
                <Time size={24} />
              </div>
              <div className="metric-text">
                <h3>{analyticsData?.performanceMetrics?.averageResponseTime?.toFixed(0) || 0}ms</h3>
                <p>Avg Response Time</p>
                <div className="metric-growth">
                  {formatGrowth(-2.3)}
                </div>
              </div>
            </div>
          </Tile>
        </Column>

        {/* Detailed Analytics Tabs */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="analytics-tabs">
            <Tabs>
              <TabList>
                <Tab>Usage Analytics</Tab>
                <Tab>Performance Metrics</Tab>
                <Tab>User Activity</Tab>
                <Tab>Content Insights</Tab>
              </TabList>
              <TabPanels>
                {/* Usage Analytics */}
                <TabPanel>
                  <div className="tab-content">
                    <Grid>
                      <Column lg={10} md={5} sm={3}>
                        <div className="chart-container">
                          <h4>Context Creation Trends</h4>
                          <div className="chart-placeholder">
                            <ChartLine size={48} />
                            <p>Interactive time series chart showing context creation over time</p>
                            <p className="chart-data">
                              Showing {analyticsData?.timeSeriesData?.daily?.length || 0} data points
                            </p>
                          </div>
                        </div>
                      </Column>
                      <Column lg={6} md={3} sm={1}>
                        <div className="insights-panel">
                          <h4>Top Content Types</h4>
                          <div className="type-list">
                            {Object.entries(analyticsData?.contextsByType || {})
                              .sort(([,a], [,b]) => b - a)
                              .slice(0, 5)
                              .map(([type, count]) => (
                                <div key={type} className="type-item">
                                  <span className="type-name">{type}</span>
                                  <div className="type-bar">
                                    <div 
                                      className="type-progress" 
                                      style={{ 
                                        width: `${(count / Math.max(...Object.values(analyticsData?.contextsByType || {}))) * 100}%` 
                                      }}
                                    />
                                    <span className="type-count">{count}</span>
                                  </div>
                                </div>
                              ))}
                          </div>
                        </div>
                      </Column>
                    </Grid>
                  </div>
                </TabPanel>

                {/* Performance Metrics */}
                <TabPanel>
                  <div className="tab-content">
                    <Grid>
                      <Column lg={8} md={4} sm={2}>
                        <div className="performance-metrics">
                          <h4>System Performance</h4>
                          <div className="metric-grid">
                            <div className="perf-metric">
                              <span className="perf-label">Memory Usage</span>
                              <span className="perf-value">
                                {analyticsData?.performanceMetrics?.memoryUsage?.toFixed(1) || 0} MB
                              </span>
                            </div>
                            <div className="perf-metric">
                              <span className="perf-label">Cache Hit Rate</span>
                              <span className="perf-value">
                                {((analyticsData?.performanceMetrics?.cacheHitRate || 0) * 100).toFixed(1)}%
                              </span>
                            </div>
                            <div className="perf-metric">
                              <span className="perf-label">Error Rate</span>
                              <span className="perf-value">
                                {((analyticsData?.performanceMetrics?.errorRate || 0) * 100).toFixed(2)}%
                              </span>
                            </div>
                            <div className="perf-metric">
                              <span className="perf-label">Total Requests</span>
                              <span className="perf-value">
                                {formatNumber(analyticsData?.performanceMetrics?.totalRequests || 0)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </Column>
                      <Column lg={8} md={4} sm={2}>
                        <div className="performance-chart">
                          <h4>Response Time Trends</h4>
                          <div className="chart-placeholder">
                            <TrendUp size={48} />
                            <p>Real-time performance monitoring chart</p>
                          </div>
                        </div>
                      </Column>
                    </Grid>
                  </div>
                </TabPanel>

                {/* User Activity */}
                <TabPanel>
                  <div className="tab-content">
                    <DataTable
                      rows={analyticsData?.userActivity?.map(user => ({
                        id: user.userId,
                        userId: user.userId,
                        contexts: user.contextCount,
                        tokens: formatNumber(user.totalTokens),
                        average: Math.round(user.averageTokensPerContext),
                        lastActivity: new Date(user.lastActivity).toLocaleDateString(),
                        topTags: user.mostUsedTags.slice(0, 3).join(', '),
                      })) || []}
                      headers={[
                        { key: 'userId', header: 'User ID' },
                        { key: 'contexts', header: 'Contexts' },
                        { key: 'tokens', header: 'Total Tokens' },
                        { key: 'average', header: 'Avg Tokens/Context' },
                        { key: 'lastActivity', header: 'Last Activity' },
                        { key: 'topTags', header: 'Top Tags' },
                      ]}
                      size="md"
                    >
                      {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                        <TableContainer title="User Activity Summary">
                          <Table {...getTableProps()}>
                            <TableHead>
                              <TableRow>
                                {headers.map((header) => (
                                  <TableHeader {...getHeaderProps({ header })} key={header.key}>
                                    {header.header}
                                  </TableHeader>
                                ))}
                              </TableRow>
                            </TableHead>
                            <TableBody>
                              {rows.map((row) => (
                                <TableRow {...getRowProps({ row })} key={row.id}>
                                  {row.cells.map((cell) => (
                                    <TableCell key={cell.id}>{cell.value}</TableCell>
                                  ))}
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </TableContainer>
                      )}
                    </DataTable>
                  </div>
                </TabPanel>

                {/* Content Insights */}
                <TabPanel>
                  <div className="tab-content">
                    <Grid>
                      <Column lg={8} md={4} sm={2}>
                        <h4>Tag Cloud</h4>
                        <div className="tag-cloud">
                          {Object.entries(analyticsData?.contextsByTag || {})
                            .sort(([,a], [,b]) => b - a)
                            .slice(0, 20)
                            .map(([tag, count]) => {
                              const maxCount = Math.max(...Object.values(analyticsData?.contextsByTag || {}));
                              const size = Math.max(0.8, (count / maxCount) * 2);
                              return (
                                <Tag
                                  key={tag}
                                  type="blue"
                                  size="md"
                                  style={{
                                    fontSize: `${size}rem`,
                                    margin: '0.25rem',
                                  }}
                                >
                                  {tag} ({count})
                                </Tag>
                              );
                            })}
                        </div>
                      </Column>
                      <Column lg={8} md={4} sm={2}>
                        <h4>Content Statistics</h4>
                        <div className="content-stats">
                          <div className="stat-item">
                            <span className="stat-label">Average Context Length</span>
                            <span className="stat-value">
                              {Math.round(analyticsData?.averageContextLength || 0)} characters
                            </span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Unique Tags</span>
                            <span className="stat-value">
                              {Object.keys(analyticsData?.contextsByTag || {}).length}
                            </span>
                          </div>
                          <div className="stat-item">
                            <span className="stat-label">Content Types</span>
                            <span className="stat-value">
                              {Object.keys(analyticsData?.contextsByType || {}).length}
                            </span>
                          </div>
                        </div>
                      </Column>
                    </Grid>
                  </div>
                </TabPanel>
              </TabPanels>
            </Tabs>
          </Tile>
        </Column>
      </Grid>

      {/* Report Generation Modal */}
      <Modal
        open={isReportModalOpen}
        onRequestClose={() => setIsReportModalOpen(false)}
        modalHeading="Generate Analytics Report"
        primaryButtonText="Generate Report"
        secondaryButtonText="Cancel"
        onRequestSubmit={handleGenerateReport}
        primaryButtonDisabled={generateReportMutation.isPending}
        size="md"
      >
        <div className="modal-content">
          <Dropdown
            id="report-type"
            titleText="Report Type"
            label="Select report type"
            items={reportTypeOptions}
            selectedItem={reportTypeOptions.find(t => t.id === reportConfig.type)}
            onChange={({ selectedItem }) => 
              setReportConfig(prev => ({ ...prev, type: selectedItem?.id as any || 'usage' }))
            }
          />

          <Dropdown
            id="report-format"
            titleText="Format"
            label="Select format"
            items={formatOptions}
            selectedItem={formatOptions.find(f => f.id === reportConfig.format)}
            onChange={({ selectedItem }) => 
              setReportConfig(prev => ({ ...prev, format: selectedItem?.id as any || 'json' }))
            }
          />

          <Toggle
            labelText="Include Charts"
            id="include-charts"
            toggled={reportConfig.includeCharts || false}
            onToggle={(toggled) => 
              setReportConfig(prev => ({ ...prev, includeCharts: toggled }))
            }
          />

          {generateReportMutation.isPending && (
            <div className="generation-progress">
              <ProgressBar label="Generating report..." />
            </div>
          )}
        </div>
      </Modal>

      {/* Export Data Modal */}
      <Modal
        open={isExportModalOpen}
        onRequestClose={() => setIsExportModalOpen(false)}
        modalHeading="Export Analytics Data"
        primaryButtonText="Export"
        secondaryButtonText="Cancel"
        onRequestSubmit={() => {
          const format = (document.querySelector('#export-format select') as HTMLSelectElement)?.value || 'json';
          const includeCharts = (document.querySelector('#export-charts input') as HTMLInputElement)?.checked || false;
          handleExportData(format, includeCharts);
        }}
        primaryButtonDisabled={exportDataMutation.isPending}
        size="md"
      >
        <div className="modal-content">
          <Select id="export-format" labelText="Export Format" defaultValue="json">
            <SelectItem value="json" text="JSON" />
            <SelectItem value="csv" text="CSV" />
            <SelectItem value="xlsx" text="Excel (XLSX)" />
          </Select>

          <Toggle
            labelText="Include Charts Data"
            id="export-charts"
            defaultToggled={false}
          />

          <div className="export-info">
            <p>
              This will export analytics data for the selected time range ({selectedTimeRange}) 
              with {selectedAggregation} aggregation.
            </p>
          </div>

          {exportDataMutation.isPending && (
            <div className="export-progress">
              <ProgressBar label="Exporting data..." />
            </div>
          )}
        </div>
      </Modal>

      <style jsx>{`
        .analytics-page {
          padding: var(--cds-spacing-06);
        }

        .page-header {
          margin-bottom: var(--cds-spacing-06);
        }

        .header-content {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: var(--cds-spacing-06);
        }

        .page-title {
          display: flex;
          align-items: center;
          gap: var(--cds-spacing-03);
          font-size: 2rem;
          font-weight: 600;
          margin-bottom: var(--cds-spacing-02);
          color: var(--cds-text-primary);
        }

        .page-subtitle {
          color: var(--cds-text-secondary);
          font-size: 1.125rem;
          margin: 0;
        }

        .header-actions {
          display: flex;
          gap: var(--cds-spacing-03);
        }

        .controls-tile,
        .metric-tile,
        .analytics-tabs {
          margin-bottom: var(--cds-spacing-05);
          padding: var(--cds-spacing-05);
        }

        .controls-content {
          display: flex;
          gap: var(--cds-spacing-05);
          align-items: end;
          flex-wrap: wrap;
        }

        .metric-content {
          display: flex;
          align-items: center;
          gap: var(--cds-spacing-04);
        }

        .metric-icon {
          color: var(--cds-icon-primary);
        }

        .metric-text h3 {
          font-size: 1.75rem;
          font-weight: 600;
          margin: 0;
          color: var(--cds-text-primary);
        }

        .metric-text p {
          margin: 0;
          color: var(--cds-text-secondary);
          font-size: 0.875rem;
        }

        .metric-growth {
          margin-top: var(--cds-spacing-02);
        }

        .tab-content {
          padding: var(--cds-spacing-05) 0;
        }

        .chart-container,
        .insights-panel,
        .performance-metrics,
        .performance-chart {
          padding: var(--cds-spacing-04);
          border: 1px solid var(--cds-border-subtle-01);
          border-radius: var(--cds-border-radius);
          margin-bottom: var(--cds-spacing-04);
        }

        .chart-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 300px;
          color: var(--cds-text-secondary);
          text-align: center;
        }

        .chart-placeholder svg {
          margin-bottom: var(--cds-spacing-04);
          opacity: 0.5;
        }

        .chart-data {
          font-size: 0.875rem;
          margin-top: var(--cds-spacing-02);
        }

        .type-list {
          display: flex;
          flex-direction: column;
          gap: var(--cds-spacing-03);
        }

        .type-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .type-name {
          font-size: 0.875rem;
          font-weight: 500;
        }

        .type-bar {
          display: flex;
          align-items: center;
          gap: var(--cds-spacing-02);
          flex: 1;
          margin-left: var(--cds-spacing-04);
        }

        .type-progress {
          height: 4px;
          background-color: var(--cds-support-info);
          border-radius: 2px;
          min-width: 4px;
        }

        .type-count {
          font-size: 0.75rem;
          color: var(--cds-text-secondary);
          min-width: 30px;
          text-align: right;
        }

        .metric-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: var(--cds-spacing-04);
        }

        .perf-metric {
          display: flex;
          flex-direction: column;
          padding: var(--cds-spacing-04);
          border: 1px solid var(--cds-border-subtle-01);
          border-radius: var(--cds-border-radius);
        }

        .perf-label {
          font-size: 0.875rem;
          color: var(--cds-text-secondary);
          margin-bottom: var(--cds-spacing-02);
        }

        .perf-value {
          font-size: 1.25rem;
          font-weight: 600;
          color: var(--cds-text-primary);
        }

        .tag-cloud {
          display: flex;
          flex-wrap: wrap;
          gap: var(--cds-spacing-02);
          padding: var(--cds-spacing-04);
        }

        .content-stats {
          display: flex;
          flex-direction: column;
          gap: var(--cds-spacing-04);
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: var(--cds-spacing-03);
          border-bottom: 1px solid var(--cds-border-subtle-01);
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--cds-text-secondary);
        }

        .stat-value {
          font-weight: 600;
          color: var(--cds-text-primary);
        }

        .modal-content {
          display: flex;
          flex-direction: column;
          gap: var(--cds-spacing-05);
        }

        .generation-progress,
        .export-progress {
          margin: var(--cds-spacing-04) 0;
        }

        .export-info {
          padding: var(--cds-spacing-04);
          background-color: var(--cds-background-hover);
          border-radius: var(--cds-border-radius);
          font-size: 0.875rem;
          color: var(--cds-text-secondary);
        }

        @media (max-width: 768px) {
          .analytics-page {
            padding: var(--cds-spacing-04);
          }

          .header-content {
            flex-direction: column;
            align-items: stretch;
          }

          .page-title {
            font-size: 1.5rem;
          }

          .controls-content {
            flex-direction: column;
            align-items: stretch;
          }

          .metric-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};