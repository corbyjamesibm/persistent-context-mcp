import React, { useEffect, useState } from 'react';
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
  SkeletonText,
} from '@carbon/react';
import {
  Dashboard,
  Folder,
  User,
  Analytics,
  Warning,
  CheckmarkFilled,
  Time,
} from '@carbon/icons-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../services/api';
import { LoadingSpinner } from '../components/common/LoadingSpinner';
import { useNotification } from '../hooks/useNotification';

interface SystemStats {
  totalContexts: number;
  activeUsers: number;
  systemHealth: 'healthy' | 'warning' | 'critical';
  memoryUsage: number;
  cpuUsage: number;
  lastBackup: string;
  recentContexts: Array<{
    id: string;
    title: string;
    type: string;
    createdAt: string;
    author: string;
  }>;
}

export const DashboardPage: React.FC = () => {
  const { showError } = useNotification();

  const {
    data: systemStats,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await api.get<SystemStats>('/dashboard/stats');
      return response.data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const {
    data: healthData,
    isLoading: healthLoading,
  } = useQuery({
    queryKey: ['system-health'],
    queryFn: async () => {
      const response = await api.getSystemHealth();
      return response.data;
    },
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  useEffect(() => {
    if (statsError) {
      showError('Dashboard Error', 'Failed to load dashboard statistics');
    }
  }, [statsError, showError]);

  const getHealthStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return <CheckmarkFilled size={16} style={{ color: '#42be65' }} />;
      case 'warning':
        return <Warning size={16} style={{ color: '#f1c21b' }} />;
      case 'critical':
        return <Warning size={16} style={{ color: '#da1e28' }} />;
      default:
        return <Time size={16} style={{ color: '#525252' }} />;
    }
  };

  const getHealthStatusColor = (status: string) => {
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

  if (statsLoading) {
    return <LoadingSpinner size="lg" description="Loading dashboard..." />;
  }

  const recentContextsHeaders = [
    { key: 'title', header: 'Title' },
    { key: 'type', header: 'Type' },
    { key: 'author', header: 'Author' },
    { key: 'createdAt', header: 'Created' },
  ];

  const recentContextsRows = systemStats?.recentContexts.map((context) => ({
    id: context.id,
    title: context.title,
    type: <Tag type="outline">{context.type}</Tag>,
    author: context.author,
    createdAt: new Date(context.createdAt).toLocaleDateString(),
  })) || [];

  return (
    <div className="dashboard-page">
      <Grid>
        {/* Header */}
        <Column lg={16} md={8} sm={4} className="dashboard-header">
          <h1 className="dashboard-title">
            <Dashboard size={32} />
            Context Store Admin Dashboard
          </h1>
          <p className="dashboard-subtitle">
            Monitor and manage your persistent context store system
          </p>
        </Column>

        {/* Key Metrics */}
        <Column lg={4} md={2} sm={1}>
          <Tile className="metric-tile">
            <div className="metric-content">
              <Folder size={24} className="metric-icon" />
              <div className="metric-text">
                <h3>{systemStats?.totalContexts || 0}</h3>
                <p>Total Contexts</p>
              </div>
            </div>
          </Tile>
        </Column>

        <Column lg={4} md={2} sm={1}>
          <Tile className="metric-tile">
            <div className="metric-content">
              <User size={24} className="metric-icon" />
              <div className="metric-text">
                <h3>{systemStats?.activeUsers || 0}</h3>
                <p>Active Users</p>
              </div>
            </div>
          </Tile>
        </Column>

        <Column lg={4} md={2} sm={1}>
          <Tile className="metric-tile">
            <div className="metric-content">
              <Analytics size={24} className="metric-icon" />
              <div className="metric-text">
                <div className="metric-status">
                  {getHealthStatusIcon(systemStats?.systemHealth || 'unknown')}
                  <Tag type={getHealthStatusColor(systemStats?.systemHealth || 'unknown') as any}>
                    {systemStats?.systemHealth || 'Unknown'}
                  </Tag>
                </div>
                <p>System Health</p>
              </div>
            </div>
          </Tile>
        </Column>

        <Column lg={4} md={2} sm={1}>
          <Tile className="metric-tile">
            <div className="metric-content">
              <Analytics size={24} className="metric-icon" />
              <div className="metric-text">
                <h3>{systemStats?.lastBackup ? new Date(systemStats.lastBackup).toLocaleDateString() : 'Never'}</h3>
                <p>Last Backup</p>
              </div>
            </div>
          </Tile>
        </Column>

        {/* System Resources */}
        <Column lg={8} md={4} sm={2}>
          <Tile className="resource-tile">
            <h4>System Resources</h4>
            <div className="resource-metrics">
              <div className="resource-item">
                <label>Memory Usage</label>
                <ProgressBar
                  value={systemStats?.memoryUsage || 0}
                  max={100}
                  label={`${systemStats?.memoryUsage || 0}%`}
                  helperText="Current memory utilization"
                />
              </div>
              <div className="resource-item">
                <label>CPU Usage</label>
                <ProgressBar
                  value={systemStats?.cpuUsage || 0}
                  max={100}
                  label={`${systemStats?.cpuUsage || 0}%`}
                  helperText="Current CPU utilization"
                />
              </div>
            </div>
          </Tile>
        </Column>

        {/* System Health Details */}
        <Column lg={8} md={4} sm={2}>
          <Tile className="health-tile">
            <h4>System Health Details</h4>
            {healthLoading ? (
              <SkeletonText paragraph lineCount={4} />
            ) : (
              <div className="health-details">
                <div className="health-item">
                  <span className="health-label">Database:</span>
                  <Tag type={healthData?.database?.status === 'healthy' ? 'green' : 'red'}>
                    {healthData?.database?.status || 'Unknown'}
                  </Tag>
                </div>
                <div className="health-item">
                  <span className="health-label">Redis Cache:</span>
                  <Tag type={healthData?.cache?.status === 'healthy' ? 'green' : 'red'}>
                    {healthData?.cache?.status || 'Unknown'}
                  </Tag>
                </div>
                <div className="health-item">
                  <span className="health-label">File System:</span>
                  <Tag type={healthData?.fileSystem?.status === 'healthy' ? 'green' : 'red'}>
                    {healthData?.fileSystem?.status || 'Unknown'}
                  </Tag>
                </div>
                <div className="health-item">
                  <span className="health-label">API Services:</span>
                  <Tag type={healthData?.apiServices?.status === 'healthy' ? 'green' : 'red'}>
                    {healthData?.apiServices?.status || 'Unknown'}
                  </Tag>
                </div>
              </div>
            )}
          </Tile>
        </Column>

        {/* Recent Contexts */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="recent-contexts-tile">
            <div className="tile-header">
              <h4>Recent Contexts</h4>
              <Button kind="ghost" size="sm" href="/contexts">
                View All
              </Button>
            </div>
            
            <DataTable
              rows={recentContextsRows}
              headers={recentContextsHeaders}
              size="sm"
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
                      {rows.length > 0 ? (
                        rows.map((row) => (
                          <TableRow {...getRowProps({ row })} key={row.id}>
                            {row.cells.map((cell) => (
                              <TableCell key={cell.id}>{cell.value}</TableCell>
                            ))}
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={headers.length}>
                            No recent contexts found
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </DataTable>
          </Tile>
        </Column>

        {/* Quick Actions */}
        <Column lg={16} md={8} sm={4}>
          <Tile className="quick-actions-tile">
            <h4>Quick Actions</h4>
            <div className="quick-actions">
              <Button
                kind="primary"
                href="/contexts"
                renderIcon={Folder}
              >
                Manage Contexts
              </Button>
              <Button
                kind="secondary"
                href="/system/health"
                renderIcon={Analytics}
              >
                System Health
              </Button>
              <Button
                kind="tertiary"
                href="/users"
                renderIcon={User}
              >
                User Management
              </Button>
              <Button
                kind="ghost"
                href="/settings"
                renderIcon={Analytics}
              >
                Settings
              </Button>
            </div>
          </Tile>
        </Column>
      </Grid>

      <style jsx>{`
        .dashboard-page {
          padding: var(--cds-spacing-06);
        }

        .dashboard-header {
          margin-bottom: var(--cds-spacing-06);
        }

        .dashboard-title {
          display: flex;
          align-items: center;
          gap: var(--cds-spacing-03);
          font-size: 2rem;
          font-weight: 600;
          margin-bottom: var(--cds-spacing-02);
          color: var(--cds-text-primary);
        }

        .dashboard-subtitle {
          color: var(--cds-text-secondary);
          font-size: 1.125rem;
          margin: 0;
        }

        .metric-tile {
          height: 120px;
          margin-bottom: var(--cds-spacing-05);
        }

        .metric-content {
          display: flex;
          align-items: center;
          gap: var(--cds-spacing-04);
          height: 100%;
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

        .metric-status {
          display: flex;
          align-items: center;
          gap: var(--cds-spacing-02);
        }

        .resource-tile,
        .health-tile,
        .recent-contexts-tile,
        .quick-actions-tile {
          margin-bottom: var(--cds-spacing-05);
          padding: var(--cds-spacing-05);
        }

        .resource-tile h4,
        .health-tile h4,
        .recent-contexts-tile h4,
        .quick-actions-tile h4 {
          margin: 0 0 var(--cds-spacing-04) 0;
          color: var(--cds-text-primary);
          font-size: 1.125rem;
          font-weight: 600;
        }

        .resource-metrics {
          display: flex;
          flex-direction: column;
          gap: var(--cds-spacing-05);
        }

        .resource-item label {
          display: block;
          margin-bottom: var(--cds-spacing-02);
          color: var(--cds-text-secondary);
          font-weight: 500;
        }

        .health-details {
          display: flex;
          flex-direction: column;
          gap: var(--cds-spacing-03);
        }

        .health-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .health-label {
          color: var(--cds-text-secondary);
          font-weight: 500;
        }

        .tile-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: var(--cds-spacing-04);
        }

        .quick-actions {
          display: flex;
          gap: var(--cds-spacing-03);
          flex-wrap: wrap;
        }

        @media (max-width: 768px) {
          .dashboard-page {
            padding: var(--cds-spacing-04);
          }

          .dashboard-title {
            font-size: 1.5rem;
          }

          .quick-actions {
            flex-direction: column;
          }

          .quick-actions button {
            width: 100%;
          }
        }
      `}</style>
    </div>
  );
};