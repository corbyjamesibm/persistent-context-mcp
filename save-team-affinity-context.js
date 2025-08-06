/**
 * Save Team Affinity Analysis to Neo4j Persistent Context
 */

import neo4j from 'neo4j-driver';
import fs from 'fs/promises';

async function saveTeamAffinityContext() {
  console.log('💾 Saving Team Affinity Analysis to Neo4j...');
  
  const driver = neo4j.driver(
    'bolt://localhost:7687',
    neo4j.auth.basic('neo4j', 'neo4j123')
  );

  try {
    console.log('📡 Connecting to Neo4j...');
    await driver.verifyConnectivity();
    console.log('✅ Connected successfully!');

    const session = driver.session();
    
    // Create comprehensive team affinity context
    const teamAffinityContext = {
      title: "Portfolio A Team-Work Affinity Analysis",
      overview: "Comprehensive analysis of team capabilities and work matching for Portfolio A initiatives",
      methodology: {
        lookbackPeriod: "4 years of historical data",
        scoringWeights: {
          previousProductExperience: 0.25,
          domainExpertise: 0.20,
          teamStability: 0.15,
          collaborationEffectiveness: 0.15,
          deliveryTrackRecord: 0.10,
          skillsCoverage: 0.10,
          capacityAvailable: 0.05
        },
        humanTeamFactors: [
          "Direct experience with same product/portfolio epic",
          "Experience in similar domain areas",
          "Low turnover and consistent membership",
          "How well team works together",
          "On-time delivery history",
          "Technical skills match",
          "Current availability"
        ]
      },
      portfolioAAnalysis: {
        teams: [
          { id: 47, name: 'Team Alpha', size: 8, currentAllocation: 0.30 },
          { id: 48, name: 'Team Beta', size: 10, currentAllocation: 0.50 },
          { id: 4434, name: 'Team Gamma', size: 12, currentAllocation: 0.45 },
          { id: 4433, name: 'Team Delta', size: 9, currentAllocation: 0.60 },
          { id: 50, name: 'Team Epsilon', size: 11, currentAllocation: 0.25 },
          { id: 4435, name: 'Team Zeta', size: 7, currentAllocation: 0.40 },
          { id: 4436, name: 'Team Eta', size: 6, currentAllocation: 0.30 },
          { id: 4439, name: 'Team Theta', size: 5, currentAllocation: 0.20 }
        ],
        portfolioEpics: [
          { id: 4034, name: 'Cloud Migration', requiredSkills: ['AWS', 'Kubernetes', 'DevOps'] },
          { id: 43, name: 'Migration to Workday', requiredSkills: ['Enterprise Systems', 'Integration', 'Data Migration'] },
          { id: 44, name: 'test again', requiredSkills: [] }
        ],
        affinityResults: {
          cloudMigration: {
            topRecommendations: [
              { team: 'Team Alpha', score: 51, recommendation: 'POSSIBLE' },
              { team: 'Team Beta', score: 51, recommendation: 'POSSIBLE' },
              { team: 'Team Gamma', score: 23, recommendation: 'NOT_RECOMMENDED' }
            ],
            insights: [
              "Teams Alpha and Beta have slight product experience advantage",
              "Most teams have high capacity availability (>50%)",
              "Limited historical data due to recent portfolio formation"
            ]
          }
        }
      },
      futureAgentConsiderations: {
        contextRelevance: "How much relevant context does the agent have for this work domain",
        knowledgeRecency: "How recent is the agent's knowledge of the codebase/product",
        specializationMatch: "How well does agent specialization match work requirements",
        integrationCapability: "How well can agent integrate with existing systems"
      },
      dataModel: {
        hierarchy: "UserStory → Feature → Epic → PortfolioEpic",
        productAssociation: "Products are entities associated with initiatives",
        teamWork: "Teams work on UserStories which roll up to PortfolioEpics"
      },
      recommendations: [
        "Implement systematic tracking of full work hierarchy",
        "Collect granular team performance metrics",
        "Survey teams for domain/technology preferences",
        "Build historical database of team-product associations",
        "Track affinity-based assignment success rates"
      ]
    };
    
    // Save team affinity analysis
    console.log('💾 Saving team affinity analysis...');
    const analysisResult = await session.run(`
      CREATE (c:Context {
        id: $id,
        title: $title,
        content: $content,
        type: 'analysis',
        status: 'active',
        createdAt: datetime(),
        updatedAt: datetime(),
        userId: 'system',
        tags: $tags,
        metadata: $metadata
      })
      RETURN c.id as contextId
    `, {
      id: `team-affinity-analysis-${Date.now()}`,
      title: teamAffinityContext.title,
      content: JSON.stringify(teamAffinityContext, null, 2),
      tags: ['targetprocess', 'team-affinity', 'portfolio-a', 'work-matching', 'resource-allocation'],
      metadata: JSON.stringify({
        source: 'team-affinity-analysis',
        importance: 'high',
        version: '1.0',
        analysisType: 'team-work-matching',
        portfolioId: 2909
      })
    });
    
    const analysisId = analysisResult.records[0].get('contextId');
    console.log(`✅ Team affinity analysis saved with ID: ${analysisId}`);
    
    // Create implementation guide
    const implementationGuide = {
      title: "Team Affinity Implementation Guide",
      steps: [
        {
          phase: "Data Collection",
          actions: [
            "Query 4 years of UserStory data with full hierarchy",
            "Extract team assignments from UserStories",
            "Map UserStories to Features to Epics to PortfolioEpics",
            "Identify Product associations with PortfolioEpics"
          ]
        },
        {
          phase: "Affinity Calculation",
          actions: [
            "Count team touches on each PortfolioEpic",
            "Calculate domain expertise from similar work",
            "Assess team stability from member tenure",
            "Evaluate delivery performance metrics"
          ]
        },
        {
          phase: "Scoring & Recommendation",
          actions: [
            "Apply weighted scoring algorithm",
            "Generate top 3 team recommendations",
            "Provide rationale for each recommendation",
            "Identify skill gaps and risks"
          ]
        }
      ],
      apiQueries: {
        teamWorkHistory: `
// Get all UserStories for a team with full hierarchy
GET /api/v1/UserStories?where=(Team.Id eq {teamId})&include=[Feature[Epic[PortfolioEpic[Product]]]]&take=1000
        `,
        portfolioEpicWork: `
// Get all work under a PortfolioEpic
GET /api/v1/PortfolioEpics/{id}?include=[Epics[Features[UserStories[Team]]]]
        `,
        productAssociations: `
// Get Products associated with PortfolioEpics
GET /api/v1/Products?include=[PortfolioEpics]&where=(PortfolioEpics.Any(Project.Id eq 2909))
        `
      }
    };
    
    // Save implementation guide
    console.log('💾 Saving implementation guide...');
    const guideResult = await session.run(`
      CREATE (c:Context {
        id: $id,
        title: $title,
        content: $content,
        type: 'guide',
        status: 'active',
        createdAt: datetime(),
        updatedAt: datetime(),
        userId: 'system',
        tags: $tags,
        metadata: $metadata
      })
      RETURN c.id as contextId
    `, {
      id: `team-affinity-guide-${Date.now()}`,
      title: implementationGuide.title,
      content: JSON.stringify(implementationGuide, null, 2),
      tags: ['targetprocess', 'team-affinity', 'implementation', 'guide', 'api-examples'],
      metadata: JSON.stringify({
        source: 'team-affinity-implementation',
        importance: 'high',
        version: '1.0',
        guideType: 'technical-implementation'
      })
    });
    
    const guideId = guideResult.records[0].get('contextId');
    console.log(`✅ Implementation guide saved with ID: ${guideId}`);
    
    // Link contexts
    await session.run(`
      MATCH (analysis:Context {id: $analysisId})
      MATCH (guide:Context {id: $guideId})
      MATCH (rm:Context)
      WHERE rm.title CONTAINS 'Resource Manager'
      CREATE (analysis)-[:IMPLEMENTS]->(rm)
      CREATE (analysis)-[:DOCUMENTED_BY]->(guide)
    `, {
      analysisId: analysisId,
      guideId: guideId
    });
    
    console.log('✅ Created relationships between contexts');
    
    // Save the HTML report reference
    const reportContext = {
      title: "Portfolio A Team Affinity Report",
      description: "Visual HTML report showing team-work affinity analysis",
      location: "/reports/portfolio_a_team_affinity_analysis.html",
      highlights: [
        "8 teams analyzed for 3 Portfolio Epics",
        "Team Alpha & Beta scored 51% for Cloud Migration",
        "Most teams have >50% capacity available",
        "Includes future AI agent considerations"
      ]
    };
    
    const reportResult = await session.run(`
      CREATE (c:Context {
        id: $id,
        title: $title,
        content: $content,
        type: 'report',
        status: 'active',
        createdAt: datetime(),
        updatedAt: datetime(),
        userId: 'system',
        tags: $tags,
        metadata: $metadata
      })
      RETURN c.id as contextId
    `, {
      id: `team-affinity-report-${Date.now()}`,
      title: reportContext.title,
      content: JSON.stringify(reportContext, null, 2),
      tags: ['targetprocess', 'team-affinity', 'report', 'portfolio-a', 'visualization'],
      metadata: JSON.stringify({
        source: 'team-affinity-report',
        importance: 'medium',
        version: '1.0',
        reportType: 'html-visualization',
        reportPath: reportContext.location
      })
    });
    
    const reportId = reportResult.records[0].get('contextId');
    console.log(`✅ Report reference saved with ID: ${reportId}`);
    
    await session.close();
    console.log('\n🎉 Team affinity analysis saved successfully!');
    console.log('\n📋 Summary:');
    console.log('- Analysis: Comprehensive team-work affinity methodology and results');
    console.log('- Implementation: Step-by-step guide with API examples');
    console.log('- Report: HTML visualization of affinity scores');
    console.log('- Integration: Linked to Resource Manager context');

  } catch (error) {
    console.error('❌ Failed to save context:', error.message);
  } finally {
    await driver.close();
  }
}

saveTeamAffinityContext();