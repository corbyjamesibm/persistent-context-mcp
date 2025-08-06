# TargetProcess TeamIteration Creation Findings

## Important Terminology Mappings
TargetProcess API uses different terminology than standard SAFe/Agile practices:
- **Portfolio** = `Project` (in API)
- **Program Increment (PI)** = `Release` (in API)
- **Sprint** = `TeamIteration` (in API)

## API Metadata Endpoint
- **URL**: https://apptiocsgfa.tpondemand.com/api/v1/Index/meta
- Provides metadata about all available entities and their fields

## TeamIteration Creation Requirements

### Required Fields
1. **Name** (string): Iteration name
2. **Team** (object with Id): Reference to the team
3. **StartDate** (string): Format YYYY-MM-DD
4. **EndDate** (string): Format YYYY-MM-DD  
5. **Release** (object with Id): Reference to the release/PI

### Critical Rules
- **Field Casing**: Must use PascalCase (e.g., `StartDate` not `startDate`)
- **DO NOT include** `Project` field - it's inherited from Team
- **DO NOT include** `AgileReleaseTrain` field
- **Release Constraint**: Release must be assigned to a Portfolio related to the Team

### Working Example
```json
{
  "Name": "PI1:TeamName:Sprint1",
  "Team": { "Id": 4297 },
  "StartDate": "2025-01-31",
  "EndDate": "2025-02-14",
  "Release": { "Id": 4538 }
}
```

## Common Errors

### Error: "Error during deserializing resource"
- **Cause**: Incorrect field names or payload structure
- **Fix**: Ensure PascalCase field names and correct JSON structure

### Error: "Planning Interval should be assigned to a Portfolio related to the Team of the Team Iteration"
- **Cause**: Mismatch between Team's Project and Release's Project
- **Fix**: Verify Release is associated with same Project as Team

## Investigation Findings (July 2025)

### Success Case
- Successfully created 6 TeamIterations for **Digital Delivery** (Team ID: 4297)
- All iterations linked to Release ID: 4538
- Sprint duration: 2 weeks each

### Failure Cases
Failed to create TeamIterations for:
1. **Mobile Development Squad** (Team ID: 4332)
2. **Digital Design Team** (Team ID: 4375)

### Key Observations
- All teams (4297, 4332, 4375) are associated with Project ID: 2909
- Release 4538 is also associated with Project ID: 2909
- Despite matching Project IDs, TargetProcess still rejects creation for some teams
- **Root cause**: Appears to be an internal TargetProcess constraint beyond Project association

### Recommended Workaround
When TeamIteration creation fails due to Portfolio constraints:
1. Check if team already has iterations from a different approach
2. Consider using the TargetProcess UI for complex team/release relationships
3. Document which teams have this limitation for future reference