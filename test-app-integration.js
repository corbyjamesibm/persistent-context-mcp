/**
 * Full Application Integration Test
 * Tests the complete persistent context store with all services connected
 */

import { createPersistentContextStoreApp } from './src/app.js';

async function testFullIntegration() {
  console.log('🧪 Testing Full Application Integration...\n');
  
  const app = createPersistentContextStoreApp();
  
  try {
    // Initialize the application
    console.log('🚀 Initializing application...');
    await app.initialize();
    console.log('✅ Application initialized successfully!\n');
    
    // Test health status
    console.log('🔍 Checking health status...');
    const health = app.getHealthStatus();
    console.log(`✅ Health Status:`);
    console.log(`   - Database: ${health.database ? '✅ Connected' : '❌ Disconnected'}`);
    console.log(`   - Services: ${health.services ? '✅ Running' : '❌ Stopped'}`);
    console.log(`   - Uptime: ${health.uptime}s\n`);
    
    // Test context saving through context manager
    console.log('💾 Testing context save through context manager...');
    const saveResult = await app.contextManager.saveContextImmediate(
      'test-session-123',
      {
        title: 'Integration Test Context',
        content: 'This context tests the full integration of the persistent context store application with Neo4j database, search indexing, and all core services working together seamlessly.',
        type: 'general',
        tags: ['integration', 'test', 'full-stack'],
        metadata: {
          tokenCount: 200,
          quality: 0.9,
          importance: 'high',
          aiGenerated: false,
          source: 'integration-test'
        }
      }
    );
    
    if (saveResult.success) {
      console.log(`✅ Context saved: ${saveResult.contextId}`);
      console.log(`   - Validation: ${saveResult.validationResult?.isValid ? '✅ Valid' : '❌ Invalid'}`);
    } else {
      throw new Error(`Context save failed: ${saveResult.error}`);
    }
    
    // Test search functionality
    console.log('\n🔍 Testing search functionality...');
    const searchResults = await app.searchService.search({
      query: 'integration test',
      options: {
        highlightMatches: true,
        limit: 5
      }
    });
    
    console.log(`✅ Search completed in ${searchResults.executionTime}ms`);
    console.log(`   - Results: ${searchResults.totalCount} contexts found`);
    searchResults.results.forEach((result, index) => {
      console.log(`   ${index + 1}. "${result.context.title}" (score: ${result.score.toFixed(3)})`);
    });
    
    // Test template candidate identification
    console.log('\n🎯 Testing template generation...');
    const candidates = await app.templateGenerator.identifyTemplateCandidates({
      minSuccessScore: 0.5
    });
    
    console.log(`✅ Template candidates identified: ${candidates.length}`);
    candidates.slice(0, 3).forEach((candidate, index) => {
      console.log(`   ${index + 1}. "${candidate.title}" (confidence: ${(candidate.confidence * 100).toFixed(1)}%)`);
    });
    
    // Test session management
    console.log('\n📋 Testing session management...');
    const recentSessions = await app.contextManager.getRecentSessions(5);
    console.log(`✅ Recent sessions retrieved: ${recentSessions.length}`);
    recentSessions.forEach((session, index) => {
      console.log(`   ${index + 1}. Session ${session.sessionId.slice(-8)} - ${session.contextCount} contexts`);
    });
    
    // Test search statistics
    console.log('\n📊 Testing search statistics...');
    const searchStats = app.searchService.getSearchStats();
    console.log(`✅ Search Statistics:`);
    console.log(`   - Index Size: ${searchStats.indexSize} contexts`);
    console.log(`   - Total Tokens: ${searchStats.totalTokens}`);
    console.log(`   - Avg Tokens/Context: ${Math.round(searchStats.avgTokensPerContext)}`);
    console.log(`   - Last Index Update: ${searchStats.lastIndexUpdate.toLocaleTimeString()}`);
    
    // Test context manager system status
    console.log('\n⚙️  Testing context manager status...');
    const systemStatus = app.contextManager.getSystemStatus();
    console.log(`✅ System Status:`);
    console.log(`   - Active: ${systemStatus.isActive ? '✅ Yes' : '❌ No'}`);
    console.log(`   - Pending Contexts: ${systemStatus.pendingContexts}`);
    console.log(`   - Active Sessions: ${systemStatus.activeSessions}`);
    
    // Test graceful shutdown
    console.log('\n🛑 Testing graceful shutdown...');
    await app.shutdown();
    console.log('✅ Application shutdown completed successfully!\n');
    
    console.log('🎉 All integration tests passed! The persistent context store is fully functional.');
    
  } catch (error) {
    console.error('❌ Integration test failed:', error);
    
    // Attempt cleanup
    try {
      await app.shutdown();
    } catch (shutdownError) {
      console.error('❌ Failed to shutdown after error:', shutdownError);
    }
    
    process.exit(1);
  }
}

// Run the integration test
testFullIntegration();