/**
 * Neo4j Context Store Implementation
 * Provides graph database storage for contexts with relationships and advanced querying
 */

import neo4j, { Driver, Session, Node, Relationship, Record } from 'neo4j-driver';
import { EventEmitter } from 'events';
import { Context, CreateContextRequest, UpdateContextRequest, ContextFilters, ContextType, ContextStatus } from '../../types/entities/context.js';
import { logger } from '../../utils/logger.js';

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
  database?: string;
  maxConnectionLifetime?: number;
  maxConnectionPoolSize?: number;
  connectionAcquisitionTimeout?: number;
}

export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'ASC' | 'DESC';
}

export interface RelationshipData {
  type: string;
  targetContextId: string;
  properties?: { [key: string]: any };
}

export class Neo4jContextStore extends EventEmitter {
  private driver: Driver | null = null;
  private config: Neo4jConfig;
  private isConnected = false;

  constructor(config: Neo4jConfig) {
    super();
    this.config = {
      database: 'neo4j',
      maxConnectionLifetime: 30000,
      maxConnectionPoolSize: 100,
      connectionAcquisitionTimeout: 60000,
      ...config,
    };
  }

  /**
   * Connect to Neo4j database
   */
  async connect(): Promise<void> {
    try {
      logger.info('Connecting to Neo4j...', { uri: this.config.uri, database: this.config.database });

      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.username, this.config.password),
        {
          maxConnectionLifetime: this.config.maxConnectionLifetime,
          maxConnectionPoolSize: this.config.maxConnectionPoolSize,
          connectionAcquisitionTimeout: this.config.connectionAcquisitionTimeout,
        }
      );

      // Verify connectivity
      await this.driver.verifyConnectivity();
      this.isConnected = true;

      logger.info('Successfully connected to Neo4j');
      this.emit('connected');
    } catch (error) {
      logger.error('Failed to connect to Neo4j:', error);
      this.emit('connectionError', error);
      throw error;
    }
  }

  /**
   * Disconnect from Neo4j database
   */
  async disconnect(): Promise<void> {
    if (this.driver) {
      try {
        await this.driver.close();
        this.isConnected = false;
        logger.info('Disconnected from Neo4j');
        this.emit('disconnected');
      } catch (error) {
        logger.error('Error disconnecting from Neo4j:', error);
        throw error;
      } finally {
        this.driver = null;
      }
    }
  }

  /**
   * Save a new context to the database
   */
  async saveContext(request: CreateContextRequest): Promise<string> {
    const session = this.getSession();
    
    try {
      const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const now = new Date();

      const result = await session.executeWrite(async (tx) => {
        const query = `
          CREATE (c:Context {
            id: $id,
            title: $title,
            content: $content,
            type: $type,
            status: $status,
            createdAt: datetime($createdAt),
            updatedAt: datetime($updatedAt),
            userId: $userId,
            tags: $tags,
            tokenCount: $tokenCount,
            quality: $quality,
            interactions: $interactions,
            templateCount: $templateCount,
            lastAccessed: datetime($lastAccessed),
            aiGenerated: $aiGenerated,
            source: $source,
            importance: $importance
          })
          RETURN c
        `;

        return await tx.run(query, {
          id: contextId,
          title: request.title,
          content: request.content,
          type: request.type,
          status: ContextStatus.ACTIVE,
          createdAt: now.toISOString(),
          updatedAt: now.toISOString(),
          userId: 'system', // Would be passed from request context
          tags: request.tags || [],
          tokenCount: request.metadata?.tokenCount || this.estimateTokenCount(request.content),
          quality: request.metadata?.quality || 0.5,
          interactions: request.metadata?.interactions || 0,
          templateCount: request.metadata?.templateCount || 0,
          lastAccessed: now.toISOString(),
          aiGenerated: request.metadata?.aiGenerated || false,
          source: request.metadata?.source,
          importance: request.metadata?.importance || 'medium',
        });
      });

      logger.info(`Context saved successfully: ${contextId}`);
      this.emit('contextSaved', { contextId, title: request.title });
      
      return contextId;
    } catch (error) {
      logger.error('Failed to save context:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Update an existing context
   */
  async updateContext(contextId: string, request: UpdateContextRequest): Promise<Context | null> {
    const session = this.getSession();
    
    try {
      const result = await session.executeWrite(async (tx) => {
        const setParts: string[] = [];
        const params: any = { contextId };

        if (request.title !== undefined) {
          setParts.push('c.title = $title');
          params.title = request.title;
        }
        if (request.content !== undefined) {
          setParts.push('c.content = $content');
          params.content = request.content;
        }
        if (request.type !== undefined) {
          setParts.push('c.type = $type');
          params.type = request.type;
        }
        if (request.status !== undefined) {
          setParts.push('c.status = $status');
          params.status = request.status;
        }
        if (request.tags !== undefined) {
          setParts.push('c.tags = $tags');
          params.tags = request.tags;
        }

        // Always update the updatedAt timestamp
        setParts.push('c.updatedAt = datetime($updatedAt)');
        params.updatedAt = new Date().toISOString();

        if (setParts.length === 0) {
          throw new Error('No fields to update');
        }

        const query = `
          MATCH (c:Context {id: $contextId})
          SET ${setParts.join(', ')}
          RETURN c
        `;

        return await tx.run(query, params);
      });

      if (result.records.length === 0) {
        return null;
      }

      const context = this.nodeToContext(result.records[0].get('c'));
      logger.info(`Context updated successfully: ${contextId}`);
      this.emit('contextUpdated', { contextId, context });
      
      return context;
    } catch (error) {
      logger.error(`Failed to update context ${contextId}:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Get a context by ID
   */
  async getContext(contextId: string): Promise<Context | null> {
    const session = this.getSession();
    
    try {
      const result = await session.executeRead(async (tx) => {
        const query = `
          MATCH (c:Context {id: $contextId})
          OPTIONAL MATCH (c)-[r]->(target:Context)
          RETURN c, collect({type: type(r), target: target.id, properties: properties(r)}) as relationships
        `;

        return await tx.run(query, { contextId });
      });

      if (result.records.length === 0) {
        return null;
      }

      const record = result.records[0];
      const context = this.nodeToContext(record.get('c'));
      const relationships = record.get('relationships') || [];

      // Add relationships to context
      context.relationships = relationships
        .filter((rel: any) => rel.target !== null)
        .map((rel: any) => ({
          id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          type: rel.type,
          targetContextId: rel.target,
          strength: rel.properties?.strength || 1.0,
          metadata: rel.properties || {},
        }));

      // Update last accessed timestamp
      await this.updateLastAccessed(contextId);

      return context;
    } catch (error) {
      logger.error(`Failed to get context ${contextId}:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Search contexts with filters and pagination
   */
  async searchContexts(searchTerm: string, filters?: ContextFilters, options?: QueryOptions): Promise<Context[]> {
    const session = this.getSession();
    
    try {
      const result = await session.executeRead(async (tx) => {
        const whereClauses: string[] = [];
        const params: any = {};

        // Search term matching
        if (searchTerm) {
          whereClauses.push('(c.title CONTAINS $searchTerm OR c.content CONTAINS $searchTerm)');
          params.searchTerm = searchTerm;
        }

        // Apply filters
        if (filters?.type) {
          whereClauses.push('c.type = $type');
          params.type = filters.type;
        }

        if (filters?.status) {
          whereClauses.push('c.status = $status');
          params.status = filters.status;
        }

        if (filters?.tags && filters.tags.length > 0) {
          whereClauses.push('ANY(tag IN $tags WHERE tag IN c.tags)');
          params.tags = filters.tags;
        }

        if (filters?.userId) {
          whereClauses.push('c.userId = $userId');
          params.userId = filters.userId;
        }

        if (filters?.dateRange) {
          whereClauses.push('c.createdAt >= datetime($startDate) AND c.createdAt <= datetime($endDate)');
          params.startDate = filters.dateRange.start.toISOString();
          params.endDate = filters.dateRange.end.toISOString();
        }

        // Build query
        const whereClause = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
        const orderBy = options?.orderBy || 'updatedAt';
        const orderDirection = options?.orderDirection || 'DESC';
        const limit = options?.limit || 50;
        const skip = options?.offset || 0;

        const query = `
          MATCH (c:Context)
          ${whereClause}
          RETURN c
          ORDER BY c.${orderBy} ${orderDirection}
          SKIP $skip
          LIMIT $limit
        `;

        params.skip = neo4j.int(skip);
        params.limit = neo4j.int(limit);

        return await tx.run(query, params);
      });

      const contexts = result.records.map(record => this.nodeToContext(record.get('c')));
      logger.info(`Search returned ${contexts.length} contexts`);
      
      return contexts;
    } catch (error) {
      logger.error('Failed to search contexts:', error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Delete a context
   */
  async deleteContext(contextId: string): Promise<boolean> {
    const session = this.getSession();
    
    try {
      const result = await session.executeWrite(async (tx) => {
        const query = `
          MATCH (c:Context {id: $contextId})
          DETACH DELETE c
          RETURN count(c) as deletedCount
        `;

        return await tx.run(query, { contextId });
      });

      const deletedCount = result.records[0]?.get('deletedCount')?.toNumber() || 0;
      const success = deletedCount > 0;

      if (success) {
        logger.info(`Context deleted successfully: ${contextId}`);
        this.emit('contextDeleted', { contextId });
      }

      return success;
    } catch (error) {
      logger.error(`Failed to delete context ${contextId}:`, error);
      throw error;
    } finally {
      await session.close();
    }
  }

  /**
   * Check if connected to database
   */
  isConnectedToDatabase(): boolean {
    return this.isConnected && this.driver !== null;
  }

  /**
   * Get a database session
   */
  private getSession(): Session {
    if (!this.driver) {
      throw new Error('Not connected to Neo4j database');
    }
    return this.driver.session({ database: this.config.database });
  }

  /**
   * Convert Neo4j node to Context object
   */
  private nodeToContext(node: Node): Context {
    const props = node.properties;
    
    return {
      id: props.id as string,
      title: props.title as string,
      content: props.content as string,
      type: props.type as ContextType,
      status: props.status as ContextStatus,
      createdAt: new Date(props.createdAt as string),
      updatedAt: new Date(props.updatedAt as string),
      userId: props.userId as string,
      tags: props.tags as string[] || [],
      metadata: {
        tokenCount: props.tokenCount as number || 0,
        quality: props.quality as number || 0.5,
        interactions: props.interactions as number || 0,
        templateCount: props.templateCount as number || 0,
        lastAccessed: new Date(props.lastAccessed as string || props.updatedAt as string),
        aiGenerated: props.aiGenerated as boolean || false,
        source: props.source as string,
        importance: props.importance as 'low' | 'medium' | 'high' || 'medium',
      },
      relationships: [], // Will be populated by specific queries
    };
  }

  /**
   * Update last accessed timestamp
   */
  private async updateLastAccessed(contextId: string): Promise<void> {
    const session = this.getSession();
    
    try {
      await session.executeWrite(async (tx) => {
        const query = `
          MATCH (c:Context {id: $contextId})
          SET c.lastAccessed = datetime($now)
          SET c.interactions = c.interactions + 1
        `;

        await tx.run(query, {
          contextId,
          now: new Date().toISOString(),
        });
      });
    } catch (error) {
      logger.warn(`Failed to update last accessed for ${contextId}:`, error);
    } finally {
      await session.close();
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
 * Factory function to create Neo4j context store
 */
export function createNeo4jContextStore(config: Neo4jConfig): Neo4jContextStore {
  return new Neo4jContextStore(config);
}