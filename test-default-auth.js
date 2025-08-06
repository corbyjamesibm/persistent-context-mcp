/**
 * Test Neo4j with default password
 */

import neo4j from 'neo4j-driver';

async function testConnection() {
  console.log('🧪 Testing Neo4j Connection with default password...');
  
  const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'neo4j')
  );

  try {
    console.log('📡 Connecting to Neo4j...');
    await driver.verifyConnectivity();
    console.log('✅ Connected successfully with default password!');
    
    // Now change the password
    const session = driver.session({ database: 'system' });
    
    console.log('🔄 Changing password to: password123');
    await session.run(
      "ALTER USER neo4j SET PASSWORD 'password123'"
    );
    
    console.log('✅ Password changed successfully!');
    await session.close();
    
  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
  } finally {
    await driver.close();
  }
}

testConnection();