import React, { useState } from 'react';
import {
  Grid,
  Column,
  Tile,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableHeader,
  TableBody,
  TableCell,
  Button,
  Tag,
  ProgressBar,
  Tabs,
  TabList,
  Tab,
  TabPanels,
  TabPanel,
  Toggle,
  InlineNotification,
} from '@carbon/react';
import {
  Checkmark,
  Warning,
  ErrorFilled,
  Renew,
  Analytics,
  Time,
} from '@carbon/icons-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useNotification } from '../hooks/useNotification';

interface HealthMetric {
  component: string;
  status: 'healthy' | 'warning' | 'critical' | 'unknown';
  responseTime?: number;
  lastCheck: string;
  details?: string;
  uptime?: number;
}

interface HealthHistory {
  timestamp: string;
  overallStatus: string;
  components: HealthMetric[];
}

export const SystemHealthPage: React.FC = () => {
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { showSuccess, showError } = useNotification();
  const queryClient = useQueryClient();

  const {
    data: healthData,
    isLoading: healthLoading,
    error: healthError,
  } = useQuery({
    queryKey: ['system-health-detailed'],
    queryFn: async () => {
      const response = await api.getDetailedSystemHealth();
      return response.data;
    },
    refetchInterval: autoRefresh ? 10000 : false,
  });

  const {
    data: historyData,
    isLoading: historyLoading,
  } = useQuery({
    queryKey: ['health-history'],
    queryFn: async () => {
      const response = await api.getHealthMetricsHistory(50);
      return response.data;
    },
    refetchInterval: autoRefresh ? 30000 : false,
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const response = await api.getDetailedSystemHealth();
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['system-health-detailed'] });
      showSuccess('Health Check', 'System health refreshed successfully');
    },
    onError: () => {
      showError('Health Check Failed', 'Unable to refresh system health');
    },
  });

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <Checkmark size={16} style={{ color: '#42be65' }} />;
      case 'warning':
        return <Warning size={16} style={{ color: '#f1c21b' }} />;
      case 'critical':
        return <ErrorFilled size={16} style={{ color: '#da1e28' }} />;
      default:
        return <Time size={16} style={{ color: '#525252' }} />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'green';
      case 'warning':
        return 'yellow';
      case 'critical':
        return 'red';
      default:
        return 'gray';
    }
  };

  const formatUptime = (seconds: number) => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) return `${days}d ${hours}h ${minutes}m`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  if (healthLoading) {
    return <LoadingSpinner size="lg" description="Loading system health..." />;
  }

  if (healthError) {
    return (
      <InlineNotification
        kind="error"
        title="Health Check Failed"
        subtitle="Unable to load system health information"
      />
    );
  }

  const componentHeaders = [
    { key: 'component', header: 'Component' },
    { key: 'status', header: 'Status' },
    { key: 'responseTime', header: 'Response Time' },
    { key: 'uptime', header: 'Uptime' },
    { key: 'lastCheck', header: 'Last Check' },
  ];

  const componentRows = healthData?.components?.map((metric: HealthMetric) => ({
    id: metric.component,
    component: metric.component,
    status: (
      <div className="status-cell">
        {getStatusIcon(metric.status)}
        <Tag type={getStatusColor(metric.status)}>
          {metric.status}
        </Tag>
      </div>
    ),
    responseTime: metric.responseTime ? `${metric.responseTime}ms` : 'N/A',
    uptime: metric.uptime ? formatUptime(metric.uptime) : 'N/A',
    lastCheck: new Date(metric.lastCheck).toLocaleString(),
  })) || [];

  const historyHeaders = [
    { key: 'timestamp', header: 'Timestamp' },
    { key: 'overallStatus', header: 'Overall Status' },
    { key: 'issues', header: 'Issues' },
  ];

  const historyRows = historyData?.map((record: HealthHistory, index: number) => {
    const issues = record.components.filter(c => c.status !== 'healthy');
    return {
      id: index.toString(),
      timestamp: new Date(record.timestamp).toLocaleString(),
      overallStatus: (
        <Tag type={getStatusColor(record.overallStatus)}>
          {record.overallStatus}
        </Tag>
      ),
      issues: issues.length > 0 ? `${issues.length} component(s)` : 'None',
    };
  }) || [];

  return (
    <div className="system-health-page">
      <Grid>
        {/* Header */}
        <Column lg={16} md={8} sm={4} className="page-header">
          <div className="header-content">
            <div className="header-text">
              <h1 className="page-title">
                <Analytics size={32} />
                System Health Monitor
              </h1>
              <p className="page-subtitle">
                Real-time monitoring of system components and services
              </p>
            </div>
            <div className="header-actions">
              <Toggle
                id="auto-refresh-toggle"
                labelText="Auto-refresh"
                toggled={autoRefresh}
                onToggle={setAutoRefresh}
              />
              <Button
                kind="secondary"
                renderIcon={Renew}
                onClick={() => refreshMutation.mutate()}
                disabled={refreshMutation.isPending}
              >
                {refreshMutation.isPending ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          </div>
        </Column>

        {/* Overall Status */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="overall-status-tile">
            <div className="overall-status">
              <div className="status-indicator">
                {getStatusIcon(healthData?.overallStatus)}
                <div className="status-text">
                  <h2>System Status: {healthData?.overallStatus || 'Unknown'}</h2>
                  <p>Last updated: {healthData?.lastUpdated ? new Date(healthData.lastUpdated).toLocaleString() : 'Never'}</p>
                </div>
              </div>
              {healthData?.message && (
                <p className="status-message">{healthData.message}</p>
              )}
            </div>
          </Tile>
        </Column>

        {/* System Metrics */}
        <Column lg={8} md={4} sm={2}>
          <Tile className="metrics-tile">
            <h3>System Metrics</h3>
            <div className="metrics-grid">
              <div className="metric-item">
                <label>Memory Usage</label>
                <ProgressBar
                  value={healthData?.systemMetrics?.memoryUsage || 0}
                  max={100}
                  label={`${healthData?.systemMetrics?.memoryUsage || 0}%`}
                />
              </div>
              <div className="metric-item">
                <label>CPU Usage</label>
                <ProgressBar
                  value={healthData?.systemMetrics?.cpuUsage || 0}
                  max={100}
                  label={`${healthData?.systemMetrics?.cpuUsage || 0}%`}
                />
              </div>
              <div className="metric-item">
                <label>Disk Usage</label>
                <ProgressBar
                  value={healthData?.systemMetrics?.diskUsage || 0}
                  max={100}
                  label={`${healthData?.systemMetrics?.diskUsage || 0}%`}
                />
              </div>
            </div>
          </Tile>
        </Column>

        {/* Active Connections */}
        <Column lg={8} md={4} sm={2}>
          <Tile className="connections-tile">
            <h3>Active Connections</h3>
            <div className="connection-stats">
              <div className="stat-item">
                <span className="stat-value">{healthData?.connections?.database || 0}</span>
                <span className="stat-label">Database</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{healthData?.connections?.cache || 0}</span>
                <span className="stat-label">Cache</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{healthData?.connections?.websocket || 0}</span>
                <span className="stat-label">WebSocket</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{healthData?.connections?.http || 0}</span>
                <span className="stat-label">HTTP</span>
              </div>
            </div>
          </Tile>
        </Column>

        {/* Health Details Tabs */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="health-details-tile">
            <Tabs>
              <TabList aria-label="Health details tabs">
                <Tab>Component Status</Tab>
                <Tab>Health History</Tab>
                <Tab>Performance</Tab>
              </TabList>
              <TabPanels>
                <TabPanel>
                  <DataTable
                    rows={componentRows}
                    headers={componentHeaders}
                    size="md"
                  >
                    {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                      <TableContainer>
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
                </TabPanel>
                
                <TabPanel>
                  {historyLoading ? (
                    <LoadingSpinner description="Loading health history..." />
                  ) : (
                    <DataTable
                      rows={historyRows}
                      headers={historyHeaders}
                      size="md"
                    >
                      {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
                        <TableContainer>
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
                  )}
                </TabPanel>

                <TabPanel>
                  <div className="performance-metrics">
                    <Grid>
                      <Column lg={8} md={4} sm={2}>
                        <div className="performance-chart">
                          <h4>Response Times (Last 24h)</h4>
                          <div className="chart-placeholder">
                            <Analytics size={48} />
                            <p>Chart visualization would be rendered here</p>
                          </div>
                        </div>
                      </Column>
                      <Column lg={8} md={4} sm={2}>
                        <div className="performance-chart">
                          <h4>System Load (Last 24h)</h4>
                          <div className="chart-placeholder">
                            <Analytics size={48} />
                            <p>Chart visualization would be rendered here</p>
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

      <style jsx>{`
        .system-health-page {
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
          align-items: center;
          gap: var(--cds-spacing-04);
        }

        .overall-status-tile,
        .metrics-tile,
        .connections-tile,
        .health-details-tile {
          margin-bottom: var(--cds-spacing-05);
          padding: var(--cds-spacing-05);
        }

        .overall-status {
          display: flex;
          flex-direction: column;
          gap: var(--cds-spacing-04);
        }

        .status-indicator {
          display: flex;
          align-items: center;
          gap: var(--cds-spacing-04);
        }

        .status-text h2 {
          margin: 0;
          color: var(--cds-text-primary);
          font-size: 1.5rem;
          font-weight: 600;
        }

        .status-text p {
          margin: var(--cds-spacing-02) 0 0 0;
          color: var(--cds-text-secondary);
        }

        .status-message {
          color: var(--cds-text-secondary);
          font-style: italic;
          margin: 0;
        }

        .metrics-tile h3,
        .connections-tile h3 {
          margin: 0 0 var(--cds-spacing-04) 0;
          color: var(--cds-text-primary);
          font-size: 1.125rem;
          font-weight: 600;
        }

        .metrics-grid {
          display: flex;
          flex-direction: column;
          gap: var(--cds-spacing-05);
        }

        .metric-item label {
          display: block;
          margin-bottom: var(--cds-spacing-02);
          color: var(--cds-text-secondary);
          font-weight: 500;
        }

        .connection-stats {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: var(--cds-spacing-04);
        }

        .stat-item {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: var(--cds-spacing-04);
          border: 1px solid var(--cds-border-subtle-01);
          border-radius: 4px;
        }

        .stat-value {
          font-size: 1.5rem;
          font-weight: 600;
          color: var(--cds-text-primary);
        }

        .stat-label {
          font-size: 0.875rem;
          color: var(--cds-text-secondary);
          margin-top: var(--cds-spacing-01);
        }

        .status-cell {
          display: flex;
          align-items: center;
          gap: var(--cds-spacing-02);
        }

        .performance-metrics {
          padding: var(--cds-spacing-04) 0;
        }

        .performance-chart h4 {
          margin: 0 0 var(--cds-spacing-04) 0;
          color: var(--cds-text-primary);
        }

        .chart-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px;
          border: 2px dashed var(--cds-border-subtle-01);
          border-radius: 4px;
          color: var(--cds-text-secondary);
        }

        .chart-placeholder p {
          margin: var(--cds-spacing-03) 0 0 0;
          font-style: italic;
        }

        @media (max-width: 768px) {
          .system-health-page {
            padding: var(--cds-spacing-04);
          }

          .header-content {
            flex-direction: column;
            align-items: stretch;
          }

          .page-title {
            font-size: 1.5rem;
          }

          .connection-stats {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};