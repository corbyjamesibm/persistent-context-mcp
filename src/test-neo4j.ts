/**
 * Neo4j Integration Test
 * Tests the Neo4j context store implementation
 */

import { createNeo4jContextStore } from './core/storage/neo4j-store.js';
import { getDatabaseConfig } from './config/database.config.js';
import { ContextType } from './types/entities/context.js';

async function testNeo4jIntegration() {
  console.log('🧪 Testing Neo4j Integration...');
  
  try {
    // Get configuration
    const config = getDatabaseConfig();
    const store = createNeo4jContextStore(config.neo4j);
    
    console.log('📡 Connecting to Neo4j...');
    await store.connect();
    console.log('✅ Connected successfully!');
    
    // Test saving a context
    console.log('💾 Testing context save...');
    const contextId = await store.saveContext({
      title: 'Test Context for Integration',
      content: 'This is a test context created by the integration test to verify Neo4j functionality.',
      type: ContextType.GENERAL,
      tags: ['test', 'integration', 'neo4j'],
      metadata: {
        tokenCount: 150,
        quality: 0.8,
        interactions: 0,
        templateCount: 0,
        lastAccessed: new Date(),
        aiGenerated: false,
        source: 'integration-test',
        importance: 'medium',
      },
    });
    console.log(`✅ Context saved with ID: ${contextId}`);
    
    // Test retrieving the context
    console.log('🔍 Testing context retrieval...');
    const retrievedContext = await store.getContext(contextId);
    if (retrievedContext) {
      console.log(`✅ Context retrieved: "${retrievedContext.title}"`);
      console.log(`   - Type: ${retrievedContext.type}`);
      console.log(`   - Tags: ${retrievedContext.tags.join(', ')}`);
      console.log(`   - Token Count: ${retrievedContext.metadata.tokenCount}`);
    } else {
      throw new Error('Failed to retrieve context');
    }
    
    // Test updating the context
    console.log('📝 Testing context update...');
    const updatedContext = await store.updateContext(contextId, {
      title: 'Updated Test Context',
      tags: ['test', 'integration', 'neo4j', 'updated'],
      metadata: {
        quality: 0.9,
        interactions: 1,
      },
    });
    if (updatedContext) {
      console.log(`✅ Context updated: "${updatedContext.title}"`);
      console.log(`   - Quality: ${updatedContext.metadata.quality}`);
      console.log(`   - Interactions: ${updatedContext.metadata.interactions}`);
    } else {
      throw new Error('Failed to update context');
    }
    
    // Test searching contexts
    console.log('🔍 Testing context search...');
    const searchResults = await store.searchContexts('integration');
    console.log(`✅ Search returned ${searchResults.length} results`);
    searchResults.forEach((context, index) => {
      console.log(`   ${index + 1}. "${context.title}" (${context.type})`);
    });
    
    // Test deleting the context
    console.log('🗑️  Testing context deletion...');
    const deleted = await store.deleteContext(contextId);
    if (deleted) {
      console.log('✅ Context deleted successfully');
    } else {
      throw new Error('Failed to delete context');
    }
    
    // Verify deletion
    console.log('🔍 Verifying deletion...');
    const deletedContext = await store.getContext(contextId);
    if (!deletedContext) {
      console.log('✅ Context deletion verified');
    } else {
      throw new Error('Context still exists after deletion');
    }
    
    // Test connection status
    console.log('🔗 Testing connection status...');
    const isConnected = store.isConnectedToDatabase();
    console.log(`✅ Connection status: ${isConnected ? 'Connected' : 'Disconnected'}`);
    
    // Disconnect
    console.log('📡 Disconnecting from Neo4j...');
    await store.disconnect();
    console.log('✅ Disconnected successfully!');
    
    console.log('\n🎉 All Neo4j integration tests passed!');
    
  } catch (error) {
    console.error('❌ Neo4j integration test failed:', error);
    process.exit(1);
  }
}

// Run the test
testNeo4jIntegration();