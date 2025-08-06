/**
 * Save Complete Resource Manager Context to Neo4j
 * Includes configuration, implementation details, and integration points
 */

import neo4j from 'neo4j-driver';
import fs from 'fs/promises';

async function saveCompleteResourceManagerContext() {
  console.log('💾 Saving complete Resource Manager context to Neo4j...');
  
  const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'neo4j123')
  );

  try {
    console.log('📡 Connecting to Neo4j...');
    await driver.verifyConnectivity();
    console.log('✅ Connected successfully!');

    const session = driver.session();
    
    // Create comprehensive implementation context
    const implementationContext = {
      title: "Resource Manager Work Matching Implementation",
      overview: "Complete implementation guide for Resource Manager work-to-team matching capabilities",
      configuration: {
        personalityFile: "/config/personalities/resource-manager.json",
        newOperations: [
          "build-team-work-profile",
          "analyze-team-product-history",
          "match-teams-to-work",
          "recommend-team-for-initiative",
          "analyze-work-requirements",
          "score-team-work-fit"
        ]
      },
      implementation: {
        workMatchingLogic: {
          description: "Core logic for matching teams to work",
          steps: [
            "1. Extract work requirements from initiative/epic/feature descriptions",
            "2. Query team history for similar product/project work",
            "3. Aggregate team member skills into team capability profile",
            "4. Calculate match scores based on weighted factors",
            "5. Generate recommendations with rationale"
          ],
          apiQueries: {
            teamHistory: `
              // Get team's historical work
              GET /api/v1/TeamIterations?where=(Team.Id eq {teamId})&include=[UserStory,Bug,Task,Feature,Epic]&take=1000
            `,
            teamSkills: `
              // Get team member skills
              GET /api/v1/TeamMembers?where=(Team.Id eq {teamId})&include=[User[Skills,CustomFields]]&take=100
            `,
            productHistory: `
              // Get team's work on specific product
              GET /api/v1/UserStories?where=(Team.Id eq {teamId} and Feature.Epic.Project.Name contains '{productName}')&include=[Feature,Epic,Project]&take=500
            `
          }
        },
        scoringAlgorithm: {
          description: "Weighted scoring algorithm for team-work fit",
          formula: "totalScore = (historicalPerformance * 0.35) + (skillsMatch * 0.30) + (availability * 0.20) + (teamDynamics * 0.15)",
          components: {
            historicalPerformance: {
              calculation: "Based on velocity, quality metrics, and on-time delivery rate",
              dataPoints: ["completed story points", "bug density", "cycle time", "delivery predictability"]
            },
            skillsMatch: {
              calculation: "Percentage of required skills covered by team members",
              dataPoints: ["technical skills coverage", "domain expertise", "tool proficiency", "certification alignment"]
            },
            availability: {
              calculation: "Team capacity minus current allocations",
              dataPoints: ["current allocation percentage", "planned time off", "upcoming commitments"]
            },
            teamDynamics: {
              calculation: "Team stability and collaboration effectiveness",
              dataPoints: ["team tenure", "attrition rate", "collaboration frequency", "cross-functional experience"]
            }
          }
        },
        integrationPoints: {
          withRTE: {
            description: "Integration with Release Train Engineer operations",
            touchpoints: [
              "PI Planning - Use work matching to assign teams to features",
              "Capacity Planning - Consider team allocations when matching",
              "Risk Management - Identify skill gaps early in planning"
            ]
          },
          withWorkAllocation: {
            description: "Integration with Work Allocation entity",
            process: [
              "After team selection, create WorkAllocation entity",
              "Link allocation to team recommendation rationale",
              "Track allocation effectiveness for future matching"
            ]
          }
        }
      },
      bestPractices: [
        "Always validate team availability before final assignment",
        "Consider team preferences and career development goals",
        "Document skill gaps and create development plans",
        "Track match effectiveness to improve algorithm over time",
        "Maintain team stability while optimizing for skills match"
      ],
      exampleWorkflow: {
        scenario: "Assigning team to new cloud migration initiative",
        steps: [
          {
            step: 1,
            operation: "analyze-work-requirements",
            input: "Initiative: 'Migrate Customer Portal to AWS'",
            output: "Required: AWS, Kubernetes, Java; Domain: Customer Systems"
          },
          {
            step: 2,
            operation: "build-team-work-profile",
            input: "All available teams",
            output: "10 team profiles with skills and history"
          },
          {
            step: 3,
            operation: "match-teams-to-work",
            input: "Initiative requirements + team profiles",
            output: "Top 5 teams ranked by fit score"
          },
          {
            step: 4,
            operation: "recommend-team-for-initiative",
            input: "Top teams + context",
            output: "Primary: Team Alpha (92%), Alt 1: Team Beta (85%), Alt 2: Team Gamma (78%)"
          }
        ]
      }
    };
    
    // Save comprehensive implementation context
    console.log('💾 Saving implementation context...');
    const implResult = await session.run(`
      CREATE (c:Context {
        id: $id,
        title: $title,
        content: $content,
        type: 'implementation',
        status: 'active',
        createdAt: datetime(),
        updatedAt: datetime(),
        userId: 'system',
        tags: $tags,
        metadata: $metadata
      })
      RETURN c.id as contextId
    `, {
      id: `resource-manager-implementation-${Date.now()}`,
      title: implementationContext.title,
      content: JSON.stringify(implementationContext, null, 2),
      tags: ['targetprocess', 'resource-manager', 'work-matching', 'implementation', 'mcp-server'],
      metadata: JSON.stringify({
        source: 'resource-manager-implementation',
        importance: 'critical',
        version: '2.0',
        type: 'implementation-guide',
        mcp_server_integration: true
      })
    });
    
    const implId = implResult.records[0].get('contextId');
    console.log(`✅ Implementation context saved with ID: ${implId}`);
    
    // Create API examples context
    const apiExamples = {
      title: "Resource Manager API Examples for Work Matching",
      examples: [
        {
          name: "Get Team Work History",
          description: "Retrieve all work items a team has completed",
          request: `
GET /api/v1/TeamIterations?where=(Team.Id eq 4297)&include=[UserStory[Feature[Epic[Project]]],Bug,Task]&take=1000
          `,
          usage: "Analyze historical performance and domain experience"
        },
        {
          name: "Get Team Member Skills",
          description: "Aggregate skills across all team members",
          request: `
GET /api/v1/TeamMembers?where=(Team.Id eq 4297)&include=[User[Skills,CustomFields]]
          `,
          usage: "Build team capability profile for skills matching"
        },
        {
          name: "Find Teams by Skill",
          description: "Find all teams with specific skill sets",
          request: `
GET /api/v1/Users?where=(Skills.Name contains 'AWS')&include=[TeamMembers[Team]]
          `,
          usage: "Identify teams with required technical skills"
        },
        {
          name: "Get Team Velocity Metrics",
          description: "Calculate team velocity over time",
          request: `
GET /api/v1/TeamIterations?where=(Team.Id eq 4297 and EndDate > DateTime.Today.AddDays(-180))&include=[Velocity,PlannedVelocity]
          `,
          usage: "Assess team performance and capacity"
        }
      ]
    };
    
    // Save API examples
    console.log('💾 Saving API examples...');
    const apiResult = await session.run(`
      CREATE (c:Context {
        id: $id,
        title: $title,
        content: $content,
        type: 'api-reference',
        status: 'active',
        createdAt: datetime(),
        updatedAt: datetime(),
        userId: 'system',
        tags: $tags,
        metadata: $metadata
      })
      RETURN c.id as contextId
    `, {
      id: `resource-manager-api-examples-${Date.now()}`,
      title: apiExamples.title,
      content: JSON.stringify(apiExamples, null, 2),
      tags: ['targetprocess', 'resource-manager', 'api', 'examples', 'work-matching'],
      metadata: JSON.stringify({
        source: 'resource-manager-api',
        importance: 'high',
        version: '1.0',
        type: 'api-reference'
      })
    });
    
    const apiId = apiResult.records[0].get('contextId');
    console.log(`✅ API examples saved with ID: ${apiId}`);
    
    // Link all Resource Manager contexts
    await session.run(`
      MATCH (impl:Context {id: $implId})
      MATCH (api:Context {id: $apiId})
      MATCH (config:Context)
      WHERE config.title CONTAINS 'Resource Manager Configuration'
      MATCH (guide:Context)
      WHERE guide.title CONTAINS 'Resource Manager Work Matching Guide'
      CREATE (impl)-[:IMPLEMENTS]->(config)
      CREATE (impl)-[:USES]->(api)
      CREATE (guide)-[:DESCRIBES]->(impl)
    `, {
      implId: implId,
      apiId: apiId
    });
    
    console.log('✅ Created relationships between all Resource Manager contexts');
    
    // Create a master context that references all components
    const masterContext = {
      title: "Resource Manager Work Matching - Master Reference",
      description: "Complete reference for Resource Manager work-to-team matching implementation in TargetProcess MCP Server",
      components: {
        configuration: "resource-manager.json in /config/personalities/",
        implementation: implId,
        apiReference: apiId,
        userGuide: "Resource Manager Work Matching Guide",
        integration: {
          rte: "Integrated with Release Train Engineer for PI Planning",
          workAllocation: "Creates WorkAllocation entities after team selection"
        }
      },
      status: "Ready for implementation in MCP server",
      version: "2.0"
    };
    
    const masterResult = await session.run(`
      CREATE (c:Context {
        id: $id,
        title: $title,
        content: $content,
        type: 'master-reference',
        status: 'active',
        createdAt: datetime(),
        updatedAt: datetime(),
        userId: 'system',
        tags: $tags,
        metadata: $metadata
      })
      RETURN c.id as contextId
    `, {
      id: `resource-manager-master-${Date.now()}`,
      title: masterContext.title,
      content: JSON.stringify(masterContext, null, 2),
      tags: ['targetprocess', 'resource-manager', 'master-reference', 'mcp-server', 'complete'],
      metadata: JSON.stringify({
        source: 'resource-manager-complete',
        importance: 'critical',
        version: '2.0',
        type: 'master-reference',
        ready_for_implementation: true
      })
    });
    
    const masterId = masterResult.records[0].get('contextId');
    console.log(`✅ Master reference saved with ID: ${masterId}`);
    
    await session.close();
    console.log('\n🎉 Complete Resource Manager context saved successfully!');
    console.log('\n📋 Summary:');
    console.log('- Configuration: Enhanced with work matching operations');
    console.log('- Implementation: Detailed logic and scoring algorithm');
    console.log('- API Examples: Ready-to-use TargetProcess API calls');
    console.log('- Integration: Linked with RTE and Work Allocation');
    console.log('- Status: Ready for MCP server implementation');

  } catch (error) {
    console.error('❌ Failed to save context:', error.message);
  } finally {
    await driver.close();
  }
}

saveCompleteResourceManagerContext();