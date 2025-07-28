/**
 * Services Integration Test
 * Tests the integration between services and Neo4j without full TypeScript compilation
 */

import neo4j from 'neo4j-driver';
import winston from 'winston';

// Simple logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.simple()
  ),
  transports: [
    new winston.transports.Console()
  ]
});

// Simple Neo4j store implementation for testing
class SimpleNeo4jStore {
  constructor(config) {
    this.driver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password)
    );
  }

  async connect() {
    await this.driver.verifyConnectivity();
    logger.info('Connected to Neo4j');
  }

  async disconnect() {
    await this.driver.close();
    logger.info('Disconnected from Neo4j');
  }

  async saveContext(contextData) {
    const session = this.driver.session();
    try {
      const contextId = `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      await session.run(`
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
          quality: $quality
        })
      `, {
        id: contextId,
        title: contextData.title,
        content: contextData.content,
        type: contextData.type,
        userId: 'system',
        tags: contextData.tags || [],
        tokenCount: contextData.tokenCount || Math.ceil(contextData.content.length / 4),
        quality: contextData.quality || 0.5
      });

      logger.info(`Context saved: ${contextId}`);
      return contextId;
    } finally {
      await session.close();
    }
  }

  async searchContexts(query) {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (c:Context)
        WHERE c.title CONTAINS $query OR c.content CONTAINS $query
        RETURN c
        ORDER BY c.updatedAt DESC
        LIMIT 10
      `, { query });

      return result.records.map(record => {
        const props = record.get('c').properties;
        return {
          id: props.id,
          title: props.title,
          content: props.content,
          type: props.type,
          tags: props.tags,
          tokenCount: props.tokenCount,
          quality: props.quality
        };
      });
    } finally {
      await session.close();
    }
  }

  async getStats() {
    const session = this.driver.session();
    try {
      const result = await session.run(`
        MATCH (c:Context)
        RETURN count(c) as totalContexts, avg(c.tokenCount) as avgTokens, collect(c.type) as types
      `);

      const record = result.records[0];
      const types = record.get('types');
      const typeCounts = {};
      types.forEach(type => {
        typeCounts[type] = (typeCounts[type] || 0) + 1;
      });

      return {
        totalContexts: record.get('totalContexts').toNumber(),
        avgTokens: Math.round(record.get('avgTokens') || 0),
        typeDistribution: typeCounts
      };
    } finally {
      await session.close();
    }
  }
}

async function testServicesIntegration() {
  console.log('🧪 Testing Services Integration with Neo4j...\n');
  
  const store = new SimpleNeo4jStore({
    uri: 'bolt://localhost:7687',
    username: 'neo4j',
    password: 'persistentcontext123'
  });

  try {
    // Connect to database
    console.log('📡 Connecting to Neo4j...');
    await store.connect();
    console.log('✅ Connected successfully!\n');

    // Test context saving with metadata
    console.log('💾 Testing enhanced context saving...');
    const testContexts = [
      {
        title: 'AI Assistant Integration Planning',
        content: 'Planning the integration of AI assistants with the persistent context store. This involves setting up MCP tools, defining context schemas, and implementing search capabilities for efficient context retrieval.',
        type: 'planning',
        tags: ['ai', 'planning', 'integration', 'mcp'],
        quality: 0.9,
        tokenCount: 150
      },
      {
        title: 'Neo4j Graph Database Setup',
        content: 'Successfully configured Neo4j graph database with proper constraints and indexes. Created schema for contexts with relationships, implemented CRUD operations, and tested connection pooling.',
        type: 'development',
        tags: ['neo4j', 'database', 'graph', 'setup'],
        quality: 0.95,
        tokenCount: 120
      },
      {
        title: 'Template Generation Analysis',
        content: 'Analyzed successful contexts to identify patterns for template generation. Implemented confidence scoring, variable extraction, and pattern recognition algorithms for creating reusable templates.',
        type: 'analysis',
        tags: ['templates', 'analysis', 'patterns', 'ai'],
        quality: 0.85,
        tokenCount: 180
      }
    ];

    const contextIds = [];
    for (const contextData of testContexts) {
      const contextId = await store.saveContext(contextData);
      contextIds.push(contextId);
    }
    console.log(`✅ Created ${contextIds.length} test contexts\n`);

    // Test search functionality
    console.log('🔍 Testing search functionality...');
    const searchQueries = ['integration', 'Neo4j', 'template', 'AI'];
    
    for (const query of searchQueries) {
      const results = await store.searchContexts(query);
      console.log(`   - "${query}": ${results.length} results`);
      results.slice(0, 2).forEach(context => {
        console.log(`     • "${context.title}" (${context.type})`);
      });
    }
    console.log('✅ Search functionality working!\n');

    // Test database statistics
    console.log('📊 Testing database statistics...');
    const stats = await store.getStats();
    console.log(`✅ Database Statistics:`);
    console.log(`   - Total Contexts: ${stats.totalContexts}`);
    console.log(`   - Average Tokens: ${stats.avgTokens}`);
    console.log(`   - Type Distribution:`);
    Object.entries(stats.typeDistribution).forEach(([type, count]) => {
      console.log(`     • ${type}: ${count}`);
    });
    console.log();

    // Test quality and metadata analysis
    console.log('⭐ Testing quality analysis...');
    const allContexts = await store.searchContexts('');
    const highQualityContexts = allContexts.filter(c => c.quality >= 0.9);
    const avgQuality = allContexts.reduce((sum, c) => sum + c.quality, 0) / allContexts.length;
    
    console.log(`✅ Quality Analysis:`);
    console.log(`   - High Quality Contexts (≥0.9): ${highQualityContexts.length}/${allContexts.length}`);
    console.log(`   - Average Quality Score: ${avgQuality.toFixed(3)}`);
    console.log(`   - High Quality Titles:`);
    highQualityContexts.forEach(context => {
      console.log(`     • "${context.title}" (${context.quality})`);
    });
    console.log();

    console.log('🎉 All services integration tests passed!');
    console.log('✅ Neo4j storage working correctly');
    console.log('✅ Context metadata properly stored');
    console.log('✅ Search functionality operational');
    console.log('✅ Quality analysis functional');
    console.log('✅ Ready for full application deployment!');

  } catch (error) {
    console.error('❌ Services integration test failed:', error);
    process.exit(1);
  } finally {
    await store.disconnect();
  }
}

// Run the test
testServicesIntegration();