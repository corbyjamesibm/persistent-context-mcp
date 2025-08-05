# IBM ATP (TargetProcess) Instance Information

## Critical Instance Selection Rule
**ALWAYS check the domain when working with ATP data!**

## IBM's ATP Instance
- **Domain**: `usibmsandbox.tpondemand.com`
- **Full URL**: https://usibmsandbox.tpondemand.com
- **Purpose**: IBM's sandbox/development TargetProcess instance
- **Scale**: Enterprise-level with 14,397+ users, 768+ projects, 6,652+ allocations

## Common Mistake
- **Wrong Instance**: `apptiocsgfa.tpondemand.com` (This is NOT IBM's instance)
- **Lesson Learned**: Always verify you're using the IBM instance (usibmsandbox) when fetching real IBM data

## Environment Variables
```bash
export TP_DOMAIN=usibmsandbox.tpondemand.com
export TP_USERNAME=<username>
export TP_PASSWORD=<password>
# OR
export TP_API_KEY=<api_key>
```

## Date Learned
2025-08-05

## Context
When asked to "use real data from ATP", always confirm which instance:
1. Check environment variables
2. Look for "usibmsandbox" for IBM data
3. If unsure, ask user to confirm the domain

This is especially important when creating reports, fetching allocations, or displaying "real ATP data" - using the wrong instance will show completely different data!