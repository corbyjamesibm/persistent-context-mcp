# PI Planning Visualization - React Infinite Loop Fix

## Date: 2025-08-08

## Problem
The PI Planning visualization was experiencing React "Maximum update depth exceeded" warnings due to an infinite update loop between the ForceDirectedNetwork (main visualization) and Minimap components.

## Root Cause
Circular dependency in viewport updates:
1. ForceDirectedNetwork reports viewport change → triggers Minimap update
2. Minimap update → triggers viewport change in ForceDirectedNetwork
3. Loop continues indefinitely

## Solution Implemented

### 1. Update Source Tracking (App.tsx)
```typescript
// Added refs to track update sources
const isUpdatingFromMain = useRef(false);
const isUpdatingFromMinimap = useRef(false);
```

### 2. Guarded Update Handlers (App.tsx)
```typescript
const handleViewportChange = useCallback((newViewport) => {
  if (!isUpdatingFromMinimap.current) {
    const hasChanged = // check if values actually changed
    if (hasChanged) {
      isUpdatingFromMain.current = true;
      setViewport(newViewport);
      requestAnimationFrame(() => {
        isUpdatingFromMain.current = false;
      });
    }
  }
}, [viewport]);

const handleMinimapViewportChange = useCallback((newTransform) => {
  if (!isUpdatingFromMain.current) {
    const hasChanged = // check if values actually changed
    if (hasChanged) {
      isUpdatingFromMinimap.current = true;
      setTransform(newTransform);
      requestAnimationFrame(() => {
        isUpdatingFromMinimap.current = false;
      });
    }
  }
}, [transform]);
```

### 3. Debounced Updates (ForceDirectedNetwork.tsx)
```typescript
const viewportUpdateTimer = useRef<NodeJS.Timeout | null>(null);

// In zoom handler
if (viewportUpdateTimer.current) {
  clearTimeout(viewportUpdateTimer.current);
}
viewportUpdateTimer.current = setTimeout(() => {
  onViewportChange({
    x: event.transform.x,
    y: event.transform.y,
    width: dimensions.width,
    height: dimensions.height,
    scale: event.transform.k
  });
}, 50); // 50ms debounce
```

## Key Files Modified
- `/pi-planning-viz/src/App.tsx` - Added update source tracking and guarded handlers
- `/pi-planning-viz/src/components/visualization/ForceDirectedNetwork.tsx` - Added debouncing
- `/pi-planning-viz/src/components/navigation/Minimap.tsx` - Already had proper event handling

## Testing Results
✅ No more "Maximum update depth exceeded" warnings
✅ Minimap navigation works correctly
✅ Recenter button functions properly
✅ Cluster spacing control adjusts node positions
✅ All viewport synchronization working smoothly

## Lessons Learned
1. **Always guard bidirectional updates** between components to prevent loops
2. **Use refs for tracking update sources** instead of state (avoids re-renders)
3. **Debounce rapid updates** from user interactions like zoom/pan
4. **Check for actual value changes** before triggering state updates
5. **Use requestAnimationFrame** to reset flags after React's update cycle

## Related Issues
- Navigation panel z-index was reduced from 999 to 100 to prevent overlapping controls
- External transform updates required a delay to ensure zoom behavior initialization

## Performance Impact
- Reduced unnecessary re-renders
- Smoother user interactions
- Better responsiveness due to debouncing