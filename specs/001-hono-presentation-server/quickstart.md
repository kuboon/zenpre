# Quickstart: Real-time Presentation Server

**Feature**: Real-time Presentation Server with WebSocket Pub-Sub  
**Date**: November 13, 2025

## Prerequisites

- Deno 2.x runtime installed
- Basic understanding of TypeScript/JavaScript
- WebSocket and HTTP API concepts

## Development Setup

### 1. Project Structure

```bash
# Create the project structure
mkdir -p src/{api,storage,auth,models,services,utils}
mkdir -p tests/{integration,unit,fixtures}

# Core files
touch src/server.ts
touch src/api/{topics.ts,websocket.ts,middleware.ts}
touch src/storage/{abstraction.ts,topic-store.ts,types.ts}
touch src/auth/{crypto.ts,types.ts}
touch src/models/topic.ts
touch src/services/{topic-service.ts,broadcast-service.ts}
touch src/utils/validation.ts
```

### 2. Development Dependencies

```bash
deno add jsr:@hono/hono@^4.0.0
```

### 3. Core Implementation

#### Basic Server (`src/server.ts`)

```typescript
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { topicsRouter } from './api/topics.ts'
import { websocketRouter } from './api/websocket.ts'

const app = new Hono()

// Middleware
app.use('*', cors({
  allowHeaders: ['Content-Type'],
  allowMethods: ['GET', 'POST', 'OPTIONS']
}))

// Routes
app.route('/api/topics', topicsRouter)
app.route('/api/topics', websocketRouter)


console.log('Server starting on http://localhost:8000')
Deno.serve({ port: 8000 }, app.fetch)
```

#### Topic Types (`src/models/topic.ts`)

```typescript
export interface Topic {
  topicId: string
  markdown: string
  createdAt: Date
  updatedAt: Date
}

export interface TopicPair {
  topicId: string
  secret: string
}

export interface CreateTopicResponse extends TopicPair {
  subPath: string
  pubPath: string
}

export type AccessLevel = 'readable' | 'writable' | 'invalid'
```

#### Authentication (`src/auth/crypto.ts`)

```typescript
export async function generateTopic(): Promise<TopicPair> {
  const topicIdRaw = crypto.getRandomValues(new Uint8Array(16))
  const key = await getHmacKey()
  const secretRaw = await crypto.subtle.sign('HMAC', key, topicIdRaw)
  
  return {
    topicId: encodeBase64Url(topicIdRaw),
    secret: encodeBase64Url(secretRaw)
  }
}

export async function verifyAccess(pair: TopicPair): Promise<AccessLevel> {
  if (!pair.secret) return 'readable'
  
  try {
    const topicIdRaw = decodeBase64Url(pair.topicId)
    const secretRaw = decodeBase64Url(pair.secret)
    const key = await getHmacKey()
    const verified = await crypto.subtle.verify('HMAC', key, secretRaw, topicIdRaw)
    return verified ? 'writable' : 'invalid'
  } catch {
    return 'invalid'
  }
}

// Helper functions
function encodeBase64Url(bytes: ArrayBuffer): string {
  // Implementation for base64url encoding
}

function decodeBase64Url(str: string): Uint8Array {
  // Implementation for base64url decoding  
}

async function getHmacKey() {
  // Get or generate HMAC key from environment
}
```

## API Usage Examples

### 1. Create Presentation Topic

```bash
# Create new topic
curl -X POST http://localhost:8000/api/topics

# Response:
# {
#   "topicId": "abc123def456ghi789jklm",
#   "secret": "xyz789abc123def456ghi789jklmnop123", 
#   "subPath": "/api/topics/abc123def456ghi789jklm",
#   "pubPath": "/api/topics/abc123def456ghi789jklm?secret=xyz789abc123def456ghi789jklmnop123"
# }
```

### 2. Update Content (Publisher)

```bash
# Update presentation content
curl -X POST \
  "http://localhost:8000/api/topics/abc123def456ghi789jklm?secret=xyz789abc123def456ghi789jklmnop123" \
  -H "Content-Type: application/json" \
  -d '{"markdown": "# My Presentation\n\n## Introduction\n\nHello World!"}'
```

### 3. Get Content (Subscriber)

```bash
# Get current content
curl http://localhost:8000/api/topics/abc123def456ghi789jklm

# Response:
# {
#   "markdown": "# My Presentation\n\n## Introduction\n\nHello World!",
#   "createdAt": "2025-11-13T10:00:00.000Z",
#   "updatedAt": "2025-11-13T10:15:30.000Z"
# }
```

## WebSocket Usage

### JavaScript Client Example

```javascript
// Publisher connection (with secret)
const publisherWs = new WebSocket('ws://localhost:8000/api/topics/abc123def456ghi789jklm?secret=xyz789abc123def456ghi789jklmnop123')

publisherWs.onopen = () => {
  console.log('Publisher connected')
  
  // Send content update
  publisherWs.send(JSON.stringify({
    markdown: '# Live Update\n\nThis content updates in real-time!'
  }))
  
  // Send navigation update
  publisherWs.send(JSON.stringify({
    currentPage: 1,
    currentSection: 0
  }))
}

// Subscriber connection (without secret)
const subscriberWs = new WebSocket('ws://localhost:8000/api/topics/abc123def456ghi789jklm')

subscriberWs.onmessage = (event) => {
  const data = JSON.parse(event.data)
  
  if (data.markdown) {
    console.log('Content updated:', data.markdown)
    // Update presentation view
  }
  
  if (data.currentPage !== undefined) {
    console.log('Page changed to:', data.currentPage)
    // Sync page navigation
  }
  
  if (data.pub?.reaction) {
    console.log('Reaction received:', data.pub.reaction.emoji)
    // Show reaction animation
  }
}

// Send reaction (available to all users)
subscriberWs.send(JSON.stringify({
  pub: {
    reaction: {
      emoji: '👍',
      timestamp: Date.now()
    }
  }
}))
```

## Testing

### Run Tests

```bash
# Run all tests
deno task test

# Run specific test file
deno test tests/integration/api-topics.test.ts

# Watch mode during development
deno task test:watch
```

### Basic Integration Test

```typescript
// tests/integration/api-topics.test.ts
import { assertEquals } from "https://deno.land/std/assert/mod.ts"

Deno.test("Topic creation and retrieval", async () => {
  const server = await startTestServer()
  
  // Create topic
  const createResponse = await fetch('http://localhost:8001/api/topics', {
    method: 'POST'
  })
  const topic = await createResponse.json()
  
  assertEquals(createResponse.status, 201)
  assertEquals(topic.topicId.length, 22)
  
  // Get topic content
  const getResponse = await fetch(`http://localhost:8001/api/topics/${topic.topicId}`)
  const content = await getResponse.json()
  
  assertEquals(getResponse.status, 200)
  assertEquals(content.markdown, '')
  
  await server.close()
})
```

## Deployment

### Production Environment Variables

```bash
# .env file
HMAC_KEY=your-production-hmac-key-base64
PORT=8000
ENVIRONMENT=production
```

### Start Production Server

```bash
# With environment variables
HMAC_KEY=your-key PORT=8000 deno run \
  --allow-net \
  --allow-env \
  --unstable-kv \
  src/server.ts
```

## Development Workflow

1. **Start Development Server**: `deno task dev`
2. **Run Tests**: `deno task test:watch` (in separate terminal)
3. **Create Topic**: Use curl or frontend client
4. **Test WebSocket**: Connect with browser dev tools or WebSocket client
5. **Validate Features**: Check real-time updates work between connections

## Next Steps

- Implement complete storage abstraction layer
- Add comprehensive error handling
- Set up WebSocket connection management
- Create frontend presentation client
- Add monitoring and logging
- Deploy to production environment

This quickstart provides the foundation for building the real-time presentation server according to the specification and constitution requirements.