# Real-time Collaboration Guide

This guide covers the real-time collaboration features of the Persistent Context Store, including multi-user sessions, live editing, and conflict resolution.

## Overview

The collaboration system enables multiple users to work together on contexts in real-time, with features including:

- **Multi-user sessions** with role-based permissions
- **Real-time editing** with operational transformation
- **Live cursors and typing indicators**
- **Comments and annotations**
- **Presence awareness**
- **Conflict resolution strategies**

## Quick Start

### Creating a Collaborative Session

```typescript
import { CollaborationService } from './core/services/collaboration.service';

const collaborationService = new CollaborationService();

// Create a new session
const session = await collaborationService.createSession({
  name: 'AI Memory Research Session',
  ownerId: 'user123',
  settings: {
    maxParticipants: 10,
    allowGuests: false,
    autoSave: true,
    conflictResolution: 'operational-transform',
  },
});

console.log('Session created:', session.id);
```

### Joining a Session

```typescript
// Join an existing session
const result = await collaborationService.joinSession(
  session.id,
  'user456',
  'Dr. Jane Smith',
  'editor'
);

console.log('Joined as:', result.participant.role);
```

### Setting Up Real-time Connection

```javascript
// Client-side WebSocket connection
const ws = new WebSocket(`ws://localhost:3000/collaborate?sessionId=${sessionId}&userId=${userId}&token=${authToken}`);

ws.onmessage = (event) => {
  const collaborationEvent = JSON.parse(event.data);
  handleCollaborationEvent(collaborationEvent);
};

// Send cursor updates
ws.send(JSON.stringify({
  type: 'cursor-move',
  data: {
    cursor: {
      contextId: 'context123',
      position: 150,
      selection: { start: 100, end: 200 }
    }
  }
}));
```

## Core Concepts

### Sessions

A collaborative session is a workspace where multiple users can collaborate on contexts. Each session has:

- **Owner**: User who created the session with full permissions
- **Participants**: Users who have joined the session with specific roles
- **Settings**: Configuration for collaboration behavior

```typescript
interface CollaborativeSession {
  id: string;
  name: string;
  ownerId: string;
  participants: Participant[];
  isActive: boolean;
  settings: {
    maxParticipants: number;
    allowGuests: boolean;
    autoSave: boolean;
    conflictResolution: 'last-write-wins' | 'operational-transform' | 'manual';
  };
}
```

### Participants and Roles

Each participant has a role that determines their permissions:

- **Owner**: Full control over session and settings
- **Editor**: Can edit content and add comments
- **Viewer**: Can view content and add comments
- **Guest**: Read-only access (if allowed)

```typescript
interface Participant {
  id: string;
  userId: string;
  displayName: string;
  role: 'owner' | 'editor' | 'viewer' | 'guest';
  status: 'online' | 'away' | 'offline';
  permissions: {
    canEdit: boolean;
    canComment: boolean;
    canInvite: boolean;
    canManageSettings: boolean;
  };
}
```

### Real-time Events

The system uses WebSocket events for real-time communication:

```typescript
interface CollaborationEvent {
  id: string;
  sessionId: string;
  userId: string;
  type: 'context-update' | 'cursor-move' | 'participant-join' | 
        'participant-leave' | 'comment-add' | 'typing-start' | 'typing-stop';
  data: Record<string, unknown>;
  timestamp: Date;
}
```

## Features

### Live Editing with Conflict Resolution

The system supports three conflict resolution strategies:

#### Last Write Wins
Simple strategy where the most recent edit takes precedence:

```typescript
const session = await collaborationService.createSession({
  name: 'Simple Collaboration',
  ownerId: 'user1',
  settings: {
    conflictResolution: 'last-write-wins',
    // ... other settings
  },
});
```

#### Operational Transformation
Sophisticated algorithm that transforms concurrent operations:

```typescript
const session = await collaborationService.createSession({
  name: 'Advanced Collaboration',
  ownerId: 'user1',
  settings: {
    conflictResolution: 'operational-transform',
    // ... other settings
  },
});

// Edit operations are automatically transformed
await collaborationService.updateContext(sessionId, userId, contextId, {
  operation: 'insert',
  position: 100,
  content: 'New text',
});
```

#### Manual Resolution
Conflicts are flagged for manual resolution:

```typescript
const session = await collaborationService.createSession({
  name: 'Manual Review Collaboration',
  ownerId: 'user1',
  settings: {
    conflictResolution: 'manual',
    // ... other settings
  },
});
```

### Comments and Annotations

Add contextual comments to specific positions in content:

```typescript
// Add a comment
const comment = await collaborationService.addComment(
  sessionId,
  userId,
  contextId,
  'This section needs clarification',
  position: 250,
  mentions: ['user123', 'user456']
);

// Get comments for a context
const comments = collaborationService.getComments(contextId);

// Comment with thread support
interface Comment {
  id: string;
  contextId: string;
  userId: string;
  content: string;
  position: number;
  thread?: Comment[];
  resolved: boolean;
  mentions: string[];
  reactions: Array<{
    userId: string;
    type: string;
    timestamp: Date;
  }>;
}
```

### Presence Awareness

Track participant presence and activity:

```typescript
// Update cursor position
collaborationService.updateCursor(sessionId, userId, {
  contextId: 'context123',
  position: 150,
  selection: { start: 100, end: 200 }
});

// Track typing indicators
collaborationService.updateTypingIndicator(sessionId, userId, contextId, true);

// Get typing indicators
const typingUsers = collaborationService.getTypingIndicators(contextId);
```

### Live Cursors

See where other participants are working in real-time:

```typescript
// Cursor position updates are broadcast automatically
interface Cursor {
  contextId?: string;
  position?: number;
  selection?: {
    start: number;
    end: number;
  };
}
```

## API Reference

### REST Endpoints

#### Sessions

```http
POST /api/collaboration/sessions
GET /api/collaboration/sessions/:sessionId
POST /api/collaboration/sessions/:sessionId/join
POST /api/collaboration/sessions/:sessionId/leave
GET /api/collaboration/sessions
```

#### Content Collaboration

```http
POST /api/collaboration/sessions/:sessionId/contexts/update
POST /api/collaboration/sessions/:sessionId/comments
GET /api/collaboration/contexts/:contextId/comments
POST /api/collaboration/sessions/:sessionId/cursor
GET /api/collaboration/contexts/:contextId/typing
```

### WebSocket Events

#### Client to Server

```typescript
// Cursor movement
{
  type: 'cursor-move',
  data: {
    cursor: {
      contextId: 'context123',
      position: 150
    }
  }
}

// Typing indicators
{
  type: 'typing-start',
  data: {
    contextId: 'context123'
  }
}

{
  type: 'typing-stop',
  data: {
    contextId: 'context123'
  }
}

// Presence updates
{
  type: 'presence-update',
  data: {
    status: 'away'
  }
}
```

#### Server to Client

```typescript
// Participant events
{
  type: 'participant-join',
  data: {
    participant: ParticipantObject
  }
}

{
  type: 'participant-leave',
  data: {
    participant: ParticipantObject
  }
}

// Content updates
{
  type: 'context-update',
  data: {
    edit: ContextEditObject
  }
}

// Comments
{
  type: 'comment-add',
  data: {
    comment: CommentObject
  }
}
```

## Advanced Usage

### Custom Operational Transformation

Implement custom transformation logic for specific content types:

```typescript
class CustomCollaborationService extends CollaborationService {
  protected async transformEdit(edit: ContextEdit, concurrentEdit: ContextEdit): void {
    // Custom transformation logic
    if (edit.operation === 'format' && concurrentEdit.operation === 'insert') {
      // Handle formatting vs content insertion conflicts
      this.handleFormatInsertConflict(edit, concurrentEdit);
    }
    
    return super.transformEdit(edit, concurrentEdit);
  }
}
```

### Session Analytics

Track collaboration metrics:

```typescript
class AnalyticsCollaborationService extends CollaborationService {
  constructor(private analytics: AnalyticsService) {
    super();
    
    this.on('participant-joined', (event) => {
      this.analytics.track('collaboration.participant.joined', {
        sessionId: event.session.id,
        participantCount: event.session.participants.length,
      });
    });
    
    this.on('context-updated', (event) => {
      this.analytics.track('collaboration.context.updated', {
        sessionId: event.sessionId,
        operationType: event.operation,
      });
    });
  }
}
```

### Permission Customization

Implement custom permission logic:

```typescript
class CustomPermissionService extends CollaborationService {
  protected getDefaultPermissions(role: Participant['role']): Participant['permissions'] {
    const basePermissions = super.getDefaultPermissions(role);
    
    // Add custom logic
    if (role === 'editor') {
      return {
        ...basePermissions,
        canCreateContexts: true,
        canDeleteContexts: false,
      };
    }
    
    return basePermissions;
  }
}
```

## Best Practices

### Performance Optimization

1. **Batch Operations**: Group multiple operations when possible
2. **Throttle Updates**: Limit the frequency of cursor and typing updates
3. **Efficient Broadcasting**: Only send updates to relevant participants

```typescript
// Throttled cursor updates
const throttledCursorUpdate = throttle((cursor) => {
  collaborationService.updateCursor(sessionId, userId, cursor);
}, 100);
```

### Security Considerations

1. **Validate Input**: Always validate collaboration events and data
2. **Rate Limiting**: Implement rate limits for API endpoints
3. **Permission Checks**: Verify permissions before processing operations

```typescript
// Input validation
const UpdateContextSchema = z.object({
  contextId: z.string().uuid(),
  operation: z.enum(['insert', 'delete', 'replace', 'move']),
  position: z.number().min(0),
  content: z.string().max(10000).optional(),
});
```

### Error Handling

1. **Graceful Degradation**: Handle WebSocket disconnections gracefully
2. **Conflict Resolution**: Provide clear feedback on resolution strategies
3. **Recovery Mechanisms**: Implement session recovery for network issues

```typescript
// WebSocket reconnection
class ReconnectingWebSocket {
  constructor(private url: string) {
    this.connect();
  }
  
  private connect() {
    this.ws = new WebSocket(this.url);
    
    this.ws.onclose = () => {
      setTimeout(() => this.connect(), 1000);
    };
  }
}
```

## Troubleshooting

### Common Issues

#### WebSocket Connection Failures
- Verify authentication tokens
- Check network connectivity
- Ensure WebSocket server is running

#### Synchronization Issues
- Confirm operational transformation is enabled
- Check for network latency issues
- Verify all participants are using the same session

#### Permission Errors
- Validate user roles and permissions
- Check session settings
- Ensure users have joined the session properly

### Debug Information

Enable debug logging to troubleshoot issues:

```typescript
// Enable collaboration debug logging
const logger = winston.createLogger({
  level: 'debug',
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'collaboration.log' })
  ]
});
```

### Performance Monitoring

Monitor collaboration performance:

```typescript
// Track collaboration metrics
const metrics = {
  activeSessionsCount: () => collaborationService.getActiveSessions().length,
  totalParticipants: () => collaborationService.getTotalParticipants(),
  averageLatency: () => collaborationService.getAverageLatency(),
};
```

## Migration and Scaling

### Horizontal Scaling

For high-traffic deployments, consider:

1. **Session Sharding**: Distribute sessions across multiple instances
2. **Redis Clustering**: Use Redis for session state synchronization
3. **Load Balancing**: Implement sticky sessions for WebSocket connections

### Database Considerations

- Use optimized indexes for session and participant queries
- Consider read replicas for analytics queries
- Implement proper backup strategies for collaboration data

## Support

For additional help with collaboration features:

- Check the API documentation
- Review the integration tests for examples
- Monitor application logs for error details
- Contact the development team for advanced configuration