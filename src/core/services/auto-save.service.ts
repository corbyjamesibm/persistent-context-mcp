/**
 * Automatic Context Saving Service (US-4526)
 * Implements background auto-saving with retry mechanisms and user notifications
 */

import { EventEmitter } from 'events';
import { Neo4jContextStore } from '../storage/neo4j-store.js';
import { CreateContextRequest, UpdateContextRequest } from '../../types/entities/context.js';
import { logger } from '../../utils/logger.js';

export interface AutoSaveConfig {
  intervalMs: number; // Auto-save interval in milliseconds (default: 30000 = 30 seconds)
  maxRetries: number; // Maximum retry attempts (default: 3)
  retryDelayMs: number; // Delay between retries in milliseconds (default: 1000)
  saveTimeoutMs: number; // Maximum time for save operation (default: 5000)
}

export interface SaveResult {
  success: boolean;
  contextId?: string;
  error?: string;
  timestamp: Date;
  retryCount: number;
  saveTimeMs: number;
}

export interface PendingContext {
  id?: string; // Existing context ID for updates
  data: CreateContextRequest | UpdateContextRequest;
  isUpdate: boolean;
  lastModified: Date;
  retryCount: number;
}

export class AutoSaveService extends EventEmitter {
  private contextStore: Neo4jContextStore;
  private config: AutoSaveConfig;
  private saveTimer: NodeJS.Timeout | null = null;
  private pendingContexts: Map<string, PendingContext> = new Map();
  private isActive = false;
  private saveInProgress = false;

  constructor(contextStore: Neo4jContextStore, config?: Partial<AutoSaveConfig>) {
    super();
    this.contextStore = contextStore;
    this.config = {
      intervalMs: 30000, // 30 seconds
      maxRetries: 3,
      retryDelayMs: 1000, // 1 second
      saveTimeoutMs: 5000, // 5 seconds
      ...config,
    };
  }

  /**
   * Start the automatic saving service
   */
  start(): void {
    if (this.isActive) {
      logger.warn('AutoSaveService is already active');
      return;
    }

    this.isActive = true;
    this.scheduleNextSave();
    logger.info(`AutoSaveService started with ${this.config.intervalMs}ms interval`);
    this.emit('started');
  }

  /**
   * Stop the automatic saving service
   */
  stop(): void {
    if (!this.isActive) {
      return;
    }

    this.isActive = false;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }

    logger.info('AutoSaveService stopped');
    this.emit('stopped');
  }

  /**
   * Queue a context for automatic saving
   */
  queueContext(sessionId: string, data: CreateContextRequest | UpdateContextRequest, contextId?: string): void {
    const isUpdate = !!contextId;
    const pendingContext: PendingContext = {
      id: contextId,
      data,
      isUpdate,
      lastModified: new Date(),
      retryCount: 0,
    };

    this.pendingContexts.set(sessionId, pendingContext);
    logger.debug(`Context queued for auto-save: session=${sessionId}, isUpdate=${isUpdate}`);
    this.emit('contextQueued', { sessionId, isUpdate });
  }

  /**
   * Manually trigger save for a specific session
   */
  async saveNow(sessionId: string): Promise<SaveResult> {
    const pendingContext = this.pendingContexts.get(sessionId);
    if (!pendingContext) {
      const result: SaveResult = {
        success: false,
        error: 'No pending context found for session',
        timestamp: new Date(),
        retryCount: 0,
        saveTimeMs: 0,
      };
      this.emit('saveCompleted', { sessionId, result });
      return result;
    }

    return this.performSave(sessionId, pendingContext);
  }

  /**
   * Get the number of pending contexts
   */
  getPendingCount(): number {
    return this.pendingContexts.size;
  }

  /**
   * Check if a session has pending changes
   */
  hasPendingChanges(sessionId: string): boolean {
    return this.pendingContexts.has(sessionId);
  }

  /**
   * Schedule the next automatic save cycle
   */
  private scheduleNextSave(): void {
    if (!this.isActive) {
      return;
    }

    this.saveTimer = setTimeout(() => {
      this.performAutoSave().finally(() => {
        this.scheduleNextSave();
      });
    }, this.config.intervalMs);
  }

  /**
   * Perform automatic save for all pending contexts
   */
  private async performAutoSave(): Promise<void> {
    if (this.saveInProgress || this.pendingContexts.size === 0) {
      return;
    }

    this.saveInProgress = true;
    logger.debug(`Starting auto-save cycle for ${this.pendingContexts.size} pending contexts`);

    const savePromises: Promise<void>[] = [];
    const pendingEntries = Array.from(this.pendingContexts.entries());

    for (const [sessionId, pendingContext] of pendingEntries) {
      savePromises.push(
        this.performSave(sessionId, pendingContext)
          .then(result => {
            if (result.success) {
              this.pendingContexts.delete(sessionId);
            }
          })
          .catch(error => {
            logger.error(`Auto-save failed for session ${sessionId}:`, error);
          })
      );
    }

    await Promise.allSettled(savePromises);
    this.saveInProgress = false;
    this.emit('autoSaveCycleCompleted', {
      processedCount: pendingEntries.length,
      remainingCount: this.pendingContexts.size,
    });
  }

  /**
   * Perform save operation for a single context with retry logic
   */
  private async performSave(sessionId: string, pendingContext: PendingContext): Promise<SaveResult> {
    const startTime = Date.now();

    try {
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Save operation timed out')), this.config.saveTimeoutMs);
      });

      const savePromise = pendingContext.isUpdate
        ? this.contextStore.updateContext(pendingContext.id!, pendingContext.data as UpdateContextRequest)
        : this.contextStore.saveContext(pendingContext.data as CreateContextRequest);

      const result = await Promise.race([savePromise, timeoutPromise]);
      const saveTimeMs = Date.now() - startTime;

      let contextId: string | undefined;
      if (pendingContext.isUpdate) {
        contextId = (result as any)?.id || pendingContext.id;
      } else {
        contextId = result as string;
      }

      const saveResult: SaveResult = {
        success: true,
        contextId,
        timestamp: new Date(),
        retryCount: pendingContext.retryCount,
        saveTimeMs,
      };

      logger.info(`Context saved successfully: session=${sessionId}, time=${saveTimeMs}ms, retries=${pendingContext.retryCount}`);
      this.emit('saveCompleted', { sessionId, result: saveResult });
      this.emit('saveSuccess', { sessionId, contextId, saveTimeMs });

      return saveResult;

    } catch (error) {
      const saveTimeMs = Date.now() - startTime;
      pendingContext.retryCount++;

      const saveResult: SaveResult = {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
        retryCount: pendingContext.retryCount,
        saveTimeMs,
      };

      logger.error(`Context save failed: session=${sessionId}, retries=${pendingContext.retryCount}, error=${saveResult.error}`);

      if (pendingContext.retryCount < this.config.maxRetries) {
        // Schedule retry
        setTimeout(() => {
          this.performSave(sessionId, pendingContext);
        }, this.config.retryDelayMs * pendingContext.retryCount);

        this.emit('saveRetrying', { sessionId, retryCount: pendingContext.retryCount, error: saveResult.error });
      } else {
        // Max retries exceeded
        this.pendingContexts.delete(sessionId);
        this.emit('saveCompleted', { sessionId, result: saveResult });
        this.emit('saveFailed', { sessionId, error: saveResult.error, maxRetriesExceeded: true });
      }

      return saveResult;
    }
  }
}

/**
 * Factory function to create and configure AutoSaveService
 */
export function createAutoSaveService(
  contextStore: Neo4jContextStore,
  config?: Partial<AutoSaveConfig>
): AutoSaveService {
  return new AutoSaveService(contextStore, config);
}