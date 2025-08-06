/**
 * Reset Neo4j Password with Auth Disabled
 */

import neo4j from 'neo4j-driver';

async function resetPassword() {
  console.log('🔐 Resetting Neo4j password with auth disabled...');
  
  const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('', '') // Empty auth for disabled authentication
  );

  try {
    console.log('📡 Connecting to Neo4j (auth disabled)...');
    await driver.verifyConnectivity();
    console.log('✅ Connected successfully!');

    const session = driver.session({ database: 'system' });
    
    // Set new password
    const newPassword = 'password123';
    console.log(`🔄 Setting password to: ${newPassword}`);
    
    await session.run(
      "ALTER USER neo4j SET PASSWORD $password",
      { password: newPassword }
    );
    
    console.log('✅ Password set successfully!');
    await session.close();
    
  } catch (error) {
    console.error('❌ Failed to reset password:', error.message);
  } finally {
    await driver.close();
  }
}

resetPassword();