#!/usr/bin/env node

import neo4j from 'neo4j-driver';
import fs from 'fs';

async function savePIPlanningContext() {
    const driver = neo4j.driver(
        'bolt://localhost:7687',
        neo4j.auth.basic('neo4j', 'neo4j123')
    );
    
    const session = driver.session();
    
    try {
        console.log('Connecting to Neo4j...');
        
        // Create the PI Planning Visualization context
        const contextData = {
            id: `pi-planning-viz-${Date.now()}`,
            name: 'PI Planning Visualization - Sprint 3-4 Development',
            type: 'development_session',
            description: 'Complete PI Planning visualization development including cluster spacing, time-lapse, and 2-day event simulation',
            timestamp: new Date().toISOString(),
            metadata: {
                sprint: 'Sprint 3-4',
                team: 'Platform Services & Digital Delivery',
                environment: 'Development',
                technologies: ['D3.js', 'React', 'TypeScript', 'Force Simulation', 'Neo4j']
            },
            components: [
                {
                    name: 'Adjustable Cluster Spacing',
                    status: 'COMPLETED',
                    description: 'Team cluster visualization with dynamic spacing controls',
                    features: [
                        'Dynamic spacing slider (100-1000px)',
                        'Preset buttons (Compact, Normal, Spread, Wide)',
                        'Keyboard shortcuts (+/-, F, 0)',
                        'Fit All Teams functionality',
                        'Individual team focus navigation'
                    ],
                    files: [
                        'PI-PLANNING-CLUSTER-VIEW.html',
                        'tests/e2e/cluster-spacing.test.js'
                    ]
                },
                {
                    name: 'PI Planning Time-Lapse',
                    status: 'COMPLETED',
                    description: '90-day PI planning evolution visualization',
                    features: [
                        'Full PI timeline (12 weeks)',
                        'Daily snapshots with sprint boundaries',
                        'Animated transitions',
                        'Playback controls (play, pause, speed)',
                        'Metrics tracking'
                    ],
                    files: [
                        'PI-PLANNING-TIME-LAPSE.html',
                        'ENHANCEMENT-TIME-LAPSE.md'
                    ]
                },
                {
                    name: '2-Day PI Planning Event',
                    status: 'COMPLETED',
                    description: 'Realistic 2-day PI planning event simulation',
                    features: [
                        'Hourly timeline for 2-day event',
                        'Feature assignment to teams',
                        'User story decomposition',
                        'Dependency linking at story and feature levels',
                        'Force physics simulation',
                        'Mouse interactions (drag, hover, zoom)'
                    ],
                    files: [
                        'PI-PLANNING-EVENT-TIMELAPSE.html'
                    ]
                }
            ],
            achievements: [
                'Delivered cluster spacing feature ahead of schedule',
                'Fixed coordinate bug (lines pointing to 0,0)',
                'Implemented realistic PI planning sequence',
                'Added force physics and interactions',
                'Created comprehensive E2E test suite (35 scenarios)',
                'Achieved <16ms frame time performance'
            ],
            challenges: [
                'Zustand state management infinite loop in React',
                'Initial misunderstanding of cluster spacing requirements',
                'Coordinate validation for invalid node references',
                'Balancing static positioning with force physics'
            ],
            metrics: {
                completedStoryPoints: 29,
                testCoverage: '85%',
                performanceFrameTime: '<16ms',
                totalNodesSupported: 100,
                dependencies: 30
            },
            nextSteps: [
                'Complete real-time synchronization (72% done)',
                'Fix dependency bug fixes (2 high priority)',
                'Implement mobile touch interface (blocked)',
                'Performance testing at scale (100+ users)'
            ]
        };
        
        // Create the context node
        const result = await session.run(
            `
            CREATE (c:Context {
                id: $id,
                name: $name,
                type: $type,
                description: $description,
                timestamp: datetime($timestamp),
                sprint: $sprint,
                team: $team,
                environment: $environment,
                technologies: $technologies,
                componentsJson: $componentsJson,
                achievementsJson: $achievementsJson,
                challengesJson: $challengesJson,
                metricsJson: $metricsJson,
                nextStepsJson: $nextStepsJson
            })
            RETURN c
            `,
            {
                id: contextData.id,
                name: contextData.name,
                type: contextData.type,
                description: contextData.description,
                timestamp: contextData.timestamp,
                sprint: contextData.metadata.sprint,
                team: contextData.metadata.team,
                environment: contextData.metadata.environment,
                technologies: contextData.metadata.technologies,
                componentsJson: JSON.stringify(contextData.components),
                achievementsJson: JSON.stringify(contextData.achievements),
                challengesJson: JSON.stringify(contextData.challenges),
                metricsJson: JSON.stringify(contextData.metrics),
                nextStepsJson: JSON.stringify(contextData.nextSteps)
            }
        );
        
        console.log('✅ PI Planning Visualization context saved successfully!');
        console.log(`   Context ID: ${contextData.id}`);
        
        // Create relationships to related contexts if they exist
        await session.run(
            `
            MATCH (newContext:Context {id: $newId})
            MATCH (sprintContext:Context)
            WHERE sprintContext.name CONTAINS 'Sprint 3' OR sprintContext.name CONTAINS 'Sprint 4'
            CREATE (newContext)-[:RELATED_TO]->(sprintContext)
            `,
            { newId: contextData.id }
        );
        
        // Link to technology nodes
        for (const tech of contextData.metadata.technologies) {
            await session.run(
                `
                MATCH (c:Context {id: $contextId})
                MERGE (t:Technology {name: $tech})
                CREATE (c)-[:USES_TECHNOLOGY]->(t)
                `,
                { contextId: contextData.id, tech }
            );
        }
        
        // Create feature nodes for major components
        for (const component of contextData.components) {
            await session.run(
                `
                MATCH (c:Context {id: $contextId})
                CREATE (f:Feature {
                    name: $name,
                    status: $status,
                    description: $description
                })
                CREATE (c)-[:HAS_FEATURE]->(f)
                `,
                {
                    contextId: contextData.id,
                    name: component.name,
                    status: component.status,
                    description: component.description
                }
            );
        }
        
        console.log('✅ Created relationships and feature nodes');
        
        // Query to verify
        const verification = await session.run(
            `
            MATCH (c:Context {id: $id})
            OPTIONAL MATCH (c)-[r]->(related)
            RETURN c, count(r) as relationships
            `,
            { id: contextData.id }
        );
        
        const record = verification.records[0];
        console.log(`✅ Verified: Context saved with ${record.get('relationships')} relationships`);
        
        // Also save as a JSON file for backup
        const backupPath = `./saved-contexts/pi-planning-viz-${Date.now()}.json`;
        fs.writeFileSync(backupPath, JSON.stringify(contextData, null, 2));
        console.log(`✅ Backup saved to: ${backupPath}`);
        
    } catch (error) {
        console.error('Error saving context:', error);
    } finally {
        await session.close();
        await driver.close();
    }
}

// Run the function
savePIPlanningContext().catch(console.error);