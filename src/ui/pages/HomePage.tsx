/**
 * Home/Dashboard page component
 * Shows overview of context store statistics and recent activity
 */

import React, { useState, useEffect } from 'react';
import {
  Grid,
  Column,
  Tile,
  SkeletonPlaceholder,
  SkeletonText,
  Heading,
  Button,
  DataTable,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableExpandHeader,
  TableHeader,
  TableBody,
  TableExpandRow,
  TableCell,
  TableExpandedRow,
} from '@carbon/react';
import { Add, ArrowRight, Document, Template, Network_3 } from '@carbon/react/icons';

interface DashboardStats {
  totalContexts: number;
  totalTemplates: number;
  totalConnections: number;
  activeUsers: number;
}

interface RecentContext {
  id: string;
  title: string;
  type: string;
  updatedAt: string;
  tokenCount: number;
}

export const HomePage: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentContexts, setRecentContexts] = useState<RecentContext[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate API call
    setTimeout(() => {
      setStats({
        totalContexts: 1247,
        totalTemplates: 89,
        totalConnections: 3421,
        activeUsers: 12,
      });
      setRecentContexts([
        {
          id: 'ctx_1',
          title: 'React Component Analysis',
          type: 'development',
          updatedAt: '2 hours ago',
          tokenCount: 2450,
        },
        {
          id: 'ctx_2',
          title: 'User Research Findings',
          type: 'analysis',
          updatedAt: '4 hours ago',
          tokenCount: 1820,
        },
        {
          id: 'ctx_3',
          title: 'API Documentation Review',
          type: 'planning',
          updatedAt: '1 day ago',
          tokenCount: 3200,
        },
      ]);
      setLoading(false);
    }, 1000);
  }, []);

  const headers = [
    { key: 'title', header: 'Title' },
    { key: 'type', header: 'Type' },
    { key: 'updatedAt', header: 'Last Updated' },
    { key: 'tokenCount', header: 'Tokens' },
  ];

  if (loading) {
    return (
      <div className="page-container">
        <Heading marginBottom={7}>Dashboard</Heading>
        <Grid>
          {[1, 2, 3, 4].map((i) => (
            <Column key={i} lg={4} md={4} sm={4}>
              <Tile>
                <SkeletonPlaceholder style={{ height: '2rem', width: '60%' }} />
                <SkeletonText paragraph={false} lineCount={1} />
              </Tile>
            </Column>
          ))}
        </Grid>
        <div style={{ marginTop: '2rem' }}>
          <SkeletonText heading paragraph lineCount={8} />
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <Heading marginBottom={0}>Dashboard</Heading>
        <Button renderIcon={Add} kind="primary">
          Create Context
        </Button>
      </div>

      {/* Stats Cards */}
      <Grid>
        <Column lg={4} md={4} sm={4}>
          <Tile className="stats-tile">
            <div className="stats-content">
              <Document size={32} className="stats-icon" />
              <div>
                <div className="stats-number">{stats?.totalContexts.toLocaleString()}</div>
                <div className="stats-label">Total Contexts</div>
              </div>
            </div>
          </Tile>
        </Column>
        <Column lg={4} md={4} sm={4}>
          <Tile className="stats-tile">
            <div className="stats-content">
              <Template size={32} className="stats-icon" />
              <div>
                <div className="stats-number">{stats?.totalTemplates.toLocaleString()}</div>
                <div className="stats-label">Templates</div>
              </div>
            </div>
          </Tile>
        </Column>
        <Column lg={4} md={4} sm={4}>
          <Tile className="stats-tile">
            <div className="stats-content">
              <Network_3 size={32} className="stats-icon" />
              <div>
                <div className="stats-number">{stats?.totalConnections.toLocaleString()}</div>
                <div className="stats-label">Connections</div>
              </div>
            </div>
          </Tile>
        </Column>
      </Grid>

      {/* Recent Activity */}
      <div style={{ marginTop: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <Heading size="md">Recent Activity</Heading>
          <Button kind="ghost" renderIcon={ArrowRight}>
            View All Contexts
          </Button>
        </div>

        <DataTable rows={recentContexts} headers={headers}>
          {({ rows, headers, getTableProps, getHeaderProps, getRowProps }) => (
            <TableContainer>
              <Table {...getTableProps()}>
                <TableHead>
                  <TableRow>
                    <TableExpandHeader />
                    {headers.map((header) => (
                      <TableHeader {...getHeaderProps({ header })}>
                        {header.header}
                      </TableHeader>
                    ))}
                  </TableRow>
                </TableHead>
                <TableBody>
                  {rows.map((row) => (
                    <React.Fragment key={row.id}>
                      <TableExpandRow {...getRowProps({ row })}>
                        {row.cells.map((cell) => (
                          <TableCell key={cell.id}>{cell.value}</TableCell>
                        ))}
                      </TableExpandRow>
                      <TableExpandedRow colSpan={headers.length + 1}>
                        <div style={{ padding: '1rem' }}>
                          <p>Context ID: {row.id}</p>
                          <p>Additional metadata and preview content would appear here.</p>
                        </div>
                      </TableExpandedRow>
                    </React.Fragment>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </DataTable>
      </div>
    </div>
  );
};