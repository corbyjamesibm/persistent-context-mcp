# LLM Integration Guide: Context Store Memory Access

## Overview

The Persistent Context Store now provides comprehensive APIs for LLM memory access, enabling AI assistants like Claude to store and retrieve contextual memories for improved conversation continuity and personalization.

## 🔑 Authentication

### API Key Setup

The system automatically generates API keys for LLM clients:

```bash
# Environment variables (optional - system generates defaults)
CLAUDE_API_KEY=llm_your_claude_api_key_here
LLM_API_KEY=llm_your_general_llm_key_here
```

### Default Clients

**Claude Assistant** (Default):
- Client ID: `claude-default`
- Permissions: `['read', 'write', 'search', 'manage_sessions']`
- Rate Limit: 1000 requests/minute

**General LLM Client**:
- Client ID: `llm-general`  
- Permissions: `['read', 'search']`
- Rate Limit: 500 requests/minute

### Authentication Headers

```http
Authorization: Bearer llm_your_api_key_here
Content-Type: application/json
```

## 📝 Memory Storage API

### Store LLM Memories
`POST /api/v1/llm/memories`

Store different types of memories for improved context retention:

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
        "confidence": 0.9
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
    "shortTerm": [{"memoryId": "st_1", "contextId": "ctx_abc123"}],
    "longTerm": [{"memoryId": "lt_1", "contextId": "ctx_def456"}],
    "episodic": [{"memoryId": "ep_1", "contextId": "ctx_ghi789"}],
    "contextId": "ctx_context_123"
  },
  "storedAt": "2025-01-28T10:00:00Z"
}
```

## 🔍 Memory Retrieval API

### Retrieve LLM Memories
`GET /api/v1/llm/memories`

Query parameters:
- `sessionId` - Filter by session
- `conversationId` - Filter by conversation  
- `userId` - Filter by user
- `types` - Memory types (comma-separated): fact,preference,context,instruction,example
- `tags` - Filter by tags (comma-separated)
- `importance` - Filter by importance: low,medium,high,critical
- `limit` - Max results (default: 50)
- `offset` - Pagination offset (default: 0)
- `sortBy` - Sort order: timestamp,importance,relevance
- `q` - Search query

```http
GET /api/v1/llm/memories?sessionId=conversation_123&types=preference,fact&limit=20&q=python
```

**Response:**
```json
{
  "success": true,
  "totalCount": 15,
  "executionTime": 45,
  "memories": {
    "shortTerm": [...],
    "longTerm": [...], 
    "episodic": [...],
    "context": [...]
  },
  "retrievedAt": "2025-01-28T10:00:00Z"
}
```

### Advanced Memory Search
`POST /api/v1/llm/memories/search`

```json
{
  "query": "python machine learning optimization",
  "filters": {
    "types": ["preference", "fact", "context"],
    "importance": ["high", "critical"],
    "tags": ["python", "ml"],
    "sessionId": "conversation_123"
  },
  "limit": 10,
  "fuzzyMatch": true,
  "highlightMatches": true,
  "semanticSearch": true
}
```

## 🗂️ Session Management API

### Create/Resume Session
`POST /api/v1/llm/sessions`

```json
{
  "sessionId": "conversation_123",
  "conversationId": "conv_456",
  "userId": "user_789", 
  "title": "Python ML Pipeline Discussion",
  "userPreferences": {
    "codeStyle": "pythonic",
    "explanationLevel": "intermediate"
  },
  "settings": {
    "memoryRetention": "permanent",
    "maxMemories": 1000,
    "autoSummary": true,
    "contextWindow": 50
  }
}
```

### Get Session Info
`GET /api/v1/llm/sessions/{sessionId}`

### Update Session
`PUT /api/v1/llm/sessions/{sessionId}`

### End Session
`DELETE /api/v1/llm/sessions/{sessionId}`

Options:
```json
{
  "generateSummary": true
}
```

### List Sessions
`GET /api/v1/llm/sessions?status=active&limit=20`

### Update Session Context (Working Memory)
`POST /api/v1/llm/sessions/{sessionId}/context`

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
    "codeStyle": "pythonic"
  },
  "workingMemory": [
    {
      "content": "User's DataFrame has 10M rows",
      "importance": 0.8,
      "timestamp": "2025-01-28T10:00:00Z"
    }
  ]
}
```

## 🔧 Integration Examples

### Basic Claude Integration

```javascript
class ClaudeMemoryClient {
  constructor(apiKey, baseUrl) {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    this.headers = {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    };
  }

  async storeMemory(sessionId, memories) {
    const response = await fetch(`${this.baseUrl}/api/v1/llm/memories`, {
      method: 'POST',
      headers: this.headers,
      body: JSON.stringify({
        sessionId,
        memories
      })
    });
    return response.json();
  }

  async retrieveMemories(sessionId, query = '') {
    const url = new URL(`${this.baseUrl}/api/v1/llm/memories`);
    url.searchParams.set('sessionId', sessionId);
    if (query) url.searchParams.set('q', query);

    const response = await fetch(url, {
      headers: this.headers
    });
    return response.json();
  }

  async createSession(sessionId, config = {}) {
    const response = await fetch(`${this.baseUrl}/api/v1/llm/sessions`, {
      method: 'POST', 
      headers: this.headers,
      body: JSON.stringify({
        sessionId,
        ...config
      })
    });
    return response.json();
  }
}

// Usage
const client = new ClaudeMemoryClient('llm_your_api_key', 'http://localhost:3000');

// Create session
await client.createSession('conv_123', {
  title: 'Python Help Session',
  settings: {
    memoryRetention: 'permanent',
    maxMemories: 500
  }
});

// Store memory
await client.storeMemory('conv_123', {
  shortTerm: [{
    type: 'fact',
    content: 'User is debugging pandas memory issues',
    importance: 'medium',
    tags: ['pandas', 'debugging'],
    timestamp: new Date(),
    source: 'user',
    confidence: 0.9
  }]
});

// Retrieve memories
const memories = await client.retrieveMemories('conv_123', 'pandas');
```

### Python Integration

```python
import requests
import json
from datetime import datetime

class LLMMemoryClient:
    def __init__(self, api_key, base_url):
        self.api_key = api_key
        self.base_url = base_url
        self.headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
    
    def store_memory(self, session_id, memories):
        response = requests.post(
            f'{self.base_url}/api/v1/llm/memories',
            headers=self.headers,
            json={
                'sessionId': session_id,
                'memories': memories
            }
        )
        return response.json()
    
    def retrieve_memories(self, session_id, query='', types=None):
        params = {'sessionId': session_id}
        if query:
            params['q'] = query
        if types:
            params['types'] = ','.join(types)
            
        response = requests.get(
            f'{self.base_url}/api/v1/llm/memories',
            headers=self.headers,
            params=params
        )
        return response.json()
    
    def search_memories(self, query, filters=None):
        payload = {'query': query}
        if filters:
            payload['filters'] = filters
            
        response = requests.post(
            f'{self.base_url}/api/v1/llm/memories/search',
            headers=self.headers,
            json=payload
        )
        return response.json()

# Usage
client = LLMMemoryClient('llm_your_api_key', 'http://localhost:3000')

# Store user preference
client.store_memory('session_123', {
    'longTerm': [{
        'type': 'preference',
        'content': 'User prefers detailed code examples with comments',
        'importance': 'high',
        'tags': ['preference', 'code', 'examples'],
        'timestamp': datetime.now().isoformat(),
        'source': 'llm',
        'confidence': 0.95
    }]
})

# Search for relevant memories
memories = client.search_memories(
    'code examples python',
    filters={
        'types': ['preference', 'fact'],
        'importance': ['high', 'medium']
    }
)
```

## 🎯 Memory Types and Use Cases

### Short-term Memory
- **Purpose**: Current conversation context
- **Retention**: Session-based
- **Examples**: Current task, immediate preferences, working variables

### Long-term Memory  
- **Purpose**: Persistent user knowledge
- **Retention**: Permanent or limited
- **Examples**: User expertise, consistent preferences, learned patterns

### Episodic Memory
- **Purpose**: Specific interaction history
- **Retention**: Configurable
- **Examples**: Past problems solved, conversation summaries, learning moments

## 🔒 Security Features

- **API Key Authentication**: Secure token-based access
- **Client Isolation**: Memories are isolated per client
- **Rate Limiting**: Configurable request limits per client
- **Permission System**: Granular access control (read, write, search, manage_sessions)
- **CORS Support**: Cross-origin requests for web applications

## 📊 Monitoring and Analytics

The system provides built-in monitoring:

- **Memory Usage Statistics**: Track storage per session/client
- **Search Performance**: Monitor query response times
- **Session Analytics**: Conversation duration, memory retention
- **Rate Limiting**: Track API usage patterns

## 🚀 Getting Started

1. **Set up API keys** (optional - system generates defaults)
2. **Create your first session**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/llm/sessions \
     -H "Authorization: Bearer llm_your_api_key" \
     -H "Content-Type: application/json" \
     -d '{"sessionId": "test_session", "title": "First Session"}'
   ```

3. **Store a memory**:
   ```bash
   curl -X POST http://localhost:3000/api/v1/llm/memories \
     -H "Authorization: Bearer llm_your_api_key" \
     -H "Content-Type: application/json" \
     -d '{
       "sessionId": "test_session",
       "memories": {
         "shortTerm": [{
           "type": "fact",
           "content": "User is learning API integration",
           "importance": "medium",
           "tags": ["learning", "api"],
           "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
           "source": "user",
           "confidence": 0.9
         }]
       }
     }'
   ```

4. **Retrieve memories**:
   ```bash
   curl -X GET "http://localhost:3000/api/v1/llm/memories?sessionId=test_session" \
     -H "Authorization: Bearer llm_your_api_key"
   ```

## 📚 API Reference

See the full API documentation for detailed endpoint specifications, request/response schemas, and error codes.

The context store is now ready to serve as your LLM's persistent memory system! 🧠✨