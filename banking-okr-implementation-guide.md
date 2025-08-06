# Banking OKR Implementation Guide

## Overview
This guide documents the hierarchical OKR structure implemented in TargetProcess for Q1 2025 banking digital transformation initiative.

## Entity Structure

### Correct Entity Types
- **Objective**: Used for all OKR objectives (executive and department levels)
- **KeyResult**: Used for measurable key results with tracking capabilities

### Initial Mistake (Corrected)
- Initially created PortfolioEpics but discovered dedicated Objective/KeyResult entities exist
- PortfolioEpics IDs: 4654, 4673, 4692, 4711 (can be deleted manually)

## Hierarchical Structure

```
COO (Executive Level)
└── Digital Banking Transformation (ID: 4730)
    ├── SVP of Data
    │   └── Data & Analytics Excellence (ID: 4739)
    │       ├── Real-time analytics platform (KR: 4742)
    │       ├── AI fraud detection 95% accuracy (KR: 4743)
    │       └── Personalized insights 80% coverage (KR: 4744)
    │
    ├── SVP of Engineering
    │   └── Digital Product Engineering Excellence (ID: 4740)
    │       ├── Mobile app 4.5+ rating (KR: 4745)
    │       └── Onboarding time 7 minutes (KR: 4746)
    │
    └── SVP of Infrastructure
        └── Infrastructure Modernization (ID: 4741)
            ├── 99.99% uptime (KR: 4747)
            └── <200ms API response (KR: 4748)
```

## API Implementation Details

### Creating Objectives

```javascript
// Executive Level Objective
POST /api/v1/Objectives
{
  "type": "Objective",
  "name": "Digital Banking Transformation",
  "description": "Accelerate digital banking adoption...",
  "project": {"id": 2909}
}

// Department Level Objective (with parent)
POST /api/v1/Objectives
{
  "type": "Objective",
  "name": "Data & Analytics Excellence for Digital Banking",
  "description": "Build advanced data capabilities...",
  "project": {"id": 2909},
  "additionalFields": {
    "Objective": {"Id": 4730}  // Parent objective
  }
}
```

### Creating Key Results

```javascript
POST /api/v1/KeyResults
{
  "type": "KeyResult",
  "name": "Increase digital transaction volume from 45% to 65%",
  "description": "...",
  "project": {"id": 2909},
  "additionalFields": {
    "Objective": {"Id": 4730},  // Parent objective
    "Start Value": 45,
    "Target Value": 65
  }
}
```

### Custom Fields Available

**Objective Custom Fields:**
- Portfolio Objective (checkbox)

**KeyResult Custom Fields:**
- Start Value (number) - Baseline metric
- Target Value (number) - Target to achieve
- Current Value (number) - System-managed, cannot be updated via API
- Weightage (number) - Optional weighting
- Result Type (text) - Optional categorization

## Key Learnings

1. **Entity Discovery**: TargetProcess has dedicated Objective and KeyResult entities for OKR management

2. **Parent-Child Relationships**: Use `additionalFields.Objective.Id` to link child objectives to parents

3. **Custom Field Updates**: Some fields like "Current Value" are system-managed and require special permissions or metric integrations

4. **API Authentication**: Basic auth works for creation but some operations require elevated permissions

## Rollup Logic

The hierarchical structure enables rollup reporting:

- **Digital Transaction Volume**: Aggregates from analytics platform usage and mobile app transactions
- **App Rating**: Direct from engineering's mobile app KR
- **Onboarding Time**: Direct from engineering's onboarding KR
- **AI Features**: Count from data team's fraud detection and personalized insights

## Next Steps for Full Implementation

1. **Custom Field Configuration**
   - Add OKR-specific custom fields in TargetProcess admin
   - Configure metric integrations for Current Value updates

2. **Dashboard Creation**
   - Executive dashboard showing COO objective progress
   - Department dashboards for each SVP
   - Cross-functional alignment view

3. **Progress Tracking**
   - Set up automated metric collection
   - Configure alerts for at-risk KRs
   - Weekly progress review workflows

4. **Team Assignment**
   - Assign specific teams to objectives
   - Define RACI matrix for each KR
   - Set up notification rules

## Usage in TargetProcess MCP

The context is available at:
- TypeScript: `/src/context/banking-okr-context.ts`
- JSON: `/persistent-context-store/banking-okr-api-calls.json`

Import and use:
```typescript
import { BANKING_OKR_CONTEXT, getAllObjectives } from './context/banking-okr-context';

// Get all objectives
const objectives = getAllObjectives(BANKING_OKR_CONTEXT);

// Get KRs for specific objective
const keyResults = getKeyResultsForObjective(BANKING_OKR_CONTEXT, 4730);
```