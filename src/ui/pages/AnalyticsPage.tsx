/**
 * Analytics page for context store insights and metrics
 */

import React, { useState, useEffect } from 'react';
import {
  Grid,
  Column,
  Tile,
  SkeletonPlaceholder,
  SkeletonText,
  DatePicker,
  DatePickerInput,
  Dropdown,
  Heading,
} from '@carbon/react';
import { Analytics, TrendUp, Users, Document } from '@carbon/react/icons';

interface AnalyticsData {
  totalContexts: number;
  totalTokens: number;
  activeUsers: number;
  templatesUsed: number;
  trends: {
    contextsCreated: number[];
    tokensProcessed: number[];
    templatesUsed: number[];
  };
  topTags: { tag: string; count: number }[];
  userActivity: { user: string; contexts: number; tokens: number }[];
}

const timeRanges = [
  { id: '7d', text: 'Last 7 days' },
  { id: '30d', text: 'Last 30 days' },
  { id: '90d', text: 'Last 90 days' },
  { id: 'custom', text: 'Custom range' },
];

export const AnalyticsPage: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedTimeRange, setSelectedTimeRange] = useState('30d');
  const [customDateRange, setCustomDateRange] = useState<[Date, Date] | null>(null);

  useEffect(() => {
    fetchAnalyticsData();
  }, [selectedTimeRange, customDateRange]);

  const fetchAnalyticsData = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      const mockData: AnalyticsData = {
        totalContexts: 1247,
        totalTokens: 2450000,
        activeUsers: 12,
        templatesUsed: 89,
        trends: {
          contextsCreated: [45, 52, 38, 61, 49, 67, 58, 73, 55, 42, 68, 51, 64, 39, 72, 46, 59, 65, 48, 71, 43, 56, 60, 74, 41, 63, 50, 69, 44, 57],
          tokensProcessed: [12500, 14200, 11800, 15900, 13400, 16700, 14100, 18200, 13900, 12100, 17300, 13600, 16200, 11700, 18400, 12800, 15100, 16800, 12900, 18100, 11900, 14600, 15700, 19200, 11500, 16400, 13200, 17900, 12300, 14800],
          templatesUsed: [8, 12, 6, 15, 9, 18, 11, 22, 14, 7, 19, 10, 16, 5, 23, 8, 13, 17, 9, 21, 6, 12, 15, 25, 7, 18, 11, 20, 8, 14],
        },
        topTags: [
          { tag: 'react', count: 89 },
          { tag: 'analysis', count: 76 },
          { tag: 'development', count: 54 },
          { tag: 'research', count: 43 },
          { tag: 'planning', count: 38 },
          { tag: 'documentation', count: 32 },
          { tag: 'api', count: 28 },
          { tag: 'ux', count: 24 },
        ],
        userActivity: [
          { user: 'Default User', contexts: 156, tokens: 425000 },
          { user: 'Developer A', contexts: 134, tokens: 380000 },
          { user: 'Analyst B', contexts: 98, tokens: 290000 },
          { user: 'Designer C', contexts: 76, tokens: 220000 },
        ],
      };
      setAnalyticsData(mockData);
      setLoading(false);
    }, 1000);
  };

  if (loading) {
    return (
      <div className="page-container">
        <Heading marginBottom={7}>Analytics</Heading>
        <Grid>
          {[1, 2, 3, 4].map((i) => (
            <Column key={i} lg={4} md={4} sm={4}>
              <Tile style={{ marginBottom: '1rem' }}>
                <SkeletonPlaceholder style={{ height: '2rem', width: '60%', marginBottom: '1rem' }} />
                <SkeletonText paragraph={false} lineCount={1} />
              </Tile>
            </Column>
          ))}
          <Column lg={16} md={8} sm={4}>
            <Tile style={{ height: '300px' }}>
              <SkeletonText heading paragraph lineCount={6} />
            </Tile>
          </Column>
        </Grid>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <Heading marginBottom={0}>Analytics</Heading>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <Dropdown
            id="time-range"
            items={timeRanges}
            selectedItem={timeRanges.find(t => t.id === selectedTimeRange)}
            onChange={({ selectedItem }) => setSelectedTimeRange(selectedItem?.id || '30d')}
            label="Time Range"
          />
          {selectedTimeRange === 'custom' && (
            <DatePicker datePickerType="range" onChange={(dates) => setCustomDateRange(dates as [Date, Date])}>
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
      </div>

      {/* Key Metrics */}
      <Grid style={{ marginBottom: '2rem' }}>
        <Column lg={4} md={4} sm={4}>
          <Tile className="ai-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--ai-text)' }}>
                  {analyticsData?.totalContexts.toLocaleString()}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>Total Contexts</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cds-support-success)', marginTop: '0.25rem' }}>
                  ↗ +12% from last period
                </div>
              </div>
              <Document size={32} style={{ color: 'var(--ai-text)', opacity: 0.7 }} />
            </div>
          </Tile>
        </Column>
        
        <Column lg={4} md={4} sm={4}>
          <Tile className="ai-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--ai-text)' }}>
                  {(analyticsData?.totalTokens || 0 / 1000000).toFixed(1)}M
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>Total Tokens</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cds-support-success)', marginTop: '0.25rem' }}>
                  ↗ +8% from last period
                </div>
              </div>
              <TrendUp size={32} style={{ color: 'var(--ai-text)', opacity: 0.7 }} />
            </div>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={4}>
          <Tile className="ai-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--ai-text)' }}>
                  {analyticsData?.activeUsers}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>Active Users</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cds-support-success)', marginTop: '0.25rem' }}>
                  ↗ +3 new users
                </div>
              </div>
              <Users size={32} style={{ color: 'var(--ai-text)', opacity: 0.7 }} />
            </div>
          </Tile>
        </Column>

        <Column lg={4} md={4} sm={4}>
          <Tile className="ai-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '2rem', fontWeight: 600, color: 'var(--ai-text)' }}>
                  {analyticsData?.templatesUsed}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>Templates Used</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--cds-support-success)', marginTop: '0.25rem' }}>
                  ↗ +15% usage rate
                </div>
              </div>
              <Analytics size={32} style={{ color: 'var(--ai-text)', opacity: 0.7 }} />
            </div>
          </Tile>
        </Column>
      </Grid>

      {/* Charts and Detailed Analytics */}
      <Grid>
        <Column lg={10} md={6} sm={4}>
          <Tile style={{ height: '400px', marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>Activity Trends</h4>
            <div style={{ 
              height: '300px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: 'var(--cds-text-secondary)'
            }}>
              <div style={{ textAlign: 'center' }}>
                <TrendUp size={48} style={{ marginBottom: '1rem', opacity: 0.5 }} />
                <p>Interactive charts would be rendered here</p>
                <p style={{ fontSize: '0.875rem' }}>
                  Showing trends for contexts created, tokens processed, and template usage
                </p>
              </div>
            </div>
          </Tile>
        </Column>

        <Column lg={6} md={2} sm={4}>
          <Tile style={{ marginBottom: '1rem' }}>
            <h4 style={{ marginBottom: '1rem' }}>Top Tags</h4>
            <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
              {analyticsData?.topTags.map((tagData, index) => (
                <div key={tagData.tag} style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center',
                  padding: '0.5rem 0',
                  borderBottom: index < analyticsData.topTags.length - 1 ? '1px solid var(--cds-border-subtle-01)' : 'none'
                }}>
                  <span style={{ fontSize: '0.875rem' }}>#{tagData.tag}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{ 
                      width: '60px', 
                      height: '4px', 
                      backgroundColor: 'var(--cds-border-subtle-01)',
                      borderRadius: '2px',
                      overflow: 'hidden'
                    }}>
                      <div style={{ 
                        width: `${(tagData.count / analyticsData.topTags[0].count) * 100}%`,
                        height: '100%',
                        backgroundColor: 'var(--ai-text)'
                      }} />
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--cds-text-secondary)', minWidth: '30px' }}>
                      {tagData.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </Tile>
        </Column>

        <Column lg={16} md={8} sm={4}>
          <Tile>
            <h4 style={{ marginBottom: '1rem' }}>User Activity</h4>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--cds-border-subtle-01)' }}>
                    <th style={{ textAlign: 'left', padding: '0.5rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                      User
                    </th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                      Contexts
                    </th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                      Tokens
                    </th>
                    <th style={{ textAlign: 'right', padding: '0.5rem', fontSize: '0.875rem', color: 'var(--cds-text-secondary)' }}>
                      Avg. Tokens/Context
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {analyticsData?.userActivity.map((user, index) => (
                    <tr key={user.user} style={{ 
                      borderBottom: index < analyticsData.userActivity.length - 1 ? '1px solid var(--cds-border-subtle-01)' : 'none'
                    }}>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem' }}>{user.user}</td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem', textAlign: 'right' }}>
                        {user.contexts}
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem', textAlign: 'right' }}>
                        {(user.tokens / 1000).toFixed(0)}k
                      </td>
                      <td style={{ padding: '0.75rem 0.5rem', fontSize: '0.875rem', textAlign: 'right' }}>
                        {Math.round(user.tokens / user.contexts)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Tile>
        </Column>
      </Grid>
    </div>
  );
};