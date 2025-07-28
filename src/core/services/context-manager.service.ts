/**
 * Context Manager Service
 * Coordinates automatic saving, MCP tools, and context management
 */

import { EventEmitter } from 'events';
import { Neo4jContextStore } from '../storage/neo4j-store.js';
import { AutoSaveService, AutoSaveConfig } from './auto-save.service.js';
import { SaveContextTool } from '../../mcp/tools/save-context.tool.js';
import { ContextValidator, ValidationResult, createContextValidator } from '../validation/context-validator.js';
import { Context, CreateContextRequest, UpdateContextRequest, ContextFilters } from '../../types/entities/context.js';
import { logger } from '../../utils/logger.js';

export interface ContextManagerConfig {
  autoSave: Partial<AutoSaveConfig>;
  enableNotifications: boolean;
  maxSessionHistory: number;
}

export interface SessionInfo {
  sessionId: string;
  lastActivity: Date;
  contextCount: number;
  hasPendingChanges: boolean;
  lastContextId?: string;
}

export class ContextManagerService extends EventEmitter {
  private contextStore: Neo4jContextStore;
  private autoSaveService: AutoSaveService;
  private saveContextTool: SaveContextTool;
  private contextValidator: ContextValidator;
  private config: ContextManagerConfig;
  private activeSessions: Map<string, SessionInfo> = new Map();

  constructor(
    contextStore: Neo4jContextStore,
    config?: Partial<ContextManagerConfig>
  ) {
    super();
    this.contextStore = contextStore;
    this.config = {
      autoSave: {},
      enableNotifications: true,
      maxSessionHistory: 50,
      ...config,
    };

    // Initialize services
    this.contextValidator = createContextValidator();
    this.autoSaveService = new AutoSaveService(contextStore, this.config.autoSave);
    this.saveContextTool = new SaveContextTool(this.autoSaveService);

    this.setupEventHandlers();
  }

  /**
   * Initialize and start the context manager
   */
  async initialize(): Promise<void> {
    try {
      await this.contextStore.connect();
      this.autoSaveService.start();
      
      logger.info('ContextManagerService initialized successfully');
      this.emit('initialized');
    } catch (error) {
      logger.error('Failed to initialize ContextManagerService:', error);
      throw error;
    }
  }

  /**
   * Shutdown the context manager
   */
  async shutdown(): Promise<void> {
    try {
      this.autoSaveService.stop();
      await this.contextStore.disconnect();
      
      logger.info('ContextManagerService shutdown complete');
      this.emit('shutdown');
    } catch (error) {
      logger.error('Error during ContextManagerService shutdown:', error);
      throw error;
    }
  }

  /**
   * Get the MCP save context tool
   */
  getSaveContextTool(): SaveContextTool {
    return this.saveContextTool;
  }

  /**
   * Get the auto-save service
   */
  getAutoSaveService(): AutoSaveService {
    return this.autoSaveService;
  }

  /**
   * Quick Session Resume functionality (US-4528)
   */
  async getRecentSessions(limit: number = 10): Promise<SessionInfo[]> {
    const sessions = Array.from(this.activeSessions.values())
      .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime())
      .slice(0, limit);

    return sessions;
  }

  /**
   * Resume a session by loading the most recent context
   */
  async resumeSession(sessionId: string): Promise<Context | null> {
    const sessionInfo = this.activeSessions.get(sessionId);
    if (!sessionInfo?.lastContextId) {
      return null;
    }

    try {
      const context = await this.contextStore.getContext(sessionInfo.lastContextId);
      if (context) {
        this.updateSessionActivity(sessionId);
        this.emit('sessionResumed', { sessionId, contextId: context.id });
      }
      return context;
    } catch (error) {
      logger.error(`Failed to resume session ${sessionId}:`, error);
      return null;
    }
  }

  /**
   * Get contexts for a specific session
   */
  async getSessionContexts(sessionId: string, limit: number = 20): Promise<Context[]> {
    // This would need to be implemented based on how you track session contexts
    // For now, returning recent contexts as a placeholder
    return this.contextStore.searchContexts('', { userId: sessionId });
  }

  /**
   * Save context manually with immediate confirmation and validation
   */
  async saveContextImmediate(
    sessionId: string,
    data: CreateContextRequest
  ): Promise<{ success: boolean; contextId?: string; error?: string; validationResult?: ValidationResult }> {
    try {
      // Validate data before saving
      const validationResult = this.contextValidator.validateCreateRequest(data, {
        autoRepair: true,
        createBackup: true,
        strictMode: false,
        allowPartialData: false,
      });

      if (!validationResult.isValid) {
        const errorMessages = validationResult.errors.map(e => `${e.field}: ${e.message}`).join(', ');
        logger.warn(`Validation failed for session ${sessionId}:`, validationResult.errors);
        return { 
          success: false, 
          error: `Validation failed: ${errorMessages}`,
          validationResult,
        };
      }

      // Use repaired data if available
      const dataToSave = validationResult.repairedData || data;
      
      // Create backup if validation detected issues
      if (validationResult.corruptionDetected) {
        await this.contextValidator.createBackup(sessionId, data);
        logger.info(`Backup created for corrupted data in session ${sessionId}`);
      }

      this.autoSaveService.queueContext(sessionId, dataToSave);
      const result = await this.autoSaveService.saveNow(sessionId);
      
      if (result.success) {
        this.updateSessionInfo(sessionId, result.contextId);
        this.emit('contextValidatedAndSaved', { 
          sessionId, 
          contextId: result.contextId, 
          validationResult,
          repairApplied: !!validationResult.repairedData,
        });
        
        return { 
          success: true, 
          contextId: result.contextId,
          validationResult,
        };
      } else {
        return { 
          success: false, 
          error: result.error,
          validationResult,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Immediate save failed for session ${sessionId}:`, error);
      return { success: false, error: errorMessage };
    }
  }

  /**
   * Validate context data without saving
   */
  validateContextData(data: CreateContextRequest | UpdateContextRequest, isUpdate = false): ValidationResult {
    if (isUpdate) {
      return this.contextValidator.validateUpdateRequest(data);
    } else {
      return this.contextValidator.validateCreateRequest(data as CreateContextRequest);
    }
  }

  /**
   * Validate stored context for integrity
   */
  async validateStoredContext(contextId: string): Promise<ValidationResult | null> {
    try {
      const context = await this.contextStore.getContext(contextId);
      if (!context) {
        return null;
      }

      return this.contextValidator.validateContext(context, {
        autoRepair: false,
        createBackup: false,
        strictMode: true,
        allowPartialData: false,
      });
    } catch (error) {
      logger.error(`Failed to validate stored context ${contextId}:`, error);
      return null;
    }
  }

  /**
   * Get system status including pending saves and session info
   */
  getSystemStatus(): {
    isActive: boolean;
    pendingContexts: number;
    activeSessions: number;
    autoSaveConfig: AutoSaveConfig;
  } {
    return {
      isActive: this.autoSaveService.getPendingCount() >= 0, // Service is initialized
      pendingContexts: this.autoSaveService.getPendingCount(),
      activeSessions: this.activeSessions.size,
      autoSaveConfig: this.autoSaveService['config'], // Access private config
    };
  }

  /**
   * Update session activity tracking
   */
  private updateSessionActivity(sessionId: string): void {
    const session = this.activeSessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Update session information after successful save
   */
  private updateSessionInfo(sessionId: string, contextId?: string): void {
    let session = this.activeSessions.get(sessionId);
    if (!session) {
      session = {
        sessionId,
        lastActivity: new Date(),
        contextCount: 0,
        hasPendingChanges: false,
      };
      this.activeSessions.set(sessionId, session);
    }

    session.lastActivity = new Date();
    session.contextCount++;
    session.hasPendingChanges = this.autoSaveService.hasPendingChanges(sessionId);
    
    if (contextId) {
      session.lastContextId = contextId;
    }

    // Clean up old sessions
    this.cleanupOldSessions();
  }

  /**
   * Setup event handlers for auto-save service
   */
  private setupEventHandlers(): void {
    if (!this.config.enableNotifications) {
      return;
    }

    this.autoSaveService.on('saveSuccess', ({ sessionId, contextId, saveTimeMs }) => {
      this.updateSessionInfo(sessionId, contextId);
      this.emit('contextSaved', { sessionId, contextId, saveTimeMs });
    });

    this.autoSaveService.on('saveFailed', ({ sessionId, error, maxRetriesExceeded }) => {
      this.emit('saveError', { sessionId, error, maxRetriesExceeded });
    });

    this.autoSaveService.on('saveRetrying', ({ sessionId, retryCount, error }) => {
      this.emit('saveRetrying', { sessionId, retryCount, error });
    });

    this.autoSaveService.on('autoSaveCycleCompleted', ({ processedCount, remainingCount }) => {
      this.emit('autoSaveCycleCompleted', { processedCount, remainingCount });
    });
  }

  /**
   * Clean up old inactive sessions
   */
  private cleanupOldSessions(): void {
    if (this.activeSessions.size <= this.config.maxSessionHistory) {
      return;
    }

    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    const sessionsToRemove: string[] = [];

    for (const [sessionId, session] of this.activeSessions) {
      if (session.lastActivity < cutoffTime && !session.hasPendingChanges) {
        sessionsToRemove.push(sessionId);
      }
    }

    // Remove oldest sessions if still over limit
    if (this.activeSessions.size > this.config.maxSessionHistory) {
      const sortedSessions = Array.from(this.activeSessions.entries())
        .sort(([,a], [,b]) => a.lastActivity.getTime() - b.lastActivity.getTime());
      
      const excessCount = this.activeSessions.size - this.config.maxSessionHistory;
      for (let i = 0; i < excessCount; i++) {
        sessionsToRemove.push(sortedSessions[i][0]);
      }
    }

    sessionsToRemove.forEach(sessionId => {
      this.activeSessions.delete(sessionId);
    });

    if (sessionsToRemove.length > 0) {
      logger.debug(`Cleaned up ${sessionsToRemove.length} old sessions`);
    }
  }
}