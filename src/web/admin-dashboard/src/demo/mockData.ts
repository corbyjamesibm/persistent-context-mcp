// Mock data for demo purposes
export const mockSystemStats = {
  totalContexts: 1247,
  activeUsers: 23,
  systemHealth: 'healthy' as const,
  memoryUsage: 65,
  cpuUsage: 32,
  lastBackup: '2024-01-27T10:30:00Z',
  recentContexts: [
    {
      id: '1',
      title: 'Product Planning Session Notes',
      type: 'meeting',
      createdAt: '2024-01-27T09:15:00Z',
      author: 'Sarah Johnson'
    },
    {
      id: '2',
      title: 'API Documentation Review',
      type: 'documentation',
      createdAt: '2024-01-27T08:45:00Z',
      author: 'Mike Chen'
    },
    {
      id: '3',
      title: 'Performance Optimization Analysis',
      type: 'analysis',
      createdAt: '2024-01-27T08:20:00Z',
      author: 'Alex Rivera'
    },
    {
      id: '4',
      title: 'Customer Feedback Compilation',
      type: 'conversation',
      createdAt: '2024-01-26T16:30:00Z',
      author: 'Lisa Park'
    },
    {
      id: '5',
      title: 'Database Schema Updates',
      type: 'code',
      createdAt: '2024-01-26T14:15:00Z',
      author: 'David Kim'
    }
  ]
};

export const mockHealthData = {
  overallStatus: 'healthy',
  lastUpdated: '2024-01-27T11:00:00Z',
  message: 'All systems operational',
  systemMetrics: {
    memoryUsage: 65,
    cpuUsage: 32,
    diskUsage: 45
  },
  connections: {
    database: 12,
    cache: 8,
    websocket: 5,
    http: 23
  },
  components: [
    {
      component: 'Database',
      status: 'healthy' as const,
      responseTime: 45,
      uptime: 2592000,
      lastCheck: '2024-01-27T11:00:00Z'
    },
    {
      component: 'Redis Cache',
      status: 'healthy' as const,
      responseTime: 12,
      uptime: 2592000,
      lastCheck: '2024-01-27T11:00:00Z'
    },
    {
      component: 'File System',
      status: 'warning' as const,
      responseTime: 89,
      uptime: 2588400,
      lastCheck: '2024-01-27T11:00:00Z'
    },
    {
      component: 'API Services',
      status: 'healthy' as const,
      responseTime: 156,
      uptime: 2592000,
      lastCheck: '2024-01-27T11:00:00Z'
    },
    {
      component: 'WebSocket Server',
      status: 'healthy' as const,
      responseTime: 23,
      uptime: 2591400,
      lastCheck: '2024-01-27T11:00:00Z'
    }
  ]
};

export const mockContexts = {
  contexts: [
    {
      id: '1',
      title: 'Q4 Strategy Planning Session',
      content: 'Comprehensive notes from quarterly strategic planning meeting including key objectives, timelines, and resource allocation discussions.',
      type: 'meeting',
      tags: ['important', 'planning', 'strategy'],
      createdAt: '2024-01-25T14:30:00Z',
      updatedAt: '2024-01-25T16:45:00Z',
      author: 'Sarah Johnson',
      sessionId: 'session-001',
      size: 15420
    },
    {
      id: '2',
      title: 'API Integration Documentation',
      content: 'Technical documentation covering REST API endpoints, authentication methods, and integration examples for third-party developers.',
      type: 'documentation',
      tags: ['technical', 'api', 'public'],
      createdAt: '2024-01-24T10:15:00Z',
      updatedAt: '2024-01-26T09:30:00Z',
      author: 'Mike Chen',
      sessionId: 'session-002',
      size: 28750
    },
    {
      id: '3',
      title: 'Customer Feedback Analysis',
      content: 'Detailed analysis of customer feedback trends, satisfaction scores, and actionable insights for product improvement.',
      type: 'analysis',
      tags: ['customer', 'feedback', 'insights'],
      createdAt: '2024-01-23T16:20:00Z',
      updatedAt: '2024-01-23T18:15:00Z',
      author: 'Lisa Park',
      sessionId: 'session-003',
      size: 12340
    },
    {
      id: '4',
      title: 'Performance Optimization Code Review',
      content: 'Code review session focusing on database query optimization, caching strategies, and memory usage improvements.',
      type: 'code',
      tags: ['performance', 'review', 'optimization'],
      createdAt: '2024-01-22T13:45:00Z',
      updatedAt: '2024-01-22T15:30:00Z',
      author: 'Alex Rivera',
      sessionId: 'session-004',
      size: 8920
    },
    {
      id: '5',
      title: 'Weekly Team Standup Notes',
      content: 'Regular team standup meeting notes including progress updates, blockers, and upcoming sprint planning discussions.',
      type: 'meeting',
      tags: ['team', 'standup', 'weekly'],
      createdAt: '2024-01-22T09:00:00Z',
      updatedAt: '2024-01-22T09:30:00Z',
      author: 'David Kim',
      sessionId: 'session-005',
      size: 5680
    }
  ],
  total: 5,
  page: 1,
  limit: 25
};

export const mockUser = {
  id: '1',
  email: 'admin@example.com',
  name: 'Admin User',
  role: 'administrator',
  permissions: ['read', 'write', 'delete', 'admin']
};