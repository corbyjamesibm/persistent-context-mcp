# Persistent Context Store - API Reference

## 🌐 API Overview

Base URL: `http://localhost:3000/api/v1`

All API responses follow a consistent structure:
```json
{
  "success": true,
  "data": {...},
  "message": "Operation completed successfully",
  "timestamp": "2025-01-28T10:00:00Z"
}
```

Error responses:
```json
{
  "success": false,
  "error": "Error type",
  "message": "Detailed error message",
  "timestamp": "2025-01-28T10:00:00Z"
}
```

## 🔐 Authentication

### API Key Authentication
```http
Authorization: Bearer llm_your_api_key_here
Content-Type: application/json
```

### Default API Keys
- **Claude Assistant**: `llm_claude_default_key` (full permissions)
- **General LLM**: `llm_general_default_key` (read-only)

### Permissions
- `read`: Get contexts and memories
- `write`: Create and update contexts/memories
- `search`: Perform advanced searches
- `manage_sessions`: Create and manage LLM sessions

## 📝 Context Management API

### Create Context
```http
POST /api/v1/contexts
```

**Request Body:**
```json
{
  "title": "My Important Context",
  "content": "Detailed context information...",
  "type": "planning",
  "tags": ["project", "urgent"],
  "sessionId": "session_123",
  "metadata": {
    "importance": "high",
    "source": "user",
    "aiGenerated": false
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ctx_abc123",
    "title": "My Important Context",
    "content": "Detailed context information...",
    "type": "planning",
    "status": "active",
    "createdAt": "2025-01-28T10:00:00Z",
    "updatedAt": "2025-01-28T10:00:00Z",
    "userId": "user_123",
    "sessionId": "session_123",
    "tags": ["project", "urgent"],
    "metadata": {
      "importance": "high",
      "source": "user",
      "aiGenerated": false,
      "tokenCount": 156
    },
    "relationships": []
  }
}
```

### Get Context
```http
GET /api/v1/contexts/{id}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ctx_abc123",
    "title": "My Important Context",
    "content": "Detailed context information...",
    "type": "planning",
    "status": "active",
    "createdAt": "2025-01-28T10:00:00Z",
    "updatedAt": "2025-01-28T10:00:00Z",
    "userId": "user_123",
    "sessionId": "session_123",
    "tags": ["project", "urgent"],
    "metadata": {
      "importance": "high",
      "source": "user",
      "aiGenerated": false,
      "tokenCount": 156,
      "interactions": 5,
      "lastAccessed": "2025-01-28T12:00:00Z"
    },
    "relationships": [
      {
        "id": "rel_123",
        "type": "relates_to",
        "targetContextId": "ctx_def456",
        "strength": 0.8
      }
    ]
  }
}
```

### Update Context
```http
PUT /api/v1/contexts/{id}
```

**Request Body:**
```json
{
  "title": "Updated Context Title",
  "content": "Updated content...",
  "tags": ["project", "urgent", "updated"],
  "metadata": {
    "importance": "critical"
  }
}
```

### Search Contexts
```http
GET /api/v1/contexts?q=search+term&type=planning&limit=20&offset=0
```

**Query Parameters:**
- `q`: Search query
- `type`: Context type filter
- `tags`: Comma-separated tags
- `status`: Context status filter
- `sessionId`: Filter by session
- `limit`: Results limit (default: 50)
- `offset`: Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ctx_abc123",
      "title": "Matching Context",
      "content": "Content snippet...",
      "type": "planning",
      "relevanceScore": 0.95,
      "highlights": {
        "content": ["search <em>term</em> found here"]
      }
    }
  ],
  "totalCount": 150,
  "executionTime": 45
}
```

## 🧠 LLM Memory API

### Store LLM Memories
```http
POST /api/v1/llm/memories
```

**Request Body:**
```json
{
  "sessionId": "conversation_123",
  "conversationId": "conv_456",
  "userId": "user_789",
  "memories": {
    "shortTerm": [
      {
        "id": "st_1",
        "type": "fact",
        "content": "User prefers concise explanations",
        "importance": "medium",
        "tags": ["preference", "communication"],
        "timestamp": "2025-01-28T10:00:00Z",
        "source": "user",
        "confidence": 0.9,
        "metadata": {
          "conversationTurn": 5,
          "context": "user feedback"
        }
      }
    ],
    "longTerm": [
      {
        "id": "lt_1",
        "type": "preference",
        "content": "User is a Python developer working on ML projects",
        "importance": "high",
        "tags": ["profession", "python", "machine-learning"],
        "timestamp": "2025-01-28T10:00:00Z",
        "source": "llm",
        "confidence": 0.95
      }
    ],
    "episodic": [
      {
        "id": "ep_1",
        "type": "context",
        "content": "Helped debug a pandas DataFrame issue with memory optimization",
        "importance": "medium",
        "tags": ["debugging", "pandas", "optimization"],
        "timestamp": "2025-01-28T10:00:00Z",
        "source": "llm",
        "confidence": 0.8
      }
    ]
  },
  "context": {
    "currentTask": "Code review and optimization",
    "userPreferences": {
      "codeStyle": "pythonic",
      "explanationLevel": "intermediate"
    },
    "conversationSummary": "User is working on ML pipeline optimization"
  }
}
```

**Response:**
```json
{
  "success": true,
  "message": "Memories stored successfully",
  "results": {
    "shortTerm": [
      {"memoryId": "st_1", "contextId": "ctx_abc123"}
    ],
    "longTerm": [
      {"memoryId": "lt_1", "contextId": "ctx_def456"}
    ],
    "episodic": [
      {"memoryId": "ep_1", "contextId": "ctx_ghi789"}
    ],
    "contextId": "ctx_context_123"
  },
  "storedAt": "2025-01-28T10:00:00Z"
}
```

### Retrieve LLM Memories
```http
GET /api/v1/llm/memories
```

**Query Parameters:**
- `sessionId`: Filter by session
- `conversationId`: Filter by conversation
- `userId`: Filter by user
- `types`: Memory types (comma-separated): `fact,preference,context,instruction,example`
- `tags`: Filter by tags (comma-separated)
- `importance`: Filter by importance: `low,medium,high,critical`
- `limit`: Max results (default: 50)
- `offset`: Pagination offset (default: 0)
- `sortBy`: Sort order: `timestamp,importance,relevance`
- `q`: Search query

**Example:**
```http
GET /api/v1/llm/memories?sessionId=conversation_123&types=preference,fact&limit=20&q=python
```

**Response:**
```json
{
  "success": true,
  "query": {
    "sessionId": "conversation_123",
    "types": ["preference", "fact"],
    "limit": 20,
    "searchQuery": "python"
  },
  "totalCount": 15,
  "executionTime": 45,
  "memories": {
    "shortTerm": [
      {
        "id": "ctx_abc123",
        "type": "fact",
        "content": "User prefers Python 3.9+ features",
        "importance": "medium",
        "tags": ["python", "preference"],
        "timestamp": "2025-01-28T10:00:00Z",
        "source": "user",
        "confidence": 0.9,
        "relevanceScore": 0.95,
        "metadata": {
          "contextId": "ctx_abc123",
          "sessionId": "conversation_123"
        }
      }
    ],
    "longTerm": [
      {
        "id": "ctx_def456",
        "type": "preference",
        "content": "User is experienced with pandas and numpy",
        "importance": "high",
        "tags": ["python", "pandas", "numpy"],
        "timestamp": "2025-01-28T09:00:00Z",
        "source": "llm",
        "confidence": 0.95,
        "relevanceScore": 0.88
      }
    ],
    "episodic": [],
    "context": []
  },
  "retrievedAt": "2025-01-28T10:00:00Z"
}
```

### Advanced Memory Search
```http
POST /api/v1/llm/memories/search
```

**Request Body:**
```json
{
  "query": "python machine learning optimization",
  "filters": {
    "types": ["preference", "fact", "context"],
    "importance": ["high", "critical"],
    "tags": ["python", "ml"],
    "sessionId": "conversation_123",
    "timeRange": {
      "start": "2025-01-20T00:00:00Z",
      "end": "2025-01-28T23:59:59Z"
    }
  },
  "limit": 10,
  "offset": 0,
  "fuzzyMatch": true,
  "highlightMatches": true,
  "semanticSearch": true,
  "sortBy": "relevance"
}
```

**Response:**
```json
{
  "success": true,
  "searchQuery": "python machine learning optimization",
  "totalCount": 25,
  "executionTime": 120,
  "results": [
    {
      "context": {
        "id": "ctx_abc123",
        "content": "User is optimizing machine learning pipelines using Python",
        "type": "knowledge",
        "tags": ["python", "ml", "optimization"]
      },
      "score": 0.95,
      "matchedFields": ["content", "tags"],
      "highlights": {
        "content": ["<em>Python</em> <em>machine learning</em> <em>optimization</em>"]
      },
      "memoryMetadata": {
        "memoryType": "long-term",
        "confidence": 0.9,
        "importance": "high",
        "source": "llm-memory-llm"
      },
      "llmRelevance": {
        "score": 0.95,
        "matchedFields": ["content", "tags"],
        "highlights": {
          "content": ["<em>Python</em> <em>machine learning</em> <em>optimization</em>"]
        }
      }
    }
  ],
  "facets": {
    "importance": {
      "high": 15,
      "critical": 8,
      "medium": 2
    },
    "memoryType": {
      "long-term": 20,
      "short-term": 3,
      "episodic": 2
    }
  },
  "suggestions": [
    "python optimization",
    "machine learning pipeline",
    "ml performance"
  ],
  "searchedAt": "2025-01-28T10:00:00Z"
}
```

### Update LLM Memory
```http
PUT /api/v1/llm/memories/{id}
```

**Request Body:**
```json
{
  "content": "Updated memory content",
  "tags": ["updated", "python", "preference"],
  "metadata": {
    "importance": "high",
    "lastModified": "2025-01-28T10:00:00Z"
  }
}
```

### Delete LLM Memory
```http
DELETE /api/v1/llm/memories/{id}
```

**Response:**
```json
{
  "success": true,
  "message": "Memory deleted successfully",
  "deletedId": "ctx_abc123",
  "deletedAt": "2025-01-28T10:00:00Z"
}
```

## 💬 LLM Session Management API

### Create/Resume LLM Session
```http
POST /api/v1/llm/sessions
```

**Request Body:**
```json
{
  "sessionId": "conversation_123",
  "conversationId": "conv_456",
  "userId": "user_789",
  "title": "Python ML Pipeline Discussion",
  "userPreferences": {
    "codeStyle": "pythonic",
    "explanationLevel": "intermediate",
    "preferredLanguages": ["python", "sql"]
  },
  "settings": {
    "memoryRetention": "permanent",
    "maxMemories": 1000,
    "autoSummary": true,
    "contextWindow": 50
  }
}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "sessionId": "conversation_123",
    "conversationId": "conv_456",
    "userId": "user_789",
    "clientId": "claude-default",
    "startTime": "2025-01-28T10:00:00Z",
    "lastActivity": "2025-01-28T10:00:00Z",
    "status": "active",
    "metadata": {
      "conversationTitle": "Python ML Pipeline Discussion",
      "userPreferences": {
        "codeStyle": "pythonic",
        "explanationLevel": "intermediate"
      },
      "memoryCount": 0,
      "totalMessages": 0
    },
    "settings": {
      "memoryRetention": "permanent",
      "maxMemories": 1000,
      "autoSummary": true,
      "contextWindow": 50
    }
  },
  "message": "Session created",
  "createdAt": "2025-01-28T10:00:00Z"
}
```

### Get LLM Session
```http
GET /api/v1/llm/sessions/{sessionId}
```

**Response:**
```json
{
  "success": true,
  "session": {
    "sessionId": "conversation_123",
    "conversationId": "conv_456",
    "userId": "user_789",
    "clientId": "claude-default",
    "startTime": "2025-01-28T10:00:00Z",
    "lastActivity": "2025-01-28T12:00:00Z",
    "status": "active",
    "metadata": {
      "conversationTitle": "Python ML Pipeline Discussion",
      "userPreferences": {
        "codeStyle": "pythonic",
        "explanationLevel": "intermediate"
      },
      "memoryCount": 25,
      "totalMessages": 50,
      "averageResponseTime": 1200
    },
    "settings": {
      "memoryRetention": "permanent",
      "maxMemories": 1000,
      "autoSummary": true,
      "contextWindow": 50
    }
  },
  "statistics": {
    "totalContexts": 25,
    "memoryTypes": {
      "short-term": 10,
      "long-term": 8,
      "episodic": 5,
      "context": 2
    },
    "recentActivity": [
      {
        "id": "ctx_latest",
        "title": "Recent Memory",
        "type": "memory",
        "createdAt": "2025-01-28T12:00:00Z",
        "memoryType": "short-term"
      }
    ]
  },
  "retrievedAt": "2025-01-28T12:30:00Z"
}
```

### Update LLM Session
```http
PUT /api/v1/llm/sessions/{sessionId}
```

**Request Body:**
```json
{
  "status": "paused",
  "metadata": {
    "pauseReason": "User away",
    "totalMessages": 55
  },
  "settings": {
    "autoSummary": false
  }
}
```

### End LLM Session
```http
DELETE /api/v1/llm/sessions/{sessionId}
```

**Request Body (Optional):**
```json
{
  "generateSummary": true
}
```

**Response:**
```json
{
  "success": true,
  "message": "Session ended successfully",
  "summary": {
    "sessionId": "conversation_123",
    "duration": 7200000,
    "totalMemories": 25,
    "memoryTypes": {
      "short-term": 10,
      "long-term": 8,
      "episodic": 5,
      "context": 2
    },
    "keyTopics": ["python", "machine-learning", "optimization", "pandas"],
    "endedAt": "2025-01-28T12:00:00Z"
  },
  "endedAt": "2025-01-28T12:00:00Z"
}
```

### List LLM Sessions
```http
GET /api/v1/llm/sessions?status=active&limit=20&sortBy=lastActivity
```

**Query Parameters:**
- `status`: Filter by status (`active`, `paused`, `ended`)
- `limit`: Max results (default: 20)
- `offset`: Pagination offset (default: 0)
- `sortBy`: Sort order (`lastActivity`, `startTime`)

**Response:**
```json
{
  "success": true,
  "sessions": [
    {
      "sessionId": "conversation_123",
      "conversationId": "conv_456",
      "status": "active",
      "startTime": "2025-01-28T10:00:00Z",
      "lastActivity": "2025-01-28T12:00:00Z",
      "metadata": {
        "conversationTitle": "Python ML Pipeline Discussion",
        "memoryCount": 25
      },
      "statistics": {
        "totalContexts": 25,
        "memoryCount": 23
      }
    }
  ],
  "pagination": {
    "totalCount": 5,
    "limit": 20,
    "offset": 0,
    "hasMore": false
  },
  "query": {
    "status": "active",
    "limit": 20,
    "sortBy": "lastActivity"
  },
  "retrievedAt": "2025-01-28T12:30:00Z"
}
```

### Update Session Context (Working Memory)
```http
POST /api/v1/llm/sessions/{sessionId}/context
```

**Request Body:**
```json
{
  "currentTask": "Code optimization",
  "userIntent": "improve performance",
  "conversationStage": "middle",
  "keyTopics": ["optimization", "pandas", "memory"],
  "userMentions": [
    {
      "entity": "pandas DataFrame",
      "type": "thing",
      "context": "memory usage optimization",
      "firstMention": "2025-01-28T10:00:00Z",
      "frequency": 5
    }
  ],
  "preferences": {
    "codeStyle": "pythonic",
    "explanationLevel": "detailed"
  },
  "workingMemory": [
    {
      "content": "User's DataFrame has 10M rows",
      "importance": 0.8,
      "timestamp": "2025-01-28T10:00:00Z"
    },
    {
      "content": "Memory usage is the main concern",
      "importance": 0.9,
      "timestamp": "2025-01-28T10:15:00Z"
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "contextId": "ctx_working_memory_123",
  "sessionId": "conversation_123",
  "message": "Session context updated",
  "updatedAt": "2025-01-28T10:15:00Z"
}
```

## 📊 Health & Performance API

### Basic Health Check
```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-28T10:00:00Z",
  "service": "persistent-context-store",
  "version": "1.0.0",
  "uptime": 3600
}
```

### Detailed Health Check
```http
GET /health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-01-28T10:00:00Z",
  "service": "persistent-context-store",
  "version": "1.0.0",
  "uptime": 3600,
  "components": {
    "database": {
      "status": "healthy",
      "responseTime": 5,
      "connections": {
        "active": 2,
        "idle": 8,
        "total": 10
      }
    },
    "search": {
      "status": "healthy",
      "responseTime": 12,
      "indexSize": "156MB",
      "documentCount": 12450
    },
    "memory": {
      "used": "512MB",
      "total": "2GB",
      "percentage": 25.6
    },
    "storage": {
      "used": "2.1GB",
      "available": "47.9GB",
      "percentage": 4.2
    }
  },
  "metrics": {
    "requestsPerMinute": 150,
    "averageResponseTime": 45,
    "errorRate": 0.2
  }
}
```

### Performance Metrics
```http
GET /api/v1/performance/metrics
```

**Response:**
```json
{
  "success": true,
  "data": {
    "system": {
      "uptime": 3600,
      "memory": {
        "heapUsed": "128MB",
        "heapTotal": "256MB",
        "external": "32MB"
      },
      "cpu": {
        "usage": 15.2,
        "loadAverage": [0.5, 0.4, 0.3]
      }
    },
    "application": {
      "requests": {
        "total": 10500,
        "perMinute": 150,
        "perSecond": 2.5
      },
      "responses": {
        "averageTime": 45,
        "p95": 120,
        "p99": 250
      },
      "errors": {
        "total": 25,
        "rate": 0.24,
        "lastError": "2025-01-28T09:45:00Z"
      }
    },
    "database": {
      "connections": {
        "active": 5,
        "idle": 15,
        "total": 20
      },
      "queries": {
        "total": 8500,
        "averageTime": 12,
        "slowQueries": 3
      }
    }
  },
  "collectedAt": "2025-01-28T10:00:00Z"
}
```

## 🔍 Search API

### Advanced Search
```http
POST /api/v1/search
```

**Request Body:**
```json
{
  "query": "machine learning optimization",
  "filters": {
    "type": "knowledge",
    "tags": ["python", "ml"],
    "importance": ["high", "critical"],
    "dateRange": {
      "start": "2025-01-20T00:00:00Z",
      "end": "2025-01-28T23:59:59Z"
    }
  },
  "options": {
    "limit": 20,
    "offset": 0,
    "sortBy": "relevance",
    "fuzzyMatch": true,
    "highlightMatches": true,
    "includeMetadata": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "query": "machine learning optimization",
  "totalCount": 45,
  "executionTime": 85,
  "results": [
    {
      "context": {
        "id": "ctx_abc123",
        "title": "ML Pipeline Optimization",
        "content": "Comprehensive guide to optimizing machine learning pipelines...",
        "type": "knowledge",
        "tags": ["python", "ml", "optimization"],
        "createdAt": "2025-01-25T14:00:00Z"
      },
      "score": 0.95,
      "matchedFields": ["title", "content", "tags"],
      "highlights": {
        "title": ["ML Pipeline <em>Optimization</em>"],
        "content": ["<em>machine learning</em> pipelines", "<em>optimization</em> techniques"]
      }
    }
  ],
  "facets": {
    "type": {
      "knowledge": 25,
      "memory": 15,
      "context": 5
    },
    "importance": {
      "high": 30,
      "critical": 10,
      "medium": 5
    },
    "tags": {
      "python": 35,
      "ml": 40,
      "optimization": 25
    }
  },
  "suggestions": [
    "machine learning pipeline",
    "ml optimization techniques",
    "python ml performance"
  ]
}
```

## 📤 Session Management API

### Save Context (Immediate)
```http
POST /api/v1/contexts/save
```

**Request Body:**
```json
{
  "sessionId": "session_123",
  "title": "Planning Session Context",
  "content": "Detailed planning information...",
  "type": "planning",
  "tags": ["planning", "session"],
  "metadata": {
    "importance": "high",
    "source": "user"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "contextId": "ctx_abc123"
  },
  "message": "Context saved successfully"
}
```

### Get Recent Sessions
```http
GET /api/v1/sessions/recent?limit=10
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "sessionId": "session_123",
      "lastActivity": "2025-01-28T12:00:00Z",
      "contextCount": 15,
      "title": "Planning Session",
      "status": "active"
    }
  ]
}
```

### Resume Session
```http
POST /api/v1/sessions/{sessionId}/resume
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "ctx_latest",
    "title": "Latest Session Context",
    "content": "Most recent context for session...",
    "sessionId": "session_123",
    "createdAt": "2025-01-28T11:45:00Z"
  },
  "message": "Session resumed successfully"
}
```

### Get Session Contexts
```http
GET /api/v1/sessions/{sessionId}/contexts?limit=20
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "ctx_abc123",
      "title": "Session Context 1",
      "type": "planning",
      "createdAt": "2025-01-28T10:00:00Z",
      "tags": ["planning", "session"]
    }
  ]
}
```

## 📈 System Status API

### System Status
```http
GET /api/v1/system/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "components": {
      "contextStore": "operational",
      "searchService": "operational",
      "database": "operational",
      "healthMonitor": "operational"
    },
    "performance": {
      "averageResponseTime": 45,
      "requestsPerMinute": 150,
      "errorRate": 0.2
    },
    "storage": {
      "totalContexts": 12450,
      "storageUsed": "2.1GB",
      "indexSize": "156MB"
    },
    "uptime": 3600,
    "version": "1.0.0",
    "lastHealthCheck": "2025-01-28T10:00:00Z"
  }
}
```

## ⚠️ Error Codes

### HTTP Status Codes
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `429`: Rate Limited
- `500`: Internal Server Error

### Application Error Types
- `VALIDATION_ERROR`: Invalid request data
- `AUTHENTICATION_ERROR`: Invalid or missing credentials
- `AUTHORIZATION_ERROR`: Insufficient permissions
- `NOT_FOUND_ERROR`: Resource not found
- `RATE_LIMIT_ERROR`: Rate limit exceeded
- `DATABASE_ERROR`: Database operation failed
- `SEARCH_ERROR`: Search operation failed
- `INTERNAL_ERROR`: Unexpected server error

### Error Response Examples
```json
{
  "success": false,
  "error": "VALIDATION_ERROR",
  "message": "Required field 'sessionId' is missing",
  "details": {
    "field": "sessionId",
    "constraint": "required"
  },
  "timestamp": "2025-01-28T10:00:00Z"
}
```

```json
{
  "success": false,
  "error": "RATE_LIMIT_ERROR",
  "message": "Rate limit exceeded: 1000 requests per minute",
  "details": {
    "limit": 1000,
    "window": "60s",
    "retryAfter": 45
  },
  "timestamp": "2025-01-28T10:00:00Z"
}
```

## 🚀 Rate Limits

### Default Limits
- **General API**: 1000 requests/minute
- **LLM Memory API**: 2000 requests/minute
- **Search API**: 500 requests/minute
- **Health Checks**: No limit

### Rate Limit Headers
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 850
X-RateLimit-Reset: 1643374800
```

## 📚 SDK Examples

### JavaScript/Node.js
```javascript
const client = new ContextStoreClient({
  baseUrl: 'http://localhost:3000',
  apiKey: 'llm_your_api_key'
});

// Store memory
const memory = await client.storeMemory('session_123', {
  shortTerm: [{
    type: 'fact',
    content: 'User prefers TypeScript',
    importance: 'medium',
    tags: ['preference', 'typescript'],
    timestamp: new Date(),
    source: 'user',
    confidence: 0.9
  }]
});

// Search memories
const results = await client.searchMemories('typescript', {
  types: ['preference', 'fact'],
  limit: 10
});
```

### Python
```python
client = ContextStoreClient(
    base_url='http://localhost:3000',
    api_key='llm_your_api_key'
)

# Store memory
memory = client.store_memory('session_123', {
    'shortTerm': [{
        'type': 'fact',
        'content': 'User prefers Python 3.9+',
        'importance': 'medium',
        'tags': ['preference', 'python'],
        'timestamp': datetime.now().isoformat(),
        'source': 'user',
        'confidence': 0.9
    }]
})

# Search memories
results = client.search_memories('python', {
    'types': ['preference', 'fact'],
    'limit': 10
})
```

This API reference provides comprehensive documentation for all available endpoints, request/response formats, and integration examples. 🚀