/**
 * Neo4j implementation of the context store
 */

import neo4j, { Driver, Session } from 'neo4j-driver';
import { Context, CreateContextRequest, UpdateContextRequest, ContextFilters } from '../../types/entities/context.js';
import { logger } from '../../utils/logger.js';

export interface Neo4jConfig {
  uri: string;
  username: string;
  password: string;
}

export class Neo4jContextStore {
  private driver: Driver;

  constructor(private config: Neo4jConfig) {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );
  }

  async connect(): Promise<void> {
    try {
      await this.driver.verifyConnectivity();
      logger.info('Successfully connected to Neo4j database');
      await this.initializeConstraints();
    } catch (error) {
      logger.error('Failed to connect to Neo4j:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    await this.driver.close();
    logger.info('Disconnected from Neo4j database');
  }

  private async initializeConstraints(): Promise<void> {
    const session = this.driver.session();
    try {
      // Create constraints and indexes
      await session.run(`
        CREATE CONSTRAINT context_id_unique IF NOT EXISTS
        FOR (c:Context) REQUIRE c.id IS UNIQUE
      `);
      
      await session.run(`
        CREATE INDEX context_title_text IF NOT EXISTS
        FOR (c:Context) ON (c.title)
      `);
      
      await session.run(`
        CREATE INDEX context_type IF NOT EXISTS
        FOR (c:Context) ON (c.type)
      `);

      logger.info('Neo4j constraints and indexes initialized');
    } finally {
      await session.close();
    }
  }

  async saveContext(contextData: CreateContextRequest): Promise<string> {
    const session = this.driver.session();
    try {
      const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      const result = await session.run(`
        CREATE (c:Context {
          id: $id,
          title: $title,
          content: $content,
          type: $type,
          status: 'active',
          createdAt: datetime(),
          updatedAt: datetime(),
          userId: $userId,
          tags: $tags,
          tokenCount: $tokenCount,
          quality: $quality,
          interactions: 0,
          templateCount: 0,
          lastAccessed: datetime(),
          aiGenerated: $aiGenerated
        })
        RETURN c.id as contextId
      `, {
        id: contextId,
        title: contextData.title,
        content: contextData.content,
        type: contextData.type,
        userId: 'default_user', // TODO: Get from auth context
        tags: contextData.tags || [],
        tokenCount: contextData.metadata?.tokenCount || 0,
        quality: contextData.metadata?.quality || 0,
        aiGenerated: contextData.metadata?.aiGenerated || false
      });

      logger.info(`Context saved with ID: ${contextId}`);
      return result.records[0].get('contextId');
    } finally {
      await session.close();
    }
  }

  async getContext(id: string): Promise<Context | null> {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (c:Context {id: $id})
        RETURN c
      `, { id });

      if (result.records.length === 0) {
        return null;
      }

      const contextNode = result.records[0].get('c');
      return this.mapNodeToContext(contextNode);
    } finally {
      await session.close();
    }
  }

  async updateContext(id: string, updates: UpdateContextRequest): Promise<Context | null> {
    const session = this.driver.session();
    try {
      const setClauses = [];
      const params: any = { id };

      if (updates.title) {
        setClauses.push('c.title = $title');
        params.title = updates.title;
      }
      if (updates.content) {
        setClauses.push('c.content = $content');
        params.content = updates.content;
      }
      if (updates.type) {
        setClauses.push('c.type = $type');
        params.type = updates.type;
      }
      if (updates.status) {
        setClauses.push('c.status = $status');
        params.status = updates.status;
      }
      if (updates.tags) {
        setClauses.push('c.tags = $tags');
        params.tags = updates.tags;
      }

      setClauses.push('c.updatedAt = datetime()');

      const result = await session.run(`
        MATCH (c:Context {id: $id})
        SET ${setClauses.join(', ')}
        RETURN c
      `, params);

      if (result.records.length === 0) {
        return null;
      }

      const contextNode = result.records[0].get('c');
      return this.mapNodeToContext(contextNode);
    } finally {
      await session.close();
    }
  }

  async searchContexts(query: string, filters?: ContextFilters): Promise<Context[]> {
    const session = this.driver.session();
    try {
      let whereClause = '';
      const params: any = {};

      if (query) {
        whereClause += 'WHERE (c.title CONTAINS $query OR c.content CONTAINS $query)';
        params.query = query;
      }

      if (filters?.type) {
        whereClause += whereClause ? ' AND ' : 'WHERE ';
        whereClause += 'c.type = $type';
        params.type = filters.type;
      }

      const result = await session.run(`
        MATCH (c:Context)
        ${whereClause}
        RETURN c
        ORDER BY c.updatedAt DESC
        LIMIT 50
      `, params);

      return result.records.map(record => 
        this.mapNodeToContext(record.get('c'))
      );
    } finally {
      await session.close();
    }
  }

  private mapNodeToContext(node: any): Context {
    const properties = node.properties;
    return {
      id: properties.id,
      title: properties.title,
      content: properties.content,
      type: properties.type,
      status: properties.status,
      createdAt: new Date(properties.createdAt),
      updatedAt: new Date(properties.updatedAt),
      userId: properties.userId,
      tags: properties.tags || [],
      metadata: {
        tokenCount: properties.tokenCount || 0,
        quality: properties.quality || 0,
        interactions: properties.interactions || 0,
        templateCount: properties.templateCount || 0,
        lastAccessed: new Date(properties.lastAccessed),
        aiGenerated: properties.aiGenerated || false
      },
      relationships: [] // TODO: Load relationships
    };
  }
}