# IBM ATP API Success Patterns

## Successful Authentication Method
**Date**: January 2025
**Domain**: usibmsandbox.tpondemand.com
**Method**: API Key as URL parameter

### Working Pattern
```bash
# API key must be passed as URL parameter, NOT in Authorization header
curl "https://usibmsandbox.tpondemand.com/api/v1/{endpoint}?access_token={API_KEY}&format=json"
```

### API Key from .env
```
TP_API_KEY=MTY4Njg6bHJJcnZralU4dEM1YVRxc1diT2lTTmRRaURHRVV6N3Fuc1RMc2tLbkF5WT0=
```

## Successful API Endpoints

### 1. Projects
```bash
# Note: IsActive filter causes 400 error on IBM instance
curl "https://usibmsandbox.tpondemand.com/api/v1/Projects?take=1000&skip=0&format=json&access_token={API_KEY}"
```

### 2. Teams
```bash
curl "https://usibmsandbox.tpondemand.com/api/v1/Teams?take=1000&skip=0&include=[Project]&format=json&access_token={API_KEY}"
```
- Returns: 347 teams

### 3. Users (GeneralUsers)
```bash
curl "https://usibmsandbox.tpondemand.com/api/v1/GeneralUsers?take=1000&format=json&access_token={API_KEY}"
```
- Limited to first 1000 for performance

### 4. Portfolio Epics
```bash
curl "https://usibmsandbox.tpondemand.com/api/v1/Epics?take=1000&skip=0&include=[Project,CustomFields]&format=json&access_token={API_KEY}"
```
- Total: 3,244 epics (requires pagination)

### 5. Work Allocations (Critical for Resource Management)
```bash
curl "https://usibmsandbox.tpondemand.com/api/v1/WorkAllocations?take=1000&skip=0&include=[ConnectedTeam,PortfolioEpic,ConnectedUser,CustomFields]&format=json&access_token={API_KEY}"
```
- **CRITICAL**: Must paginate! Total: 29,471 allocations
- See pagination lesson in targetprocess-pagination-critical-lesson.md

## Key Data Points Retrieved
- **Work Allocations**: 29,471
- **Unique Allocated Users**: 9,179
- **Teams**: 347
- **Portfolio Epics**: 3,244
- **Initiatives**: 663

## Important Custom Fields in Work Allocations
- **Percentage**: Allocation percentage (Money type)
- **Status**: Allocation status (DropDown type) - values: "Requested", "Active", etc.
- **Total Allocated Hours**: Number type
- **Total Allocated Cost**: Money type
- **Service Type**: Text type (e.g., "Delivery")
- **Service Category**: Text type (e.g., "Security & Compliance")

## Node.js Implementation Pattern
```javascript
// Add API key to endpoint path, not headers
const finalEndpoint = endpoint + (endpoint.includes('?') ? '&' : '?') + `access_token=${ATP_API_KEY}`;

const options = {
    hostname: ATP_DOMAIN,
    path: `/api/v1/${finalEndpoint}`,
    method: 'GET',
    headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    // NO Authorization header needed with API key
};
```

## Common Errors to Avoid
1. **Don't use Basic Auth** - Returns "MixedAuthentication was unable to authenticate the user"
2. **Don't put API key in Authorization header** - Must be URL parameter
3. **Don't assume first 1000 items are all data** - Always implement pagination
4. **Don't use IsActive filter on Projects** - Returns 400 error on IBM instance