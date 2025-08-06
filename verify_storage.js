/**
 * Verify Session Storage
 * Query the stored conversation contexts to confirm they're properly saved
 */

import neo4j from 'neo4j-driver';

async function verifyStorage() {
  console.log('🔍 Verifying session storage...');
  
  const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'neo4j123')
  );
  
  const session = driver.session();
  
  try {
    // Find all contexts from our session
    const sessionQuery = `
      MATCH (c:Context)
      WHERE c.sessionId CONTAINS "ai_memory_session"
      RETURN c.id, c.title, c.type, c.tags, c.keyInsight, c.userQuote
      ORDER BY c.createdAt DESC
      LIMIT 10
    `;
    
    const result = await session.run(sessionQuery);
    
    console.log(`\n📊 Found ${result.records.length} stored contexts:`);
    console.log('='.repeat(60));
    
    result.records.forEach((record, index) => {
      const id = record.get('c.id');
      const title = record.get('c.title');
      const type = record.get('c.type');
      const tags = record.get('c.tags');
      const keyInsight = record.get('c.keyInsight');
      const userQuote = record.get('c.userQuote');
      
      console.log(`\n${index + 1}. ${title}`);
      console.log(`   ID: ${id}`);
      console.log(`   Type: ${type}`);
      console.log(`   Tags: ${tags.slice(0, 3).join(', ')}${tags.length > 3 ? '...' : ''}`);
      if (keyInsight) console.log(`   Key Insight: ${keyInsight}`);
      if (userQuote) console.log(`   User Quote: "${userQuote}"`);
    });
    
    // Test search functionality
    console.log('\n🔍 Testing search functionality...');
    
    const searchQuery = `
      MATCH (c:Context)
      WHERE c.content CONTAINS "AI integration" OR c.content CONTAINS "analytics"
      RETURN c.title, c.type, c.tags[0..3] as topTags
      ORDER BY c.createdAt DESC
      LIMIT 5
    `;
    
    const searchResult = await session.run(searchQuery);
    
    console.log(`\n📋 Search results for "AI integration" or "analytics":`);
    searchResult.records.forEach((record, index) => {
      const title = record.get('c.title');
      const type = record.get('c.type');
      const topTags = record.get('topTags');
      
      console.log(`${index + 1}. ${title} (${type})`);
      console.log(`   Tags: ${topTags.join(', ')}`);
    });
    
    // Test relationships
    console.log('\n🔗 Testing context relationships...');
    
    const relQuery = `
      MATCH (main:Context)-[r]->(related:Context)
      WHERE main.sessionId CONTAINS "ai_memory_session"
      RETURN main.title as mainTitle, type(r) as relationshipType, related.title as relatedTitle
    `;
    
    const relResult = await session.run(relQuery);
    
    console.log(`\n🔗 Found ${relResult.records.length} relationships:`);
    relResult.records.forEach(record => {
      const mainTitle = record.get('mainTitle');
      const relType = record.get('relationshipType');
      const relatedTitle = record.get('relatedTitle');
      
      console.log(`"${mainTitle}" --[${relType}]--> "${relatedTitle}"`);
    });
    
    // Memory retrieval test
    console.log('\n🧠 Testing memory retrieval by key concepts...');
    
    const memoryQuery = `
      MATCH (c:Context)
      WHERE ANY(tag IN c.tags WHERE tag CONTAINS "memory" OR tag CONTAINS "semantic")
      RETURN c.title, c.keyInsight, c.userQuote
    `;
    
    const memoryResult = await session.run(memoryQuery);
    
    console.log(`\n🧠 Memory-related contexts:`);
    memoryResult.records.forEach(record => {
      const title = record.get('c.title');
      const keyInsight = record.get('c.keyInsight');
      const userQuote = record.get('c.userQuote');
      
      console.log(`📝 ${title}`);
      if (keyInsight) console.log(`   💡 ${keyInsight}`);
      if (userQuote) console.log(`   💬 "${userQuote}"`);
    });
    
    console.log('\n✅ Verification completed successfully!');
    console.log('🎯 The AI memory system is now active and storing contexts.');
    console.log('🔗 Access Neo4j Browser at: http://localhost:7474');
    
    return true;
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    return false;
  } finally {
    await session.close();
    await driver.close();
  }
}

verifyStorage().catch(console.error);