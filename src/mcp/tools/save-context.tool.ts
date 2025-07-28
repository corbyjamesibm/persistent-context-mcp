/**
 * MCP Context Save Tool (US-4529)
 * Provides MCP tool interface for AI assistants to save conversation context
 */

import { z } from 'zod';
import { AutoSaveService } from '../../core/services/auto-save.service.js';
import { CreateContextRequest, ContextType } from '../../types/entities/context.js';
import { logger } from '../../utils/logger.js';

// Input validation schema for save_context tool
export const SaveContextInputSchema = z.object({
  title: z.string().min(1).max(200),
  content: z.string().min(1).max(100000),
  type: z.nativeEnum(ContextType).optional().default(ContextType.GENERAL),
  sessionId: z.string().min(1).max(100),
  tags: z.array(z.string().max(50)).optional().default([]),
  metadata: z.object({
    tokenCount: z.number().int().min(0).optional(),
    quality: z.number().min(0).max(1).optional(),
    aiGenerated: z.boolean().optional().default(true),
    source: z.string().max(100).optional(),
    importance: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  }).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  autoSave: z.boolean().optional().default(false),
}).strict();

export type SaveContextInput = z.infer<typeof SaveContextInputSchema>;

// Output schema for save_context tool
export const SaveContextOutputSchema = z.object({
  success: z.boolean(),
  contextId: z.string().optional(),
  sessionId: z.string(),
  message: z.string(),
  error: z.string().optional(),
  metadata: z.object({
    savedAt: z.string(), // ISO timestamp
    saveTimeMs: z.number().optional(),
    retryCount: z.number().optional(),
    autoSave: z.boolean(),
    pendingChanges: z.boolean(),
  }),
});

export type SaveContextOutput = z.infer<typeof SaveContextOutputSchema>;

export class SaveContextTool {
  private autoSaveService: AutoSaveService;

  constructor(autoSaveService: AutoSaveService) {
    this.autoSaveService = autoSaveService;
  }

  /**
   * MCP tool definition for save_context
   */
  static getToolDefinition() {
    return {
      name: 'save_context',
      description: 'Save conversation context to persistent storage with optional metadata and automatic retry',
      inputSchema: SaveContextInputSchema,
      outputSchema: SaveContextOutputSchema,
    };
  }

  /**
   * Execute the save_context tool
   */
  async execute(input: SaveContextInput): Promise<SaveContextOutput> {
    const startTime = Date.now();

    try {
      // Validate input parameters
      const validatedInput = SaveContextInputSchema.parse(input);
      
      logger.info(`MCP save_context called: session=${validatedInput.sessionId}, type=${validatedInput.type}, autoSave=${validatedInput.autoSave}`);

      // Build context request
      const contextRequest: CreateContextRequest = {
        title: validatedInput.title,
        content: validatedInput.content,
        type: validatedInput.type,
        tags: validatedInput.tags,
        metadata: {
          tokenCount: validatedInput.metadata?.tokenCount || this.estimateTokenCount(validatedInput.content),
          quality: validatedInput.metadata?.quality || 0.8, // Default quality score
          aiGenerated: validatedInput.metadata?.aiGenerated ?? true,
          source: validatedInput.metadata?.source || 'mcp_tool',
          importance: validatedInput.metadata?.importance || 'medium',
          lastAccessed: new Date(),
        },
      };

      let result;
      
      if (validatedInput.autoSave) {
        // Queue for automatic saving
        this.autoSaveService.queueContext(validatedInput.sessionId, contextRequest);
        
        const output: SaveContextOutput = {
          success: true,
          sessionId: validatedInput.sessionId,
          message: 'Context queued for automatic saving',
          metadata: {
            savedAt: new Date().toISOString(),
            autoSave: true,
            pendingChanges: true,
          },
        };

        logger.info(`Context queued for auto-save: session=${validatedInput.sessionId}`);
        return output;

      } else {
        // Immediate manual save
        result = await this.autoSaveService.saveNow(validatedInput.sessionId);
        this.autoSaveService.queueContext(validatedInput.sessionId, contextRequest);
        result = await this.autoSaveService.saveNow(validatedInput.sessionId);
      }

      const saveTimeMs = Date.now() - startTime;

      if (result.success) {
        const output: SaveContextOutput = {
          success: true,
          contextId: result.contextId,
          sessionId: validatedInput.sessionId,
          message: `Context saved successfully${result.retryCount > 0 ? ` after ${result.retryCount} retries` : ''}`,
          metadata: {
            savedAt: result.timestamp.toISOString(),
            saveTimeMs: result.saveTimeMs,
            retryCount: result.retryCount,
            autoSave: false,
            pendingChanges: this.autoSaveService.hasPendingChanges(validatedInput.sessionId),
          },
        };

        logger.info(`Context saved via MCP: contextId=${result.contextId}, session=${validatedInput.sessionId}, time=${result.saveTimeMs}ms`);
        return output;

      } else {
        const output: SaveContextOutput = {
          success: false,
          sessionId: validatedInput.sessionId,
          message: 'Failed to save context',
          error: result.error,
          metadata: {
            savedAt: new Date().toISOString(),
            saveTimeMs,
            retryCount: result.retryCount,
            autoSave: false,
            pendingChanges: this.autoSaveService.hasPendingChanges(validatedInput.sessionId),
          },
        };

        logger.error(`Context save failed via MCP: session=${validatedInput.sessionId}, error=${result.error}`);
        return output;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      const saveTimeMs = Date.now() - startTime;

      const output: SaveContextOutput = {
        success: false,
        sessionId: input.sessionId || 'unknown',
        message: 'Tool execution failed',
        error: errorMessage,
        metadata: {
          savedAt: new Date().toISOString(),
          saveTimeMs,
          autoSave: false,
          pendingChanges: false,
        },
      };

      logger.error(`MCP save_context tool error: ${errorMessage}`, error);
      return output;
    }
  }

  /**
   * Estimate token count from content (simple heuristic)
   */
  private estimateTokenCount(content: string): number {
    // Simple token estimation: ~4 characters per token on average
    return Math.ceil(content.length / 4);
  }

  /**
   * Validate concurrent save requests
   */
  private async handleConcurrentSaves(sessionId: string): Promise<boolean> {
    // Check if there are already pending changes for this session
    if (this.autoSaveService.hasPendingChanges(sessionId)) {
      logger.warn(`Concurrent save request detected for session: ${sessionId}`);
      // Allow concurrent saves but log the event
      return true;
    }
    return true;
  }
}

/**
 * Factory function to create SaveContextTool
 */
export function createSaveContextTool(autoSaveService: AutoSaveService): SaveContextTool {
  return new SaveContextTool(autoSaveService);
}