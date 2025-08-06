/**
 * Change Neo4j Password Script
 */

import neo4j from 'neo4j-driver';

async function changePassword() {
  console.log('🔐 Attempting to change Neo4j password...');
  
  // First, try to connect with the password set by neo4j-admin
  const passwords = ['password123', 'neo4j', 'neo4j123'];
  let driver = null;
  let connectedPassword = null;

  for (const password of passwords) {
    try {
      console.log(`Trying password: ${password}`);
      driver = neo4j.driver(
        'bolt://localhost:7687',
        neo4j.auth.basic('neo4j', password)
      );
      await driver.verifyConnectivity();
      connectedPassword = password;
      console.log(`✅ Connected with password: ${password}`);
      break;
    } catch (error) {
      console.log(`❌ Failed with password: ${password}`);
      if (driver) await driver.close();
    }
  }

  if (!driver || !connectedPassword) {
    console.error('❌ Could not connect with any known password');
    return;
  }

  try {
    const session = driver.session({ database: 'system' });
    
    // Change password
    const newPassword = 'password123';
    console.log(`🔄 Changing password to: ${newPassword}`);
    
    await session.run(
      'ALTER CURRENT USER SET PASSWORD FROM $currentPassword TO $newPassword',
      { 
        currentPassword: connectedPassword,
        newPassword: newPassword 
      }
    );
    
    console.log('✅ Password changed successfully!');
    await session.close();
    
    // Test new password
    await driver.close();
    driver = neo4j.driver(
      'bolt://localhost:7687',
      neo4j.auth.basic('neo4j', newPassword)
    );
    
    console.log('🧪 Testing new password...');
    await driver.verifyConnectivity();
    console.log('✅ New password works!');
    
  } catch (error) {
    console.error('❌ Failed to change password:', error.message);
  } finally {
    await driver.close();
  }
}

changePassword();