/**
 * MCP Server for Persistent Context Store
 * Provides AI assistants with context management capabilities
 */

import dotenv from 'dotenv';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { getDefaultApp } from './app.js';
import { logger } from './utils/logger.js';

// Tool definitions
const TOOLS = [
  {
    name: 'create_collaboration_session',
    description: 'Create a new collaborative session for real-time multi-user editing',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Name of the collaboration session',
          minLength: 1,
          maxLength: 100,
        },
        maxParticipants: {
          type: 'number',
          description: 'Maximum number of participants allowed',
          minimum: 1,
          maximum: 50,
          default: 10,
        },
        allowGuests: {
          type: 'boolean',
          description: 'Whether to allow guest users',
          default: false,
        },
        conflictResolution: {
          type: 'string',
          enum: ['last-write-wins', 'operational-transform', 'manual'],
          description: 'Conflict resolution strategy',
          default: 'last-write-wins',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'join_collaboration_session',
    description: 'Join an existing collaborative session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'ID of the session to join',
        },
        displayName: {
          type: 'string',
          description: 'Display name for the participant',
          minLength: 1,
          maxLength: 50,
        },
        role: {
          type: 'string',
          enum: ['editor', 'viewer', 'guest'],
          description: 'Role for the participant',
          default: 'viewer',
        },
      },
      required: ['sessionId', 'displayName'],
    },
  },
  {
    name: 'get_collaboration_sessions',
    description: 'Get active collaboration sessions for the current user',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'add_collaboration_comment',
    description: 'Add a comment to a context in a collaborative session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'ID of the collaborative session',
        },
        contextId: {
          type: 'string',
          description: 'ID of the context to comment on',
        },
        content: {
          type: 'string',
          description: 'Comment content',
          minLength: 1,
          maxLength: 1000,
        },
        position: {
          type: 'number',
          description: 'Position in the context where comment applies',
          minimum: 0,
        },
        mentions: {
          type: 'array',
          items: { type: 'string' },
          description: 'User IDs to mention in the comment',
          default: [],
        },
      },
      required: ['sessionId', 'contextId', 'content', 'position'],
    },
  },
  {
    name: 'save_context',
    description: 'Save a context to the persistent store with validation and auto-indexing',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the context',
          minLength: 1,
          maxLength: 200,
        },
        content: {
          type: 'string',
          description: 'Content of the context',
          minLength: 1,
          maxLength: 100000,
        },
        type: {
          type: 'string',
          enum: ['general', 'planning', 'analysis', 'development', 'bmad_workflow'],
          description: 'Type of context',
        },
        sessionId: {
          type: 'string',
          description: 'Session identifier',
          minLength: 1,
          maxLength: 100,
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for the context',
        },
        autoSave: {
          type: 'boolean',
          description: 'Whether to enable auto-save for this context',
          default: false,
        },
      },
      required: ['title', 'content', 'type', 'sessionId'],
    },
  },
  {
    name: 'search_contexts',
    description: 'Search contexts with advanced filtering and highlighting',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query string',
          minLength: 1,
          maxLength: 500,
        },
        filters: {
          type: 'object',
          properties: {
            type: {
              type: 'string',
              enum: ['general', 'planning', 'analysis', 'development', 'bmad_workflow'],
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
            dateRange: {
              type: 'object',
              properties: {
                start: { type: 'string', format: 'date-time' },
                end: { type: 'string', format: 'date-time' },
              },
            },
          },
        },
        options: {
          type: 'object',
          properties: {
            fuzzyMatch: { type: 'boolean', default: true },
            semanticSearch: { type: 'boolean', default: false },
            highlightMatches: { type: 'boolean', default: true },
            sortBy: {
              type: 'string',
              enum: ['relevance', 'date', 'title', 'tokenCount'],
              default: 'relevance',
            },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
            offset: { type: 'number', minimum: 0, default: 0 },
          },
        },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_context',
    description: 'Retrieve a specific context by ID',
    inputSchema: {
      type: 'object',
      properties: {
        contextId: {
          type: 'string',
          description: 'ID of the context to retrieve',
        },
      },
      required: ['contextId'],
    },
  },
  {
    name: 'generate_template',
    description: 'Generate a reusable template from successful contexts',
    inputSchema: {
      type: 'object',
      properties: {
        candidateContextIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Context IDs to use as template sources',
          minItems: 1,
          maxItems: 10,
        },
        templateConfig: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 },
            description: { type: 'string', minLength: 10, maxLength: 1000 },
            type: {
              type: 'string',
              enum: ['general', 'planning', 'analysis', 'development', 'bmad_workflow'],
            },
          },
          required: ['title', 'description', 'type'],
        },
      },
      required: ['candidateContextIds', 'templateConfig'],
    },
  },
  {
    name: 'apply_template',
    description: 'Apply a template to create a new context',
    inputSchema: {
      type: 'object',
      properties: {
        templateId: { type: 'string' },
        variableValues: {
          type: 'object',
          description: 'Values for template variables',
        },
        contextConfig: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 },
            sessionId: { type: 'string', minLength: 1, maxLength: 100 },
            tags: {
              type: 'array',
              items: { type: 'string' },
            },
          },
          required: ['title', 'sessionId'],
        },
      },
      required: ['templateId', 'variableValues', 'contextConfig'],
    },
  },
  {
    name: 'get_recent_sessions',
    description: 'Get recent sessions for quick resume',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', minimum: 1, maximum: 20, default: 10 },
      },
    },
  },
  {
    name: 'resume_session',
    description: 'Resume a session by loading its most recent context',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: { type: 'string' },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'get_system_status',
    description: 'Get basic system health and statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_detailed_health_status',
    description: 'Get comprehensive health status with detailed checks and metrics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_health_metrics_history',
    description: 'Get historical health metrics for trend analysis',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of historical metrics to return',
          minimum: 1,
          maximum: 1000,
          default: 100,
        },
      },
    },
  },
  {
    name: 'create_backup',
    description: 'Create a manual backup of the context store',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['full', 'incremental'],
          description: 'Type of backup to create',
          default: 'full',
        },
      },
    },
  },
  {
    name: 'list_backups',
    description: 'List all available backups',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'restore_from_backup',
    description: 'Restore contexts from a backup',
    inputSchema: {
      type: 'object',
      properties: {
        backupId: {
          type: 'string',
          description: 'ID of the backup to restore from',
          minLength: 1,
        },
        validateChecksum: {
          type: 'boolean',
          description: 'Whether to validate backup checksum',
          default: true,
        },
        overwriteExisting: {
          type: 'boolean',
          description: 'Whether to overwrite existing contexts',
          default: false,
        },
      },
      required: ['backupId'],
    },
  },
  {
    name: 'validate_backup',
    description: 'Validate backup integrity',
    inputSchema: {
      type: 'object',
      properties: {
        backupId: {
          type: 'string',
          description: 'ID of the backup to validate',
          minLength: 1,
        },
      },
      required: ['backupId'],
    },
  },
  {
    name: 'get_backup_status',
    description: 'Get backup service status and configuration',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'handle_session_end',
    description: 'Handle session end and check if save prompt is required',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID to handle end for',
          minLength: 1,
          maxLength: 100,
        },
      },
      required: ['sessionId'],
    },
  },
  {
    name: 'respond_to_save_prompt',
    description: 'Respond to a save prompt for a session',
    inputSchema: {
      type: 'object',
      properties: {
        sessionId: {
          type: 'string',
          description: 'Session ID to respond for',
          minLength: 1,
          maxLength: 100,
        },
        shouldSave: {
          type: 'boolean',
          description: 'Whether to save the context (true) or discard it (false)',
        },
      },
      required: ['sessionId', 'shouldSave'],
    },
  },
  {
    name: 'get_sessions_awaiting_prompt',
    description: 'Get list of sessions waiting for save prompts',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'set_session_end_prompts',
    description: 'Enable or disable session end prompts globally',
    inputSchema: {
      type: 'object',
      properties: {
        enabled: {
          type: 'boolean',
          description: 'Whether to enable session end prompts',
        },
      },
      required: ['enabled'],
    },
  },
  {
    name: 'save_context_with_prompt',
    description: 'Save context with optional prompt requirement',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Title of the context',
          minLength: 1,
          maxLength: 200,
        },
        content: {
          type: 'string',
          description: 'Content of the context',
          minLength: 1,
          maxLength: 100000,
        },
        type: {
          type: 'string',
          enum: ['general', 'planning', 'analysis', 'development', 'bmad_workflow'],
          description: 'Type of context',
        },
        sessionId: {
          type: 'string',
          description: 'Session identifier',
          minLength: 1,
          maxLength: 100,
        },
        tags: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional tags for the context',
        },
        requirePrompt: {
          type: 'boolean',
          description: 'Whether to require user confirmation before saving',
          default: false,
        },
      },
      required: ['title', 'content', 'type', 'sessionId'],
    },
  },
  {
    name: 'get_performance_metrics',
    description: 'Get current performance metrics and system performance status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'run_load_test',
    description: 'Run a comprehensive load test to evaluate system performance under load',
    inputSchema: {
      type: 'object',
      properties: {
        concurrentUsers: {
          type: 'number',
          description: 'Number of concurrent users to simulate',
          minimum: 1,
          maximum: 500,
          default: 10,
        },
        duration: {
          type: 'number',
          description: 'Test duration in milliseconds',
          minimum: 10000,
          maximum: 1800000,
          default: 60000,
        },
        rampUpTime: {
          type: 'number',
          description: 'Ramp-up time in milliseconds',
          minimum: 1000,
          maximum: 300000,
          default: 10000,
        },
      },
    },
  },
  {
    name: 'analyze_performance',
    description: 'Analyze current performance and get optimization recommendations',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'get_performance_history',
    description: 'Get historical performance metrics for trend analysis',
    inputSchema: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: 'Maximum number of historical metrics to return',
          minimum: 1,
          maximum: 1000,
          default: 100,
        },
      },
    },
  },
  {
    name: 'clear_performance_history',
    description: 'Clear performance monitoring history and reset metrics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
];

class PersistentContextMcpServer {
  private server: Server;
  private app: ReturnType<typeof getDefaultApp>;

  constructor() {
    this.server = new Server(
      {
        name: 'persistent-context-store',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.app = getDefaultApp();
    this.setupHandlers();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: TOOLS,
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'save_context':
            return await this.handleSaveContext(args);
          
          case 'search_contexts':
            return await this.handleSearchContexts(args);
          
          case 'get_context':
            return await this.handleGetContext(args);
          
          case 'generate_template':
            return await this.handleGenerateTemplate(args);
          
          case 'apply_template':
            return await this.handleApplyTemplate(args);
          
          case 'get_recent_sessions':
            return await this.handleGetRecentSessions(args);
          
          case 'resume_session':
            return await this.handleResumeSession(args);
          
          case 'get_system_status':
            return await this.handleGetSystemStatus(args);
          
          case 'get_detailed_health_status':
            return await this.handleGetDetailedHealthStatus(args);
          
          case 'get_health_metrics_history':
            return await this.handleGetHealthMetricsHistory(args);
          
          case 'create_backup':
            return await this.handleCreateBackup(args);
          
          case 'list_backups':
            return await this.handleListBackups(args);
          
          case 'restore_from_backup':
            return await this.handleRestoreFromBackup(args);
          
          case 'validate_backup':
            return await this.handleValidateBackup(args);
          
          case 'get_backup_status':
            return await this.handleGetBackupStatus(args);
          
          case 'handle_session_end':
            return await this.handleSessionEnd(args);
          
          case 'respond_to_save_prompt':
            return await this.handleRespondToSavePrompt(args);
          
          case 'get_sessions_awaiting_prompt':
            return await this.handleGetSessionsAwaitingPrompt(args);
          
          case 'set_session_end_prompts':
            return await this.handleSetSessionEndPrompts(args);
          
          case 'save_context_with_prompt':
            return await this.handleSaveContextWithPrompt(args);
          
          case 'get_performance_metrics':
            return await this.handleGetPerformanceMetrics(args);
          
          case 'run_load_test':
            return await this.handleRunLoadTest(args);
          
          case 'analyze_performance':
            return await this.handleAnalyzePerformance(args);
          
          case 'get_performance_history':
            return await this.handleGetPerformanceHistory(args);
          
          case 'clear_performance_history':
            return await this.handleClearPerformanceHistory(args);
          
          case 'create_collaboration_session':
            return await this.handleCreateCollaborationSession(args);
          
          case 'join_collaboration_session':
            return await this.handleJoinCollaborationSession(args);
          
          case 'get_collaboration_sessions':
            return await this.handleGetCollaborationSessions(args);
          
          case 'add_collaboration_comment':
            return await this.handleAddCollaborationComment(args);
          
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        logger.error(`Tool ${name} failed:`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private async handleSaveContext(args: any) {
    const result = await this.app.contextManager.saveContextImmediate(
      args.sessionId,
      {
        title: args.title,
        content: args.content,
        type: args.type,
        tags: args.tags || [],
        metadata: {
          aiGenerated: true,
          source: 'mcp-tool',
          importance: 'medium',
        },
      }
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            contextId: result.contextId,
            error: result.error,
            validation: {
              isValid: result.validationResult?.isValid,
              warnings: result.validationResult?.warnings || [],
              repairApplied: !!result.validationResult?.repairedData,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleSearchContexts(args: any) {
    const searchResult = await this.app.searchService.search({
      query: args.query,
      filters: args.filters ? {
        type: args.filters.type,
        tags: args.filters.tags,
        dateRange: args.filters.dateRange ? {
          start: new Date(args.filters.dateRange.start),
          end: new Date(args.filters.dateRange.end),
        } : undefined,
      } : undefined,
      options: args.options,
    });

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            totalCount: searchResult.totalCount,
            executionTime: searchResult.executionTime,
            results: searchResult.results.map(result => ({
              context: {
                id: result.context.id,
                title: result.context.title,
                content: result.context.content.substring(0, 500) + (result.context.content.length > 500 ? '...' : ''),
                type: result.context.type,
                tags: result.context.tags,
                createdAt: result.context.createdAt,
                updatedAt: result.context.updatedAt,
              },
              score: result.score,
              highlights: result.highlights,
              matchedFields: result.matchedFields,
            })),
            facets: searchResult.facets,
            suggestions: searchResult.suggestions,
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetContext(args: any) {
    const context = await this.app.contextStore.getContext(args.contextId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: !!context,
            context: context ? {
              id: context.id,
              title: context.title,
              content: context.content,
              type: context.type,
              status: context.status,
              tags: context.tags,
              createdAt: context.createdAt,
              updatedAt: context.updatedAt,
              metadata: context.metadata,
              relationships: context.relationships,
            } : null,
          }, null, 2),
        },
      ],
    };
  }

  private async handleGenerateTemplate(args: any) {
    const template = await this.app.templateGenerator.generateTemplate(
      args.candidateContextIds,
      args.templateConfig
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            templateId: template.id,
            template: {
              id: template.id,
              title: template.title,
              description: template.description,
              type: template.type,
              variableCount: template.variables.length,
              confidence: template.metadata.confidence,
              sourceContextCount: template.metadata.sourceContexts.length,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleApplyTemplate(args: any) {
    const contextId = await this.app.templateGenerator.applyTemplate(
      args.templateId,
      args.variableValues,
      args.contextConfig
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            contextId,
            contextTitle: args.contextConfig.title,
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetRecentSessions(args: any) {
    const sessions = await this.app.contextManager.getRecentSessions(args.limit || 10);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            sessions: sessions.map(session => ({
              sessionId: session.sessionId,
              lastActivity: session.lastActivity,
              contextCount: session.contextCount,
              hasPendingChanges: session.hasPendingChanges,
              lastContextId: session.lastContextId,
            })),
          }, null, 2),
        },
      ],
    };
  }

  private async handleResumeSession(args: any) {
    const context = await this.app.contextManager.resumeSession(args.sessionId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: !!context,
            context: context ? {
              id: context.id,
              title: context.title,
              content: context.content,
              type: context.type,
              tags: context.tags,
              updatedAt: context.updatedAt,
            } : null,
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetSystemStatus(args: any) {
    const health = this.app.getHealthStatus();
    const systemStatus = this.app.contextManager.getSystemStatus();
    const searchStats = this.app.searchService.getSearchStats();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            health: {
              database: health.database,
              services: health.services,
              uptime: health.uptime,
            },
            system: {
              isActive: systemStatus.isActive,
              pendingContexts: systemStatus.pendingContexts,
              activeSessions: systemStatus.activeSessions,
              sessionsAwaitingPrompt: systemStatus.sessionsAwaitingPrompt,
              sessionEndPromptsEnabled: systemStatus.sessionEndPromptsEnabled,
            },
            search: {
              indexSize: searchStats.indexSize,
              totalTokens: searchStats.totalTokens,
              avgTokensPerContext: Math.round(searchStats.avgTokensPerContext),
              lastIndexUpdate: searchStats.lastIndexUpdate,
            },
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetDetailedHealthStatus(args: any) {
    try {
      const detailedHealth = await this.app.getDetailedHealthStatus();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              ...detailedHealth,
              summary: {
                overallStatus: detailedHealth.status,
                totalChecks: detailedHealth.checks.length,
                healthyChecks: detailedHealth.checks.filter(c => c.status === 'healthy').length,
                warningChecks: detailedHealth.checks.filter(c => c.status === 'warning').length,
                criticalChecks: detailedHealth.checks.filter(c => c.status === 'critical').length,
              },
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to get detailed health status: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleGetHealthMetricsHistory(args: any) {
    try {
      const limit = args.limit || 100;
      const metricsHistory = this.app.healthMonitor.getMetricsHistory();
      const limitedHistory = metricsHistory.slice(-limit);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              metricsHistory: limitedHistory,
              totalRecords: metricsHistory.length,
              returnedRecords: limitedHistory.length,
              oldestRecord: limitedHistory.length > 0 ? limitedHistory[0] : null,
              newestRecord: limitedHistory.length > 0 ? limitedHistory[limitedHistory.length - 1] : null,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to get health metrics history: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleCreateBackup(args: any) {
    try {
      const type = args.type || 'full';
      const result = await this.app.backupRecovery.createBackup(type);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              backupId: result.backupId,
              type,
              size: result.size,
              duration: result.duration,
              contextCount: result.metadata.contextCount,
              filePath: result.filePath,
              error: result.error,
              message: result.success 
                ? `${type} backup created successfully`
                : `Backup creation failed: ${result.error}`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to create backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleListBackups(args: any) {
    try {
      const backups = await this.app.backupRecovery.listBackups();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              backups: backups.map(backup => ({
                id: backup.id,
                timestamp: backup.timestamp,
                type: backup.type,
                size: backup.size,
                contextCount: backup.contextCount,
                compressed: backup.compressed,
                encrypted: backup.encrypted,
              })),
              totalBackups: backups.length,
              message: `Found ${backups.length} backups`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to list backups: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleRestoreFromBackup(args: any) {
    try {
      const { backupId, validateChecksum = true, overwriteExisting = false } = args;
      const result = await this.app.backupRecovery.restoreFromBackup(backupId, {
        validateChecksum,
        overwriteExisting,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              backupId: result.backupId,
              restoredContexts: result.restoredContexts,
              duration: result.duration,
              error: result.error,
              message: result.success 
                ? `Restored ${result.restoredContexts} contexts from backup ${backupId}`
                : `Restore failed: ${result.error}`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to restore from backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleValidateBackup(args: any) {
    try {
      const { backupId } = args;
      const validation = await this.app.backupRecovery.validateBackup(backupId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              backupId,
              isValid: validation.isValid,
              issues: validation.issues,
              message: validation.isValid 
                ? `Backup ${backupId} is valid`
                : `Backup ${backupId} has ${validation.issues.length} issues`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to validate backup: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleGetBackupStatus(args: any) {
    try {
      const status = this.app.backupRecovery.getStatus();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              status: {
                isRunning: status.isRunning,
                lastBackupTime: status.lastBackupTime,
                nextBackupTime: status.nextBackupTime,
                backupDirectory: status.backupDirectory,
                configuration: {
                  retentionDays: status.config.retentionDays,
                  compressionEnabled: status.config.compressionEnabled,
                  backupInterval: status.config.backupInterval,
                  incrementalBackups: status.config.incrementalBackups,
                  maxBackupSize: status.config.maxBackupSize,
                },
              },
              message: status.isRunning ? 'Backup service is running' : 'Backup service is stopped',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to get backup status: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleSessionEnd(args: any) {
    const result = await this.app.contextManager.handleSessionEnd(args.sessionId);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            promptRequired: result.promptRequired,
            contextDetails: result.contextDetails,
            message: result.promptRequired 
              ? 'Save prompt required for this session'
              : 'No prompt required - session ended cleanly',
          }, null, 2),
        },
      ],
    };
  }

  private async handleRespondToSavePrompt(args: any) {
    const success = this.app.contextManager.respondToSavePrompt(args.sessionId, args.shouldSave);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success,
            sessionId: args.sessionId,
            response: args.shouldSave ? 'save' : 'discard',
            message: success 
              ? `Response recorded: ${args.shouldSave ? 'will save' : 'will discard'} context for session ${args.sessionId}`
              : `No prompt found for session ${args.sessionId}`,
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetSessionsAwaitingPrompt(args: any) {
    const sessions = this.app.contextManager.getSessionsAwaitingPrompt();

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            sessionsAwaitingPrompt: sessions,
            count: sessions.length,
            message: sessions.length > 0 
              ? `${sessions.length} sessions awaiting save prompts`
              : 'No sessions awaiting prompts',
          }, null, 2),
        },
      ],
    };
  }

  private async handleSetSessionEndPrompts(args: any) {
    this.app.contextManager.setSessionEndPrompts(args.enabled);

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            enabled: args.enabled,
            message: `Session end prompts ${args.enabled ? 'enabled' : 'disabled'}`,
          }, null, 2),
        },
      ],
    };
  }

  private async handleSaveContextWithPrompt(args: any) {
    const result = await this.app.contextManager.saveContextWithPrompt(
      args.sessionId,
      {
        title: args.title,
        content: args.content,
        type: args.type,
        tags: args.tags || [],
        metadata: {
          aiGenerated: true,
          source: 'mcp-tool-with-prompt',
          importance: 'medium',
        },
      },
      args.requirePrompt
    );

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: result.success,
            contextId: result.contextId,
            promptRequired: result.promptRequired,
            error: result.error,
            message: result.promptRequired 
              ? 'Context queued - user prompt required before saving'
              : result.success 
                ? 'Context saved successfully'
                : `Save failed: ${result.error}`,
          }, null, 2),
        },
      ],
    };
  }

  private async handleGetPerformanceMetrics(args: any) {
    try {
      const metrics = await this.app.performanceMonitor.getCurrentMetrics();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              metrics: {
                timestamp: metrics.timestamp,
                responseTime: metrics.responseTime,
                throughput: metrics.throughput,
                resources: metrics.resources,
                database: metrics.database,
                operations: metrics.operations,
              },
              summary: {
                averageResponseTime: `${metrics.responseTime.average.toFixed(2)}ms`,
                p95ResponseTime: `${metrics.responseTime.p95.toFixed(2)}ms`,
                memoryUsage: `${metrics.resources.memoryUsage.toFixed(1)}%`,
                requestsPerSecond: metrics.throughput.requestsPerSecond.toFixed(2),
              },
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to get performance metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleRunLoadTest(args: any) {
    try {
      const { concurrentUsers = 10, duration = 60000, rampUpTime = 10000 } = args;
      
      const result = await this.app.performanceMonitor.runLoadTest({
        concurrentUsers,
        duration,
        rampUpTime,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: result.success,
              testId: result.testId,
              results: {
                duration: result.duration,
                totalRequests: result.totalRequests,
                successfulRequests: result.successfulRequests,
                failedRequests: result.failedRequests,
                successRate: `${((result.successfulRequests / result.totalRequests) * 100).toFixed(2)}%`,
                averageResponseTime: `${result.averageResponseTime.toFixed(2)}ms`,
                maxResponseTime: `${result.maxResponseTime.toFixed(2)}ms`,
                requestsPerSecond: result.requestsPerSecond.toFixed(2),
              },
              errors: result.errors.slice(0, 10), // Show first 10 errors
              metricsCollected: result.metrics.length,
              message: result.success 
                ? `Load test completed successfully: ${result.successfulRequests}/${result.totalRequests} requests succeeded`
                : `Load test failed: ${result.errors[0] || 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to run load test: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleAnalyzePerformance(args: any) {
    try {
      const recommendations = await this.app.performanceMonitor.analyzePerformance();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              analysis: {
                totalRecommendations: recommendations.length,
                criticalIssues: recommendations.filter(r => r.severity === 'critical').length,
                highPriorityIssues: recommendations.filter(r => r.severity === 'high').length,
                categories: [...new Set(recommendations.map(r => r.category))],
              },
              recommendations: recommendations.map(rec => ({
                category: rec.category,
                severity: rec.severity,
                title: rec.title,
                description: rec.description,
                recommendation: rec.recommendation,
                estimatedImpact: rec.estimatedImpact,
                implementationComplexity: rec.implementationComplexity,
              })),
              message: recommendations.length > 0 
                ? `Found ${recommendations.length} performance optimization opportunities`
                : 'No performance issues detected - system is performing optimally',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to analyze performance: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleGetPerformanceHistory(args: any) {
    try {
      const limit = args.limit || 100;
      const history = this.app.performanceMonitor.getMetricsHistory(limit);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              history: history.map(metrics => ({
                timestamp: metrics.timestamp,
                responseTime: {
                  average: metrics.responseTime.average.toFixed(2),
                  p95: metrics.responseTime.p95.toFixed(2),
                },
                resources: {
                  memoryUsage: metrics.resources.memoryUsage.toFixed(1),
                  cpuUsage: metrics.resources.cpuUsage.toFixed(1),
                },
                throughput: metrics.throughput,
                database: metrics.database,
              })),
              totalRecords: history.length,
              message: `Retrieved ${history.length} performance history records`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to get performance history: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleClearPerformanceHistory(args: any) {
    try {
      this.app.performanceMonitor.clearHistory();

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Performance history cleared successfully',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to clear performance history: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleCreateCollaborationSession(args: any) {
    try {
      // For now, return a placeholder since we don't have collaborationService integrated with app
      // In a real implementation, this would be integrated with the main app
      const mockUserId = 'mock-user-' + Date.now();
      
      const sessionData = {
        name: args.name,
        ownerId: mockUserId,
        settings: {
          maxParticipants: args.maxParticipants || 10,
          allowGuests: args.allowGuests || false,
          autoSave: true,
          conflictResolution: args.conflictResolution || 'last-write-wins',
        },
      };

      // Mock session creation
      const mockSession = {
        id: 'session-' + Date.now(),
        ...sessionData,
        participants: [{
          id: 'participant-' + Date.now(),
          userId: mockUserId,
          displayName: 'Session Owner',
          role: 'owner',
          status: 'online',
          permissions: {
            canEdit: true,
            canComment: true,
            canInvite: true,
            canManageSettings: true,
          },
        }],
        isActive: true,
        createdAt: new Date(),
        lastActivity: new Date(),
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              session: mockSession,
              message: `Collaboration session "${args.name}" created successfully`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to create collaboration session: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleJoinCollaborationSession(args: any) {
    try {
      // Mock implementation
      const mockUserId = 'user-' + Date.now();
      const participant = {
        id: 'participant-' + Date.now(),
        userId: mockUserId,
        displayName: args.displayName,
        role: args.role || 'viewer',
        status: 'online',
        joinedAt: new Date(),
        lastSeen: new Date(),
        permissions: {
          canEdit: args.role === 'editor' || args.role === 'owner',
          canComment: args.role !== 'guest',
          canInvite: false,
          canManageSettings: false,
        },
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              sessionId: args.sessionId,
              participant,
              message: `Successfully joined session as ${args.role}`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to join collaboration session: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleGetCollaborationSessions(args: any) {
    try {
      // Mock implementation
      const mockSessions = [
        {
          id: 'session-1',
          name: 'AI Research Collaboration',
          participantCount: 3,
          role: 'owner',
          lastActivity: new Date(Date.now() - 3600000), // 1 hour ago
          isActive: true,
        },
        {
          id: 'session-2',
          name: 'Context Analysis Session',
          participantCount: 2,
          role: 'editor',
          lastActivity: new Date(Date.now() - 7200000), // 2 hours ago
          isActive: true,
        },
      ];

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              sessions: mockSessions,
              totalCount: mockSessions.length,
              message: `Found ${mockSessions.length} active collaboration sessions`,
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to get collaboration sessions: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  private async handleAddCollaborationComment(args: any) {
    try {
      // Mock implementation
      const comment = {
        id: 'comment-' + Date.now(),
        contextId: args.contextId,
        userId: 'user-' + Date.now(),
        content: args.content,
        position: args.position,
        mentions: args.mentions || [],
        resolved: false,
        createdAt: new Date(),
        updatedAt: new Date(),
        reactions: [],
      };

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              comment,
              sessionId: args.sessionId,
              message: 'Comment added successfully to collaborative session',
            }, null, 2),
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: false,
              error: `Failed to add collaboration comment: ${error instanceof Error ? error.message : 'Unknown error'}`,
            }, null, 2),
          },
        ],
      };
    }
  }

  async run() {
    // Initialize the application
    await this.app.initialize();
    logger.info('Persistent Context Store MCP Server initialized');

    // Create transport and connect
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP Server started and ready for connections');
  }
}

// Start the server
async function main() {
  // Load environment variables
  dotenv.config();
  
  const server = new PersistentContextMcpServer();
  await server.run();
}

// ES module check
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logger.error('Failed to start MCP server:', error);
    process.exit(1);
  });
}

export { PersistentContextMcpServer };