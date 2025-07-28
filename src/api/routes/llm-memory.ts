/**
 * LLM Memory Access API Routes
 * Provides optimized endpoints for LLM memory storage and retrieval
 */

import { Router, Request, Response } from 'express';
import { PersistentContextStoreApp } from '../../app.js';
import { AuthenticatedRequest, authenticateLLM, requirePermission } from '../middleware/auth.js';
import { logger } from '../../utils/logger.js';

export interface LLMMemoryRequest {
  sessionId: string;
  conversationId?: string;
  userId?: string;
  memories: {
    shortTerm?: LLMMemory[];
    longTerm?: LLMMemory[];
    episodic?: LLMMemory[];
  };
  context?: {
    currentTask?: string;
    userPreferences?: Record<string, any>;
    conversationSummary?: string;
  };
}

export interface LLMMemory {
  id?: string;
  type: 'fact' | 'preference' | 'context' | 'instruction' | 'example';
  content: string;
  importance: 'low' | 'medium' | 'high' | 'critical';
  tags: string[];
  timestamp: Date;
  source: 'user' | 'llm' | 'system';
  confidence: number; // 0-1
  metadata?: Record<string, any>;
}

export interface LLMMemoryQuery {
  sessionId?: string;
  conversationId?: string;
  userId?: string;
  types?: string[];
  tags?: string[];
  importance?: string[];
  limit?: number;
  offset?: number;
  sortBy?: 'timestamp' | 'importance' | 'relevance';
  timeRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

export function registerLLMMemoryRoutes(router: Router, app: PersistentContextStoreApp): void {
  // Apply authentication to all LLM memory routes
  router.use('/llm', authenticateLLM(['read']));

  /**
   * Store LLM memories
   * POST /api/v1/llm/memories
   */
  router.post('/llm/memories', requirePermission('write'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const memoryRequest: LLMMemoryRequest = req.body;
      
      if (!memoryRequest.sessionId) {
        return res.status(400).json({
          error: 'Invalid request',
          message: 'sessionId is required',
        });
      }

      const results = {
        shortTerm: [],
        longTerm: [],
        episodic: [],
        contextId: null,
      };

      // Process short-term memories
      if (memoryRequest.memories.shortTerm?.length) {
        for (const memory of memoryRequest.memories.shortTerm) {
          const contextData = {
            title: `Short-term Memory: ${memory.type}`,
            content: memory.content,
            type: 'memory' as const,
            tags: [...memory.tags, 'short-term', memory.type, `client:${req.llmClient?.id}`],
            sessionId: memoryRequest.sessionId,
            metadata: {
              aiGenerated: memory.source === 'llm',
              source: `llm-memory-${memory.source}`,
              importance: memory.importance,
              memoryType: 'short-term',
              confidence: memory.confidence,
              timestamp: memory.timestamp,
              ...memory.metadata,
            },
          };

          const contextId = await app.contextStore.saveContext(contextData);
          results.shortTerm.push({ memoryId: memory.id, contextId });
        }
      }

      // Process long-term memories
      if (memoryRequest.memories.longTerm?.length) {
        for (const memory of memoryRequest.memories.longTerm) {
          const contextData = {
            title: `Long-term Memory: ${memory.type}`,
            content: memory.content,
            type: 'knowledge' as const,
            tags: [...memory.tags, 'long-term', memory.type, `client:${req.llmClient?.id}`],
            sessionId: memoryRequest.sessionId,
            metadata: {
              aiGenerated: memory.source === 'llm',
              source: `llm-memory-${memory.source}`,
              importance: memory.importance,
              memoryType: 'long-term',
              confidence: memory.confidence,
              timestamp: memory.timestamp,
              ...memory.metadata,
            },
          };

          const contextId = await app.contextStore.saveContext(contextData);
          results.longTerm.push({ memoryId: memory.id, contextId });
        }
      }

      // Process episodic memories
      if (memoryRequest.memories.episodic?.length) {
        for (const memory of memoryRequest.memories.episodic) {
          const contextData = {
            title: `Episodic Memory: ${memory.type}`,
            content: memory.content,
            type: 'episode' as const,
            tags: [...memory.tags, 'episodic', memory.type, `client:${req.llmClient?.id}`],
            sessionId: memoryRequest.sessionId,
            metadata: {
              aiGenerated: memory.source === 'llm',
              source: `llm-memory-${memory.source}`,
              importance: memory.importance,
              memoryType: 'episodic',
              confidence: memory.confidence,
              timestamp: memory.timestamp,
              ...memory.metadata,
            },
          };

          const contextId = await app.contextStore.saveContext(contextData);
          results.episodic.push({ memoryId: memory.id, contextId });
        }
      }

      // Store conversation context if provided
      if (memoryRequest.context) {
        const contextData = {
          title: `Conversation Context - ${memoryRequest.sessionId}`,
          content: JSON.stringify(memoryRequest.context, null, 2),
          type: 'context' as const,
          tags: ['conversation-context', `client:${req.llmClient?.id}`],
          sessionId: memoryRequest.sessionId,
          metadata: {
            aiGenerated: true,
            source: 'llm-context',
            importance: 'medium' as const,
            contextType: 'conversation',
            conversationId: memoryRequest.conversationId,
            userId: memoryRequest.userId,
          },
        };

        results.contextId = await app.contextStore.saveContext(contextData);
      }

      logger.info('LLM memories stored', {
        clientId: req.llmClient?.id,
        sessionId: memoryRequest.sessionId,
        shortTermCount: results.shortTerm.length,
        longTermCount: results.longTerm.length,
        episodicCount: results.episodic.length,
        hasContext: !!results.contextId,
      });

      res.json({
        success: true,
        message: 'Memories stored successfully',
        results,
        storedAt: new Date(),
      });

    } catch (error) {
      logger.error('Failed to store LLM memories', error);
      res.status(500).json({
        error: 'Storage failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Retrieve LLM memories
   * GET /api/v1/llm/memories
   */
  router.get('/llm/memories', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const query: LLMMemoryQuery = {
        sessionId: req.query.sessionId as string,
        conversationId: req.query.conversationId as string,
        userId: req.query.userId as string,
        types: req.query.types ? (req.query.types as string).split(',') : undefined,
        tags: req.query.tags ? (req.query.tags as string).split(',') : undefined,
        importance: req.query.importance ? (req.query.importance as string).split(',') : undefined,
        limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
        offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
        sortBy: (req.query.sortBy as any) || 'timestamp',
        searchQuery: req.query.q as string,
      };

      // Build search filters
      const searchFilters: any = {};
      
      if (query.types?.length) {
        // Map memory types to context types
        const typeMapping: Record<string, string> = {
          'fact': 'knowledge',
          'preference': 'preference',
          'context': 'context',
          'instruction': 'instruction',
          'example': 'example',
        };
        
        searchFilters.type = query.types.map(t => typeMapping[t] || t)[0]; // Take first for now
      }

      if (query.tags?.length) {
        searchFilters.tags = query.tags;
      }

      // Perform search
      const searchResults = await app.searchService.search({
        query: query.searchQuery || '',
        filters: searchFilters,
        options: {
          limit: query.limit,
          offset: query.offset,
          sortBy: query.sortBy === 'timestamp' ? 'date' : query.sortBy,
        },
      });

      // Transform results to LLM memory format
      const memories = searchResults.results
        .filter(result => {
          // Filter by client if specified
          if (req.llmClient?.id) {
            return result.context.tags.includes(`client:${req.llmClient.id}`);
          }
          return true;
        })
        .filter(result => {
          // Filter by session if specified
          if (query.sessionId) {
            return result.context.sessionId === query.sessionId;
          }
          return true;
        })
        .filter(result => {
          // Filter by importance if specified
          if (query.importance?.length) {
            return query.importance.includes(result.context.metadata.importance);
          }
          return true;
        })
        .map(result => ({
          id: result.context.id,
          type: result.context.metadata.memoryType || 'context',
          content: result.context.content,
          importance: result.context.metadata.importance || 'medium',
          tags: result.context.tags.filter(tag => !tag.startsWith('client:')),
          timestamp: result.context.createdAt,
          source: result.context.metadata.source?.includes('llm') ? 'llm' : 'user',
          confidence: result.context.metadata.confidence || 0.8,
          relevanceScore: result.score,
          metadata: {
            ...result.context.metadata,
            contextId: result.context.id,
            sessionId: result.context.sessionId,
          },
        }));

      // Group by memory type
      const groupedMemories = {
        shortTerm: memories.filter(m => m.metadata.memoryType === 'short-term'),
        longTerm: memories.filter(m => m.metadata.memoryType === 'long-term'),
        episodic: memories.filter(m => m.metadata.memoryType === 'episodic'),
        context: memories.filter(m => m.type === 'context'),
      };

      logger.info('LLM memories retrieved', {
        clientId: req.llmClient?.id,
        sessionId: query.sessionId,
        totalFound: memories.length,
        searchQuery: query.searchQuery,
        executionTime: searchResults.executionTime,
      });

      res.json({
        success: true,
        query,
        totalCount: searchResults.totalCount,
        executionTime: searchResults.executionTime,
        memories: groupedMemories,
        retrievedAt: new Date(),
      });

    } catch (error) {
      logger.error('Failed to retrieve LLM memories', error);
      res.status(500).json({
        error: 'Retrieval failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Search LLM memories with advanced options
   * POST /api/v1/llm/memories/search
   */
  router.post('/llm/memories/search', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const searchRequest = req.body;
      
      const searchResults = await app.searchService.search({
        query: searchRequest.query || '',
        filters: {
          ...searchRequest.filters,
          tags: searchRequest.filters?.tags?.concat([`client:${req.llmClient?.id}`]) || [`client:${req.llmClient?.id}`],
        },
        options: {
          limit: searchRequest.limit || 20,
          offset: searchRequest.offset || 0,
          sortBy: searchRequest.sortBy || 'relevance',
          fuzzyMatch: searchRequest.fuzzyMatch !== false,
          highlightMatches: searchRequest.highlightMatches !== false,
          semanticSearch: searchRequest.semanticSearch === true,
        },
      });

      // Enhanced results with LLM-specific metadata
      const enhancedResults = searchResults.results.map(result => ({
        ...result,
        memoryMetadata: {
          memoryType: result.context.metadata.memoryType,
          confidence: result.context.metadata.confidence,
          importance: result.context.metadata.importance,
          source: result.context.metadata.source,
        },
        llmRelevance: {
          score: result.score,
          matchedFields: result.matchedFields,
          highlights: result.highlights,
        },
      }));

      res.json({
        success: true,
        searchQuery: searchRequest.query,
        totalCount: searchResults.totalCount,
        executionTime: searchResults.executionTime,
        results: enhancedResults,
        facets: searchResults.facets,
        suggestions: searchResults.suggestions,
        searchedAt: new Date(),
      });

    } catch (error) {
      logger.error('Failed to search LLM memories', error);
      res.status(500).json({
        error: 'Search failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Update LLM memory
   * PUT /api/v1/llm/memories/:id
   */
  router.put('/llm/memories/:id', requirePermission('write'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = req.params.id;
      const updates = req.body;

      // Verify ownership
      const existingContext = await app.contextStore.getContext(contextId);
      if (!existingContext) {
        return res.status(404).json({
          error: 'Memory not found',
          message: `Memory with ID ${contextId} does not exist`,
        });
      }

      if (!existingContext.tags.includes(`client:${req.llmClient?.id}`)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only update memories created by your client',
        });
      }

      // Update the context
      const updatedContext = await app.contextStore.updateContext(contextId, {
        title: updates.title,
        content: updates.content,
        tags: updates.tags ? [...updates.tags, `client:${req.llmClient?.id}`] : existingContext.tags,
        metadata: {
          ...existingContext.metadata,
          ...updates.metadata,
          lastModified: new Date(),
          modifiedBy: req.llmClient?.id,
        },
      });

      if (!updatedContext) {
        return res.status(500).json({
          error: 'Update failed',
          message: 'Failed to update memory',
        });
      }

      logger.info('LLM memory updated', {
        clientId: req.llmClient?.id,
        contextId,
        sessionId: updatedContext.sessionId,
      });

      res.json({
        success: true,
        memory: {
          id: updatedContext.id,
          content: updatedContext.content,
          tags: updatedContext.tags.filter(tag => !tag.startsWith('client:')),
          metadata: updatedContext.metadata,
          updatedAt: updatedContext.updatedAt,
        },
      });

    } catch (error) {
      logger.error('Failed to update LLM memory', error);
      res.status(500).json({
        error: 'Update failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Delete LLM memory
   * DELETE /api/v1/llm/memories/:id
   */
  router.delete('/llm/memories/:id', requirePermission('write'), async (req: AuthenticatedRequest, res: Response) => {
    try {
      const contextId = req.params.id;

      // Verify ownership
      const existingContext = await app.contextStore.getContext(contextId);
      if (!existingContext) {
        return res.status(404).json({
          error: 'Memory not found',
          message: `Memory with ID ${contextId} does not exist`,
        });
      }

      if (!existingContext.tags.includes(`client:${req.llmClient?.id}`)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only delete memories created by your client',
        });
      }

      const deleted = await app.contextStore.deleteContext(contextId);
      
      if (!deleted) {
        return res.status(500).json({
          error: 'Delete failed',
          message: 'Failed to delete memory',
        });
      }

      logger.info('LLM memory deleted', {
        clientId: req.llmClient?.id,
        contextId,
        sessionId: existingContext.sessionId,
      });

      res.json({
        success: true,
        message: 'Memory deleted successfully',
        deletedId: contextId,
        deletedAt: new Date(),
      });

    } catch (error) {
      logger.error('Failed to delete LLM memory', error);
      res.status(500).json({
        error: 'Delete failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  /**
   * Get LLM session summary
   * GET /api/v1/llm/sessions/:sessionId/summary
   */
  router.get('/llm/sessions/:sessionId/summary', async (req: AuthenticatedRequest, res: Response) => {
    try {
      const sessionId = req.params.sessionId;
      
      // Get all contexts for this session
      const contexts = await app.contextStore.searchContexts('', {
        sessionId,
        tags: [`client:${req.llmClient?.id}`],
      });

      // Generate summary statistics
      const summary = {
        sessionId,
        totalMemories: contexts.length,
        memoryTypes: {},
        importanceLevels: {},
        tags: new Set(),
        timeRange: {
          first: null,
          last: null,
        },
        averageConfidence: 0,
      };

      let totalConfidence = 0;
      let confidenceCount = 0;

      contexts.forEach(context => {
        // Count memory types
        const memoryType = context.metadata.memoryType || 'unknown';
        summary.memoryTypes[memoryType] = (summary.memoryTypes[memoryType] || 0) + 1;

        // Count importance levels
        const importance = context.metadata.importance || 'medium';
        summary.importanceLevels[importance] = (summary.importanceLevels[importance] || 0) + 1;

        // Collect tags
        context.tags.forEach(tag => {
          if (!tag.startsWith('client:')) {
            summary.tags.add(tag);
          }
        });

        // Track time range
        if (!summary.timeRange.first || context.createdAt < summary.timeRange.first) {
          summary.timeRange.first = context.createdAt;
        }
        if (!summary.timeRange.last || context.createdAt > summary.timeRange.last) {
          summary.timeRange.last = context.createdAt;
        }

        // Calculate average confidence
        if (context.metadata.confidence) {
          totalConfidence += context.metadata.confidence;
          confidenceCount++;
        }
      });

      summary.averageConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;
      summary.tags = Array.from(summary.tags);

      res.json({
        success: true,
        summary,
        generatedAt: new Date(),
      });

    } catch (error) {
      logger.error('Failed to generate session summary', error);
      res.status(500).json({
        error: 'Summary generation failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  });

  logger.info('LLM Memory routes registered');
}