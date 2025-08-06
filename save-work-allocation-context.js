/**
 * Save Work Allocation Context to Neo4j
 */

import neo4j from 'neo4j-driver';
import fs from 'fs/promises';

async function saveWorkAllocationContext() {
  console.log('💾 Saving work allocation context to Neo4j...');
  
  const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'neo4j123')
  );

  try {
    console.log('📡 Connecting to Neo4j...');
    await driver.verifyConnectivity();
    console.log('✅ Connected successfully!');

    const session = driver.session();
    
    // Read the work allocation context
    const contextContent = await fs.readFile('/Users/corbyjames/cpmcp/apptio-target-process-mcp/persistent-context-store/work-allocation-context.json', 'utf8');
    
    // Create context in Neo4j
    console.log('💾 Saving work allocation context...');
    const result = await session.run(`
      CREATE (c:Context {
        id: $id,
        title: $title,
        content: $content,
        type: 'planning',
        status: 'active',
        createdAt: datetime(),
        updatedAt: datetime(),
        userId: 'system',
        tags: $tags,
        metadata: $metadata
      })
      RETURN c.id as contextId
    `, {
      id: `work-allocation-${Date.now()}`,
      title: 'Work Allocation Entity Guide',
      content: contextContent,
      tags: ['targetprocess', 'work-allocation', 'portfolio', 'planning'],
      metadata: JSON.stringify({
        source: 'targetprocess-analysis',
        importance: 'high',
        version: '1.0',
        lastValidated: new Date().toISOString()
      })
    });
    
    const contextId = result.records[0].get('contextId');
    console.log(`✅ Work allocation context saved with ID: ${contextId}`);

    // Also save RTE context
    const rteContent = await fs.readFile('/Users/corbyjames/cpmcp/apptio-target-process-mcp/config/personalities/release-train-engineer.json', 'utf8');
    
    const rteResult = await session.run(`
      CREATE (c:Context {
        id: $id,
        title: $title,
        content: $content,
        type: 'planning',
        status: 'active',
        createdAt: datetime(),
        updatedAt: datetime(),
        userId: 'system',
        tags: $tags,
        metadata: $metadata
      })
      RETURN c.id as contextId
    `, {
      id: `rte-config-${Date.now()}`,
      title: 'Release Train Engineer Configuration',
      content: rteContent,
      tags: ['targetprocess', 'rte', 'safe', 'planning', 'configuration'],
      metadata: JSON.stringify({
        source: 'rte-configuration',
        importance: 'high',
        version: '1.0',
        configType: 'release-train-engineer'
      })
    });
    
    const rteContextId = rteResult.records[0].get('contextId');
    console.log(`✅ RTE configuration saved with ID: ${rteContextId}`);
    
    // Create relationship between contexts
    await session.run(`
      MATCH (wa:Context {id: $waId})
      MATCH (rte:Context {id: $rteId})
      CREATE (wa)-[:RELATED_TO {type: 'configuration', createdAt: datetime()}]->(rte)
    `, {
      waId: contextId,
      rteId: rteContextId
    });
    
    console.log('✅ Created relationship between contexts');
    
    await session.close();
    console.log('\n🎉 All contexts saved successfully to Neo4j!');

  } catch (error) {
    console.error('❌ Failed to save context:', error.message);
  } finally {
    await driver.close();
  }
}

saveWorkAllocationContext();