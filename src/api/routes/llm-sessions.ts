/**
 * LLM Session Management API Routes
 * Provides endpoints for managing LLM conversation sessions and context continuity
 */

import { Router, Response } from 'express';
import { PersistentContextStoreApp } from '../../app.js';
import { AuthenticatedRequest, authenticateLLM, requirePermission } from '../middleware/auth.js';
import { logger } from '../../utils/logger.js';

export interface LLMSession {
  sessionId: string;
  conversationId?: string;
  userId?: string;
  clientId: string;
  startTime: Date;
  lastActivity: Date;
  status: 'active' | 'paused' | 'ended';
  metadata: {
    conversationTitle?: string;
    userPreferences?: Record<string, any>;
    contextSummary?: string;
    memoryCount: number;
    totalMessages: number;
    averageResponseTime?: number;
  };
  settings: {
    memoryRetention: 'session' | 'permanent' | 'limited';
    maxMemories: number;
    autoSummary: boolean;
    contextWindow: number;
  };
}

export interface LLMSessionContext {
  sessionId: string;
  currentTask?: string;
  userIntent?: string;
  conversationStage?: 'opening' | 'middle' | 'closing' | 'followup';
  keyTopics: string[];
  userMentions: Array<{
    entity: string;
    type: 'person' | 'place' | 'thing' | 'concept';
    context: string;
    firstMention: Date;
    frequency: number;
  }>;
  preferences: Record<string, any>;
  workingMemory: Array<{
    content: string;
    importance: number;
    timestamp: Date;
  }>;
}

export function registerLLMSessionRoutes(router: Router, app: PersistentContextStoreApp): void {
  // Apply authentication to all LLM session routes
  router.use('/llm/sessions', authenticateLLM(['read']));

  /**
   * Create or resume LLM session
   * POST /api/v1/llm/sessions
   */
  router.post('/llm/sessions', requirePermission('manage_sessions'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionRequest = req.body;
      const sessionId = sessionRequest.sessionId || `llm_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

      // Check if session already exists
      const existingContexts = await app.contextStore.searchContexts('', {
        sessionId,
        tags: [`client:${req.llmClient?.id}`, 'session-metadata'],
      });

      let session: LLMSession;

      if (existingContexts.length > 0) {
        // Resume existing session
        const sessionContext = existingContexts[0];
        session = JSON.parse(sessionContext.content);
        session.lastActivity = new Date();
        session.status = 'active';

        // Update session metadata
        await app.contextStore.updateContext(sessionContext.id, {
          content: JSON.stringify(session, null, 2),
          metadata: {
            ...sessionContext.metadata,
            lastActivity: session.lastActivity,
            status: session.status,
          },
        });

        logger.info('LLM session resumed', {
          clientId: req.llmClient?.id,
          sessionId,
          previousActivity: sessionContext.updatedAt,
        });

      } else {
        // Create new session
        session = {
          sessionId,
          conversationId: sessionRequest.conversationId,
          userId: sessionRequest.userId,
          clientId: req.llmClient!.id,
          startTime: new Date(),
          lastActivity: new Date(),
          status: 'active',
          metadata: {
            conversationTitle: sessionRequest.title,
            userPreferences: sessionRequest.userPreferences || {},
            memoryCount: 0,
            totalMessages: 0,
          },
          settings: {
            memoryRetention: sessionRequest.memoryRetention || 'session',
            maxMemories: sessionRequest.maxMemories || 1000,
            autoSummary: sessionRequest.autoSummary !== false,
            contextWindow: sessionRequest.contextWindow || 50,
            ...sessionRequest.settings,
          },
        };

        // Store session metadata
        const contextId = await app.contextStore.saveContext({
          title: `LLM Session: ${sessionId}`,
          content: JSON.stringify(session, null, 2),
          type: 'session',
          tags: [`client:${req.llmClient?.id}`, 'session-metadata', 'llm-session'],
          sessionId,
          metadata: {
            aiGenerated: true,
            source: 'llm-session-manager',
            importance: 'medium',
            sessionId,
            clientId: req.llmClient?.id,
            startTime: session.startTime,
            status: session.status,
          },
        });

        logger.info('LLM session created', {
          clientId: req.llmClient?.id,
          sessionId,
          contextId,
          settings: session.settings,
        });
      }

      res.json({
        success: true,
        session,
        message: existingContexts.length > 0 ? 'Session resumed' : 'Session created',
        createdAt: new Date(),
      });

    } catch (error) {
      logger.error('Failed to create/resume LLM session', error);
      res.status(500).json({
        error: 'Session management failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get LLM session information
   * GET /api/v1/llm/sessions/:sessionId
   */
  router.get('/llm/sessions/:sessionId', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionId = req.params.sessionId;

      // Find session metadata
      const sessionContexts = await app.contextStore.searchContexts('', {
        sessionId,
        tags: [`client:${req.llmClient?.id}`, 'session-metadata'],
      });

      if (sessionContexts.length === 0) {
        return res.status(404).json({
          error: 'Session not found',
          message: `Session ${sessionId} does not exist or you don't have access to it`,
        });
      }

      const sessionContext = sessionContexts[0];
      const session: LLMSession = JSON.parse(sessionContext.content);

      // Get session statistics
      const allSessionContexts = await app.contextStore.searchContexts('', {
        sessionId,
        tags: [`client:${req.llmClient?.id}`],
      });

      const stats = {
        totalContexts: allSessionContexts.length,
        memoryTypes: {},
        recentActivity: allSessionContexts
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
          .slice(0, 10)
          .map(context => ({
            id: context.id,
            title: context.title,
            type: context.type,
            createdAt: context.createdAt,
            memoryType: context.metadata.memoryType,
          })),
      };

      // Count memory types
      allSessionContexts.forEach(context => {
        const memoryType = context.metadata.memoryType || 'context';
        stats.memoryTypes[memoryType] = (stats.memoryTypes[memoryType] || 0) + 1;
      });

      // Update session metadata counts
      session.metadata.memoryCount = allSessionContexts.length;

      res.json({
        success: true,
        session,
        statistics: stats,
        retrievedAt: new Date(),
      });

    } catch (error) {
      logger.error('Failed to retrieve LLM session', error);
      res.status(500).json({
        error: 'Session retrieval failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Update LLM session
   * PUT /api/v1/llm/sessions/:sessionId
   */
  router.put('/llm/sessions/:sessionId', requirePermission('manage_sessions'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionId = req.params.sessionId;
      const updates = req.body;

      // Find existing session
      const sessionContexts = await app.contextStore.searchContexts('', {
        sessionId,
        tags: [`client:${req.llmClient?.id}`, 'session-metadata'],
      });

      if (sessionContexts.length === 0) {
        return res.status(404).json({
          error: 'Session not found',
          message: `Session ${sessionId} does not exist or you don't have access to it`,
        });
      }

      const sessionContext = sessionContexts[0];
      const session: LLMSession = JSON.parse(sessionContext.content);

      // Update session data
      if (updates.status) session.status = updates.status;
      if (updates.metadata) {
        session.metadata = { ...session.metadata, ...updates.metadata };
      }
      if (updates.settings) {
        session.settings = { ...session.settings, ...updates.settings };
      }
      
      session.lastActivity = new Date();

      // Save updated session
      await app.contextStore.updateContext(sessionContext.id, {
        content: JSON.stringify(session, null, 2),
        metadata: {
          ...sessionContext.metadata,
          lastActivity: session.lastActivity,
          status: session.status,
        },
      });

      logger.info('LLM session updated', {
        clientId: req.llmClient?.id,
        sessionId,
        updates: Object.keys(updates),
      });

      res.json({
        success: true,
        session,
        message: 'Session updated successfully',
        updatedAt: new Date(),
      });

    } catch (error) {
      logger.error('Failed to update LLM session', error);
      res.status(500).json({
        error: 'Session update failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * End LLM session
   * DELETE /api/v1/llm/sessions/:sessionId
   */
  router.delete('/llm/sessions/:sessionId', requirePermission('manage_sessions'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionId = req.params.sessionId;
      const options = req.body || {};

      // Find session
      const sessionContexts = await app.contextStore.searchContexts('', {
        sessionId,
        tags: [`client:${req.llmClient?.id}`, 'session-metadata'],
      });

      if (sessionContexts.length === 0) {
        return res.status(404).json({
          error: 'Session not found',
          message: `Session ${sessionId} does not exist or you don't have access to it`,
        });
      }

      const sessionContext = sessionContexts[0];
      const session: LLMSession = JSON.parse(sessionContext.content);

      // Generate session summary if requested
      let summary = null;
      if (options.generateSummary !== false) {
        const allSessionContexts = await app.contextStore.searchContexts('', {
          sessionId,
          tags: [`client:${req.llmClient?.id}`],
        });

        summary = {
          sessionId,
          duration: new Date().getTime() - session.startTime.getTime(),
          totalMemories: allSessionContexts.length,
          memoryTypes: {},
          keyTopics: [],
          endedAt: new Date(),
        };

        // Analyze session content
        allSessionContexts.forEach(context => {
          const memoryType = context.metadata.memoryType || 'context';
          summary.memoryTypes[memoryType] = (summary.memoryTypes[memoryType] || 0) + 1;
          
          // Extract key topics from tags
          context.tags.forEach(tag => {
            if (!tag.startsWith('client:') && !['session-metadata', 'llm-session'].includes(tag)) {
              if (!summary.keyTopics.includes(tag)) {
                summary.keyTopics.push(tag);
              }
            }
          });
        });

        // Store session summary
        await app.contextStore.saveContext({
          title: `Session Summary: ${sessionId}`,
          content: JSON.stringify(summary, null, 2),
          type: 'summary',
          tags: [`client:${req.llmClient?.id}`, 'session-summary', 'llm-session'],
          sessionId,
          metadata: {
            aiGenerated: true,
            source: 'llm-session-manager',
            importance: 'high',
            sessionId,
            clientId: req.llmClient?.id,
            summaryType: 'session-end',
            originalSessionStart: session.startTime,
          },
        });
      }

      // Handle memory retention based on settings
      if (session.settings.memoryRetention === 'session') {
        // Delete all session memories except summaries
        const allSessionContexts = await app.contextStore.searchContexts('', {
          sessionId,
          tags: [`client:${req.llmClient?.id}`],
        });

        for (const context of allSessionContexts) {
          if (!context.tags.includes('session-summary')) {
            await app.contextStore.deleteContext(context.id);
          }
        }

        logger.info('Session memories deleted (retention: session)', {
          clientId: req.llmClient?.id,
          sessionId,
          deletedCount: allSessionContexts.length - 1, // Minus the summary
        });
      }

      // Mark session as ended
      session.status = 'ended';
      session.lastActivity = new Date();

      await app.contextStore.updateContext(sessionContext.id, {
        content: JSON.stringify(session, null, 2),
        metadata: {
          ...sessionContext.metadata,
          lastActivity: session.lastActivity,
          status: session.status,
          endedAt: session.lastActivity,
        },
      });

      logger.info('LLM session ended', {
        clientId: req.llmClient?.id,
        sessionId,
        duration: summary?.duration,
        memoryRetention: session.settings.memoryRetention,
      });

      res.json({
        success: true,
        message: 'Session ended successfully',
        summary,
        endedAt: new Date(),
      });

    } catch (error) {
      logger.error('Failed to end LLM session', error);
      res.status(500).json({
        error: 'Session end failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get LLM sessions list
   * GET /api/v1/llm/sessions
   */
  router.get('/llm/sessions', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query = {
        status: req.query.status as string,
        limit: parseInt(req.query.limit as string) || 20,
        offset: parseInt(req.query.offset as string) || 0,
        sortBy: (req.query.sortBy as string) || 'lastActivity',
      };

      // Find all session metadata contexts for this client
      const sessionContexts = await app.contextStore.searchContexts('', {
        tags: [`client:${req.llmClient?.id}`, 'session-metadata'],
      });

      // Parse and filter sessions
      let sessions = sessionContexts
        .map(context => {
          try {
            return JSON.parse(context.content) as LLMSession;
          } catch {
            return null;
          }
        })
        .filter(session => session !== null)
        .filter(session => !query.status || session.status === query.status);

      // Sort sessions
      sessions.sort((a, b) => {
        switch (query.sortBy) {
          case 'startTime':
            return b.startTime.getTime() - a.startTime.getTime();
          case 'lastActivity':
          default:
            return b.lastActivity.getTime() - a.lastActivity.getTime();
        }
      });

      // Apply pagination
      const totalCount = sessions.length;
      sessions = sessions.slice(query.offset, query.offset + query.limit);

      // Add session statistics
      const sessionsWithStats = await Promise.all(
        sessions.map(async (session) => {
          const contextCount = await app.contextStore.searchContexts('', {
            sessionId: session.sessionId,
            tags: [`client:${req.llmClient?.id}`],
          });

          return {
            ...session,
            statistics: {
              totalContexts: contextCount.length,
              memoryCount: contextCount.filter(c => c.metadata.memoryType).length,
            },
          };
        })
      );

      res.json({
        success: true,
        sessions: sessionsWithStats,
        pagination: {
          totalCount,
          limit: query.limit,
          offset: query.offset,
          hasMore: query.offset + query.limit < totalCount,
        },
        query,
        retrievedAt: new Date(),
      });

    } catch (error) {
      logger.error('Failed to list LLM sessions', error);
      res.status(500).json({
        error: 'Session listing failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Update session context (working memory)
   * POST /api/v1/llm/sessions/:sessionId/context
   */
  router.post('/llm/sessions/:sessionId/context', requirePermission('write'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionId = req.params.sessionId;
      const contextUpdate: Partial<LLMSessionContext> = req.body;

      // Store updated session context
      const contextData = {
        title: `Session Context: ${sessionId}`,
        content: JSON.stringify(contextUpdate, null, 2),
        type: 'context',
        tags: [`client:${req.llmClient?.id}`, 'session-context', 'working-memory'],
        sessionId,
        metadata: {
          aiGenerated: true,
          source: 'llm-session-context',
          importance: 'high',
          sessionId,
          clientId: req.llmClient?.id,
          contextType: 'working-memory',
          updatedAt: new Date(),
        },
      };

      const contextId = await app.contextStore.saveContext(contextData);

      logger.info('Session context updated', {
        clientId: req.llmClient?.id,
        sessionId,
        contextId,
        keys: Object.keys(contextUpdate),
      });

      res.json({
        success: true,
        contextId,
        sessionId,
        message: 'Session context updated',
        updatedAt: new Date(),
      });

    } catch (error) {
      logger.error('Failed to update session context', error);
      res.status(500).json({
        error: 'Context update failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  logger.info('LLM Session routes registered');
}