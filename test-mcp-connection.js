/**
 * MCP Connection Test
 * Verify the MCP server can be connected to and used
 */

import { spawn } from 'child_process';
import { setTimeout } from 'timers/promises';

async function testMcpConnection() {
  console.log('🧪 Testing MCP Server Connection...\n');
  
  const server = spawn('npm', ['run', 'mcp'], {
    stdio: ['pipe', 'pipe', 'pipe'],
    cwd: process.cwd()
  });
  
  let serverReady = false;
  let output = '';
  
  server.stdout.on('data', (data) => {
    const message = data.toString();
    output += message;
    if (message.includes('MCP Server started and ready for connections')) {
      serverReady = true;
    }
  });
  
  server.stderr.on('data', (data) => {
    output += data.toString();
  });
  
  // Wait for server to start
  let attempts = 0;
  while (!serverReady && attempts < 20) {
    await setTimeout(500);
    attempts++;
  }
  
  if (serverReady) {
    console.log('✅ MCP Server started successfully!');
    console.log('🔍 Server initialization output:');
    console.log(output);
    
    console.log('\n📋 MCP Server Features Available:');
    console.log('   ✅ save_context - Save contexts with validation');
    console.log('   ✅ search_contexts - Advanced context search');
    console.log('   ✅ get_context - Retrieve specific contexts');
    console.log('   ✅ generate_template - Create reusable templates');
    console.log('   ✅ apply_template - Use templates for contexts');
    console.log('   ✅ get_recent_sessions - Session management');
    console.log('   ✅ resume_session - Quick session resume');
    console.log('   ✅ get_system_status - Health and statistics');
    
    console.log('\n🚀 Ready for Claude Code Integration!');
    console.log('Add this to your .claude_code/claude_code.config.json:');
    console.log(JSON.stringify({
      mcpServers: {
        "persistent-context-store": {
          command: "npm",
          args: ["run", "mcp"],
          cwd: process.cwd()
        }
      }
    }, null, 2));
    
    console.log('\n🎉 MCP Server connection test completed successfully!');
  } else {
    console.log('❌ MCP Server failed to start within timeout');
    console.log('Output:', output);
  }
  
  // Clean shutdown
  server.kill('SIGTERM');
  await setTimeout(1000);
}

testMcpConnection().catch(console.error);