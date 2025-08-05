# Resource Allocation Affinity Scoring System

## Overview
Implemented a comprehensive affinity scoring system for the IBM Resource Allocation Table to suggest optimal resources for unallocated projects based on past experience, skills, and role fit.

## Implementation Date
2025-08-05

## Key Features

### 1. Product History Tracking
- Built `resourceProductHistory` Map to track each person's experience with different products
- Tracks:
  - Products worked on
  - Total months on each product
  - Projects completed per product
  - Last worked date per product
  - Allocation percentages

### 2. Skills System
- Added skills to all 14,397 resources based on their roles
- Role-based skill pools ensure realistic skill distributions
- Skills include technical (Java, Python, React, AWS) and soft skills (Leadership, Mentoring)
- Projects have required skills for better matching

### 3. Affinity Scoring Algorithm (0-100 points)
- **Product Experience (0-40 points)**:
  - Previous work on same product: 20 points base
  - Duration bonus: up to 10 points (1 point per month, max 10)
  - Recency bonus: up to 10 points (decreases over 12 months)
- **Skills Match (0-40 points)**:
  - Calculated as: (matched skills / required skills) × 40
  - Both technical and soft skills considered
- **Role Match (0-20 points)**:
  - Perfect role match: 20 points
  - Related roles: 10 points
  - Unrelated roles: 0 points

### 4. UI Integration
- Added Affinity column to main table between Team and Allocation %
- Color coding:
  - Green: High affinity (70-100)
  - Yellow/Orange: Medium affinity (40-69)
  - Gray: Low affinity (0-39)
- Sortable column with clear visual indicators
- Legend explaining the scoring system

### 5. Resource Suggestions Feature
- "View Suggestions" button on unallocated projects
- Shows top 10 resources sorted by affinity score
- Detailed breakdown of scoring components
- Quick allocation from suggestions modal

## Technical Implementation

### JavaScript Structure
```javascript
// Global data structures
window.resourceProductHistory = new Map(); // resourceId -> Map of product histories
window.projectAffinityScores = new Map(); // projectId -> Map of resourceId -> score

// Key functions
function buildProductHistory() {
    // Builds complete product history from all allocations
}

function calculateAffinityScore(resourceId, project) {
    // Returns 0-100 score based on experience, skills, and role
}

function calculateAllocationAffinityScores() {
    // Pre-calculates scores for all allocations for display
}
```

### Critical Bug Fix
**Issue**: JavaScript error "Identifier 'project' has already been declared"
**Cause**: Duplicate const declarations in createAllocation() function
**Solution**: Renamed second declaration to `projectForAffinity`
```javascript
// Line 3514
const project = allProjects.find(p => p.projectId === projectId);
// Line 3539 - Fixed by renaming
const projectForAffinity = allProjects.find(p => ...);
```

### Initialization Order
Critical: Must call functions in this order:
1. `generateDemoData()`
2. `buildProductHistory()` 
3. `calculateAllocationAffinityScores()`
4. `calculateResourceAllocations()`
5. `applyFilters()`

## Files Modified
- `/Users/corbyjames/cpmcp/apptio-target-process-mcp/ibm-resource-allocation-table.html`
  - Added skills system
  - Added product history tracking
  - Implemented affinity scoring
  - Added UI components for display and suggestions
  - Fixed JavaScript scoping error

## Testing Results
- Successfully displays affinity scores for all 6,652 allocations
- Color coding working correctly
- Sorting functionality operational
- Resource suggestions modal functioning
- Performance acceptable with large dataset

## Future Enhancements
1. Machine learning to improve scoring weights
2. Team collaboration factor in scoring
3. Certification/training considerations
4. Project complexity matching
5. Historical performance metrics integration