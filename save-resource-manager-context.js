/**
 * Save Enhanced Resource Manager Context to Neo4j
 */

import neo4j from 'neo4j-driver';
import fs from 'fs/promises';

async function saveResourceManagerContext() {
  console.log('💾 Saving Resource Manager configuration to Neo4j...');
  
  const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'neo4j123')
  );

  try {
    console.log('📡 Connecting to Neo4j...');
    await driver.verifyConnectivity();
    console.log('✅ Connected successfully!');

    const session = driver.session();
    
    // Read the Resource Manager configuration
    const rmConfig = await fs.readFile('/Users/corbyjames/cpmcp/apptio-target-process-mcp/apptio-target-process-mcp/config/personalities/resource-manager.json', 'utf8');
    
    // Read the work matching guide
    const rmGuide = await fs.readFile('/Users/corbyjames/cpmcp/apptio-target-process-mcp/docs/resource-manager-work-matching-guide.md', 'utf8');
    
    // Save Resource Manager configuration
    console.log('💾 Saving Resource Manager configuration...');
    const configResult = await session.run(`
      CREATE (c:Context {
        id: $id,
        title: $title,
        content: $content,
        type: 'configuration',
        status: 'active',
        createdAt: datetime(),
        updatedAt: datetime(),
        userId: 'system',
        tags: $tags,
        metadata: $metadata
      })
      RETURN c.id as contextId
    `, {
      id: `resource-manager-config-${Date.now()}`,
      title: 'Enhanced Resource Manager Configuration with Work Matching',
      content: rmConfig,
      tags: ['targetprocess', 'resource-manager', 'work-matching', 'skills', 'team-assignment', 'configuration'],
      metadata: JSON.stringify({
        source: 'resource-manager-configuration',
        importance: 'high',
        version: '2.0',
        configType: 'resource-manager',
        enhancements: ['work-matching', 'team-profiling', 'skills-analysis']
      })
    });
    
    const configId = configResult.records[0].get('contextId');
    console.log(`✅ Resource Manager configuration saved with ID: ${configId}`);

    // Save Work Matching Guide
    console.log('💾 Saving Work Matching Guide...');
    const guideResult = await session.run(`
      CREATE (c:Context {
        id: $id,
        title: $title,
        content: $content,
        type: 'documentation',
        status: 'active',
        createdAt: datetime(),
        updatedAt: datetime(),
        userId: 'system',
        tags: $tags,
        metadata: $metadata
      })
      RETURN c.id as contextId
    `, {
      id: `resource-manager-guide-${Date.now()}`,
      title: 'Resource Manager Work Matching Guide',
      content: rmGuide,
      tags: ['targetprocess', 'resource-manager', 'work-matching', 'documentation', 'guide', 'best-practices'],
      metadata: JSON.stringify({
        source: 'resource-manager-documentation',
        importance: 'high',
        version: '1.0',
        documentType: 'operational-guide'
      })
    });
    
    const guideId = guideResult.records[0].get('contextId');
    console.log(`✅ Work Matching Guide saved with ID: ${guideId}`);
    
    // Create relationships between contexts
    await session.run(`
      MATCH (config:Context {id: $configId})
      MATCH (guide:Context {id: $guideId})
      CREATE (config)-[:DOCUMENTED_BY]->(guide)
    `, {
      configId: configId,
      guideId: guideId
    });
    
    // Link to RTE configuration
    await session.run(`
      MATCH (rm:Context {id: $rmId})
      MATCH (rte:Context)
      WHERE rte.title CONTAINS 'Release Train Engineer'
      CREATE (rm)-[:COLLABORATES_WITH]->(rte)
    `, {
      rmId: configId
    });
    
    console.log('✅ Created relationships between contexts');
    
    await session.close();
    console.log('\n🎉 Resource Manager configuration and guide saved successfully!');

  } catch (error) {
    console.error('❌ Failed to save context:', error.message);
  } finally {
    await driver.close();
  }
}

saveResourceManagerContext();