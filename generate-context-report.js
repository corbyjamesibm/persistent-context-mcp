/**
 * Generate Persistent Context Store Report
 */

import neo4j from 'neo4j-driver';
import fs from 'fs/promises';

async function generateContextReport() {
  console.log('📊 Generating Persistent Context Store Report...');
  
  const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'neo4j123')
  );

  try {
    console.log('📡 Connecting to Neo4j...');
    await driver.verifyConnectivity();
    console.log('✅ Connected successfully!\n');

    const session = driver.session();
    
    // Get all contexts with their details
    console.log('🔍 Fetching all contexts...');
    const result = await session.run(`
      MATCH (c:Context)
      RETURN c.id as id, 
             c.title as title, 
             c.type as type,
             c.status as status,
             c.createdAt as createdAt,
             c.updatedAt as updatedAt,
             c.tags as tags,
             c.metadata as metadata,
             size(c.content) as contentSize
      ORDER BY c.createdAt DESC
    `);
    
    const contexts = result.records.map(record => ({
      id: record.get('id'),
      title: record.get('title'),
      type: record.get('type'),
      status: record.get('status'),
      createdAt: record.get('createdAt'),
      updatedAt: record.get('updatedAt'),
      tags: record.get('tags'),
      metadata: record.get('metadata') ? JSON.parse(record.get('metadata')) : {},
      contentSize: Number(record.get('contentSize'))
    }));
    
    console.log(`✅ Found ${contexts.length} contexts\n`);
    
    // Get relationships
    const relResult = await session.run(`
      MATCH (c1:Context)-[r:RELATED_TO]->(c2:Context)
      RETURN c1.id as fromId, c2.id as toId, r.type as relType
    `);
    
    const relationships = relResult.records.map(record => ({
      from: record.get('fromId'),
      to: record.get('toId'),
      type: record.get('relType')
    }));
    
    // Generate HTML report
    const htmlReport = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Persistent Context Store Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        h1, h2 {
            color: #2c3e50;
        }
        .summary {
            background: #3498db;
            color: white;
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 30px;
        }
        .summary h2 {
            color: white;
            margin-top: 0;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin-top: 15px;
        }
        .stat-card {
            background: rgba(255, 255, 255, 0.2);
            padding: 15px;
            border-radius: 6px;
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            display: block;
        }
        .context-card {
            background: white;
            border: 1px solid #ddd;
            border-radius: 8px;
            padding: 20px;
            margin-bottom: 20px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .context-header {
            display: flex;
            justify-content: space-between;
            align-items: start;
            margin-bottom: 10px;
        }
        .context-title {
            font-size: 1.2em;
            font-weight: bold;
            color: #2c3e50;
            margin: 0;
        }
        .context-type {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.85em;
            font-weight: 500;
        }
        .type-planning {
            background: #e8f5e9;
            color: #2e7d32;
        }
        .type-general {
            background: #e3f2fd;
            color: #1565c0;
        }
        .type-analysis {
            background: #fff3e0;
            color: #e65100;
        }
        .type-development {
            background: #f3e5f5;
            color: #6a1b9a;
        }
        .context-meta {
            color: #666;
            font-size: 0.9em;
            margin: 10px 0;
        }
        .tags {
            margin: 10px 0;
        }
        .tag {
            display: inline-block;
            background: #ecf0f1;
            color: #34495e;
            padding: 3px 10px;
            border-radius: 15px;
            font-size: 0.85em;
            margin-right: 5px;
        }
        .metadata {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 5px;
            font-size: 0.9em;
            margin-top: 10px;
        }
        .relationships {
            margin-top: 30px;
        }
        .relationship {
            background: #fff;
            border-left: 4px solid #3498db;
            padding: 10px 15px;
            margin-bottom: 10px;
        }
        .timestamp {
            color: #7f8c8d;
            font-size: 0.85em;
        }
    </style>
</head>
<body>
    <h1>🗄️ Persistent Context Store Report</h1>
    <p class="timestamp">Generated on: ${new Date().toLocaleString()}</p>
    
    <div class="summary">
        <h2>📊 Summary</h2>
        <div class="stats">
            <div class="stat-card">
                <span class="stat-number">${contexts.length}</span>
                <span>Total Contexts</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${contexts.filter(c => c.status === 'active').length}</span>
                <span>Active Contexts</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${[...new Set(contexts.flatMap(c => c.tags || []))].length}</span>
                <span>Unique Tags</span>
            </div>
            <div class="stat-card">
                <span class="stat-number">${relationships.length}</span>
                <span>Relationships</span>
            </div>
        </div>
    </div>
    
    <h2>📑 Context Entries</h2>
    ${contexts.map((context, index) => `
        <div class="context-card">
            <div class="context-header">
                <h3 class="context-title">${index + 1}. ${context.title}</h3>
                <span class="context-type type-${context.type}">${context.type}</span>
            </div>
            
            <div class="context-meta">
                <strong>ID:</strong> ${context.id}<br>
                <strong>Status:</strong> ${context.status}<br>
                <strong>Content Size:</strong> ${(context.contentSize / 1024).toFixed(2)} KB<br>
                <strong>Created:</strong> ${new Date(context.createdAt).toLocaleString()}<br>
                <strong>Updated:</strong> ${new Date(context.updatedAt).toLocaleString()}
            </div>
            
            ${context.tags && context.tags.length > 0 ? `
                <div class="tags">
                    ${context.tags.map(tag => `<span class="tag">${tag}</span>`).join('')}
                </div>
            ` : ''}
            
            ${context.metadata && Object.keys(context.metadata).length > 0 ? `
                <div class="metadata">
                    <strong>Metadata:</strong><br>
                    ${Object.entries(context.metadata).map(([key, value]) => 
                        `${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`
                    ).join('<br>')}
                </div>
            ` : ''}
        </div>
    `).join('')}
    
    ${relationships.length > 0 ? `
        <h2>🔗 Relationships</h2>
        ${relationships.map(rel => `
            <div class="relationship">
                <strong>${rel.from}</strong> → <strong>${rel.to}</strong> 
                <em>(${rel.type})</em>
            </div>
        `).join('')}
    ` : ''}
    
    <h2>📈 Statistics by Type</h2>
    <div class="context-card">
        ${Object.entries(contexts.reduce((acc, c) => {
            acc[c.type] = (acc[c.type] || 0) + 1;
            return acc;
        }, {})).map(([type, count]) => 
            `<div><strong>${type}:</strong> ${count} contexts</div>`
        ).join('')}
    </div>
    
    <h2>🏷️ Tag Cloud</h2>
    <div class="context-card">
        <div class="tags">
            ${[...new Set(contexts.flatMap(c => c.tags || []))].map(tag => 
                `<span class="tag">${tag}</span>`
            ).join('')}
        </div>
    </div>
</body>
</html>
    `;
    
    // Save HTML report
    const reportPath = '/Users/corbyjames/cpmcp/apptio-target-process-mcp/reports/persistent_context_report.html';
    await fs.writeFile(reportPath, htmlReport);
    console.log(`\n📄 HTML report saved to: ${reportPath}`);
    
    // Print summary to console
    console.log('\n=== PERSISTENT CONTEXT STORE SUMMARY ===');
    console.log(`Total Contexts: ${contexts.length}`);
    console.log(`Active Contexts: ${contexts.filter(c => c.status === 'active').length}`);
    console.log(`Total Relationships: ${relationships.length}`);
    console.log('\nContexts by Type:');
    Object.entries(contexts.reduce((acc, c) => {
        acc[c.type] = (acc[c.type] || 0) + 1;
        return acc;
    }, {})).forEach(([type, count]) => {
        console.log(`  - ${type}: ${count}`);
    });
    
    console.log('\nContext List:');
    contexts.forEach((context, index) => {
        console.log(`\n${index + 1}. ${context.title}`);
        console.log(`   ID: ${context.id}`);
        console.log(`   Type: ${context.type}`);
        console.log(`   Status: ${context.status}`);
        console.log(`   Tags: ${context.tags ? context.tags.join(', ') : 'none'}`);
        console.log(`   Size: ${(context.contentSize / 1024).toFixed(2)} KB`);
    });
    
    await session.close();

  } catch (error) {
    console.error('❌ Failed to generate report:', error.message);
  } finally {
    await driver.close();
  }
}

generateContextReport();