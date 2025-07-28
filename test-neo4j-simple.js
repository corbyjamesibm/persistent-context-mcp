/**
 * Simple Neo4j Connection Test
 */

import neo4j from 'neo4j-driver';

async function testConnection() {
  console.log('🧪 Testing Neo4j Connection...');
  
  const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'persistentcontext123')
  );

  try {
    console.log('📡 Connecting to Neo4j...');
    await driver.verifyConnectivity();
    console.log('✅ Connected successfully!');

    const session = driver.session();
    
    // Test basic query
    console.log('🔍 Running test query...');
    const result = await session.run('RETURN "Hello Neo4j!" as message');
    const message = result.records[0].get('message');
    console.log(`✅ Query result: ${message}`);

    // Test creating a simple context
    console.log('💾 Creating test context...');
    const contextResult = await session.run(`
      CREATE (c:Context {
        id: $id,
        title: $title,
        content: $content,
        type: 'general',
        status: 'active',
        createdAt: datetime(),
        updatedAt: datetime(),
        userId: 'system',
        tags: $tags
      })
      RETURN c.id as contextId
    `, {
      id: `test_${Date.now()}`,
      title: 'Simple Test Context',
      content: 'This is a simple test context created via JavaScript.',
      tags: ['test', 'javascript']
    });
    
    const contextId = contextResult.records[0].get('contextId');
    console.log(`✅ Context created with ID: ${contextId}`);

    // Test retrieving the context
    console.log('📖 Retrieving test context...');
    const retrieveResult = await session.run(`
      MATCH (c:Context {id: $id})
      RETURN c
    `, { id: contextId });

    if (retrieveResult.records.length > 0) {
      const context = retrieveResult.records[0].get('c').properties;
      console.log(`✅ Context retrieved: "${context.title}"`);
      console.log(`   - Type: ${context.type}`);
      console.log(`   - Tags: ${context.tags.join(', ')}`);
    }

    // Cleanup
    console.log('🧹 Cleaning up test context...');
    await session.run(`
      MATCH (c:Context {id: $id})
      DELETE c
    `, { id: contextId });
    console.log('✅ Test context deleted');

    await session.close();
    console.log('\n🎉 Neo4j connection test completed successfully!');

  } catch (error) {
    console.error('❌ Neo4j connection test failed:', error);
    process.exit(1);
  } finally {
    await driver.close();
  }
}

testConnection();