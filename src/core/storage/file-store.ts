/**
 * File-based Context Store Implementation
 * Provides simple file system storage for contexts as a fallback to Neo4j
 */

import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import { Context, CreateContextRequest, UpdateContextRequest, ContextFilters, ContextType, ContextStatus } from '../../types/entities/context.js';
import { logger } from '../../utils/logger.js';

export interface FileStoreConfig {
  dataDir: string;
}

export class FileContextStore extends EventEmitter {
  private config: FileStoreConfig;
  private contextsFile: string;
  private isConnected = false;

  constructor(config: FileStoreConfig) {
    super();
    this.config = config;
    this.contextsFile = path.join(config.dataDir, 'contexts.json');
  }

  /**
   * Initialize file store
   */
  async connect(): Promise<void> {
    try {
      logger.info('Initializing file-based context store...', { dataDir: this.config.dataDir });

      // Ensure data directory exists
      await fs.mkdir(this.config.dataDir, { recursive: true });

      // Initialize contexts file if it doesn't exist
      try {
        await fs.access(this.contextsFile);
      } catch {
        await fs.writeFile(this.contextsFile, JSON.stringify([], null, 2));
      }

      this.isConnected = true;
      logger.info('File-based context store initialized successfully');
      this.emit('connected');
    } catch (error) {
      logger.error('Failed to initialize file store:', error);
      this.emit('connectionError', error);
      throw error;
    }
  }

  /**
   * Disconnect (no-op for file store)
   */
  async disconnect(): Promise<void> {
    this.isConnected = false;
    logger.info('File-based context store disconnected');
    this.emit('disconnected');
  }

  /**
   * Save a new context to the file
   */
  async saveContext(request: CreateContextRequest): Promise<string> {
    try {
      const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const newContext: Context = {
        id: contextId,
        title: request.title,
        content: request.content,
        type: request.type,
        status: ContextStatus.ACTIVE,
        createdAt: now,
        updatedAt: now,
        userId: 'system',
        tags: request.tags || [],
        metadata: {
          tokenCount: request.metadata?.tokenCount || this.estimateTokenCount(request.content),
          quality: request.metadata?.quality || 0.5,
          interactions: request.metadata?.interactions || 0,
          templateCount: request.metadata?.templateCount || 0,
          lastAccessed: now,
          aiGenerated: request.metadata?.aiGenerated || false,
          source: request.metadata?.source,
          importance: request.metadata?.importance || 'medium',
        },
        relationships: [],
      };

      // Read existing contexts
      const contexts = await this.readContexts();
      
      // Add new context
      contexts.push(newContext);
      
      // Save back to file
      await this.writeContexts(contexts);

      logger.info(`Context saved successfully: ${contextId}`);
      this.emit('contextSaved', { contextId, title: request.title });
      
      return contextId;
    } catch (error) {
      logger.error('Failed to save context:', error);
      throw error;
    }
  }

  /**
   * Update an existing context
   */
  async updateContext(contextId: string, request: UpdateContextRequest): Promise<Context | null> {
    try {
      const contexts = await this.readContexts();
      const contextIndex = contexts.findIndex(c => c.id === contextId);

      if (contextIndex === -1) {
        return null;
      }

      const context = contexts[contextIndex];
      const updatedContext = {
        ...context,
        ...(request.title !== undefined && { title: request.title }),
        ...(request.content !== undefined && { content: request.content }),
        ...(request.type !== undefined && { type: request.type }),
        ...(request.status !== undefined && { status: request.status }),
        ...(request.tags !== undefined && { tags: request.tags }),
        updatedAt: new Date(),
      };

      contexts[contextIndex] = updatedContext;
      await this.writeContexts(contexts);

      logger.info(`Context updated successfully: ${contextId}`);
      this.emit('contextUpdated', { contextId, context: updatedContext });
      
      return updatedContext;
    } catch (error) {
      logger.error(`Failed to update context ${contextId}:`, error);
      throw error;
    }
  }

  /**
   * Get a context by ID
   */
  async getContext(contextId: string): Promise<Context | null> {
    try {
      const contexts = await this.readContexts();
      const context = contexts.find(c => c.id === contextId);

      if (context) {
        // Update last accessed
        context.metadata.lastAccessed = new Date();
        context.metadata.interactions = (context.metadata.interactions || 0) + 1;
        
        const contextIndex = contexts.findIndex(c => c.id === contextId);
        contexts[contextIndex] = context;
        await this.writeContexts(contexts);
      }

      return context || null;
    } catch (error) {
      logger.error(`Failed to get context ${contextId}:`, error);
      throw error;
    }
  }

  /**
   * Search contexts with filters
   */
  async searchContexts(searchTerm: string, filters?: ContextFilters): Promise<Context[]> {
    try {
      const contexts = await this.readContexts();
      
      let results = contexts;

      // Apply search term
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        results = results.filter(c => 
          c.title.toLowerCase().includes(term) ||
          c.content.toLowerCase().includes(term) ||
          c.tags.some(tag => tag.toLowerCase().includes(term))
        );
      }

      // Apply filters
      if (filters?.type) {
        results = results.filter(c => c.type === filters.type);
      }

      if (filters?.status) {
        results = results.filter(c => c.status === filters.status);
      }

      if (filters?.tags && filters.tags.length > 0) {
        results = results.filter(c => 
          filters.tags!.some(tag => c.tags.includes(tag))
        );
      }

      if (filters?.userId) {
        results = results.filter(c => c.userId === filters.userId);
      }

      if (filters?.dateRange) {
        const start = filters.dateRange.start.getTime();
        const end = filters.dateRange.end.getTime();
        results = results.filter(c => {
          const created = new Date(c.createdAt).getTime();
          return created >= start && created <= end;
        });
      }

      // Sort by updated date (newest first)
      results.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );

      logger.info(`Search returned ${results.length} contexts`);
      return results;
    } catch (error) {
      logger.error('Failed to search contexts:', error);
      throw error;
    }
  }

  /**
   * Delete a context
   */
  async deleteContext(contextId: string): Promise<boolean> {
    try {
      const contexts = await this.readContexts();
      const initialLength = contexts.length;
      
      const filteredContexts = contexts.filter(c => c.id !== contextId);
      
      if (filteredContexts.length < initialLength) {
        await this.writeContexts(filteredContexts);
        logger.info(`Context deleted successfully: ${contextId}`);
        this.emit('contextDeleted', { contextId });
        return true;
      }

      return false;
    } catch (error) {
      logger.error(`Failed to delete context ${contextId}:`, error);
      throw error;
    }
  }

  /**
   * Check if connected
   */
  isConnectedToDatabase(): boolean {
    return this.isConnected;
  }

  /**
   * Read contexts from file
   */
  private async readContexts(): Promise<Context[]> {
    try {
      const data = await fs.readFile(this.contextsFile, 'utf-8');
      const contexts = JSON.parse(data);
      
      // Convert date strings back to Date objects
      return contexts.map((c: any) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
        metadata: {
          ...c.metadata,
          lastAccessed: new Date(c.metadata.lastAccessed),
        },
      }));
    } catch (error) {
      logger.error('Failed to read contexts file:', error);
      return [];
    }
  }

  /**
   * Write contexts to file
   */
  private async writeContexts(contexts: Context[]): Promise<void> {
    try {
      await fs.writeFile(
        this.contextsFile,
        JSON.stringify(contexts, null, 2),
        'utf-8'
      );
    } catch (error) {
      logger.error('Failed to write contexts file:', error);
      throw error;
    }
  }

  /**
   * Estimate token count for content
   */
  private estimateTokenCount(content: string): number {
    // Simple estimation: ~4 characters per token
    return Math.ceil(content.length / 4);
  }
}

/**
 * Factory function to create file context store
 */
export function createFileContextStore(config: FileStoreConfig): FileContextStore {
  return new FileContextStore(config);
}