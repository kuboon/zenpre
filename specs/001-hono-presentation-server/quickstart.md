# Quickstart: Real-time Presentation Server

**Feature**: Real-time Presentation Server with WebSocket Pub-Sub\
**Date**: November 13, 2025

## Prerequisites

```pseudocode
REQUIRED:
  - Deno 2.x runtime (installed)
  - TypeScript/JavaScript basics
  - WebSocket + HTTP API concepts
```

## Development Setup

### 1. Project Structure

```pseudocode
CREATE directory_tree:
  server/
    ├─ routes/api/
    ├─ services/
    ├─ models/
    ├─ storage/
    └─ utils/
  tests/
    ├─ integration/
    ├─ unit/
    └─ fixtures/
```

```bash
# Create the project structure under server/ directory
mkdir -p server/{routes/{api},services,models,storage,utils}
mkdir -p tests/{integration,unit,fixtures}

# Core files
touch server/main.ts
touch server/routes/api/topics.ts
touch server/services/{topic-service.ts,auth-service.ts,broadcast-service.ts}
touch server/models/topic.ts
touch server/storage/{abstraction.ts,kv-storage.ts}
touch server/utils/{crypto.ts,validation.ts}
```

### 2. Development Dependencies

```bash
deno add jsr:@hono/hono@^4.0.0
deno add jsr:@std/encoding
```

### 3. Core Implementation

#### Basic Server (`server/main.ts`)

```typescript
import { Hono } from "hono";
import { topicsRouter } from "./routes/api/topics.ts";

const app = new Hono();

// Routes
app.route("/api/topics", topicsRouter);

console.log("Server starting on http://localhost:8000");
Deno.serve({ port: 8000 }, app.fetch);
```

#### Topic Types (`server/models/topic.ts`)

```typescript
export interface Topic {
  topicId: string;
  markdown: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TopicPair {
  topicId: string;
  secret: string;
}

export interface CreateTopicResponse extends TopicPair {
  subPath: string;
  pubPath: string;
}

export type AccessLevel = "readable" | "writable" | "invalid";
```

#### Authentication (`server/utils/crypto.ts`)

```typescript
export async function generateTopic(): Promise<TopicPair> {
  const topicIdRaw = crypto.getRandomValues(new Uint8Array(16));
  const key = await getHmacKey();
  const secretRaw = await crypto.subtle.sign("HMAC", key, topicIdRaw);

  return {
    topicId: encodeBytes(topicIdRaw),
    secret: encodeBytes(secretRaw),
  };
}

export async function verifyAccess(pair: TopicPair): Promise<AccessLevel> {
  if (!pair.secret) return "readable";

  try {
    const topicIdRaw = decodeToBytes(pair.topicId);
    const secretRaw = decodeToBytes(pair.secret);
    const key = await getHmacKey();
    const verified = await crypto.subtle.verify(
      "HMAC",
      key,
      secretRaw,
      topicIdRaw,
    );
    return verified ? "writable" : "invalid";
  } catch {
    return "invalid";
  }
}

// Helper functions
import { decodeBase64Url, encodeBase64Url } from "jsr:@std/encoding/base64url";

function encodeBytes(bytes: ArrayBuffer): string {
  return encodeBase64Url(new Uint8Array(bytes));
}

function decodeToBytes(str: string): Uint8Array {
  return decodeBase64Url(str);
}

async function getHmacKey() {
  // Get or generate HMAC key from environment
}
```

## API Usage Examples

### 1. Create Presentation Topic

```pseudocode
CREATE topic:
  POST /api/topics
  ← {topicId, secret, subPath, pubPath}
```

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

```pseudocode
CONNECTIONS:
  Publisher (with secret):
    ws = WebSocket(url + "?secret=" + secret)
    ws.send({markdown, currentPage, currentSection})
  
  Subscriber (no secret):
    ws = WebSocket(url)
    ws.onmessage = (data) → update_UI(data)
    ws.send({pub: {reaction: {emoji, timestamp}}})
```

### JavaScript Client Example

```javascript
// Publisher connection (with secret)
const publisherWs = new WebSocket(
  "ws://localhost:8000/api/topics/abc123def456ghi789jklm?secret=xyz789abc123def456ghi789jklmnop123",
);

publisherWs.onopen = () => {
  console.log("Publisher connected");

  // Send content update
  publisherWs.send(JSON.stringify({
    markdown: "# Live Update\n\nThis content updates in real-time!",
  }));

  // Send navigation update
  publisherWs.send(JSON.stringify({
    currentPage: 1,
    currentSection: 0,
  }));
};

// Subscriber connection (without secret)
const subscriberWs = new WebSocket(
  "ws://localhost:8000/api/topics/abc123def456ghi789jklm",
);

subscriberWs.onmessage = (event) => {
  const data = JSON.parse(event.data);

  if (data.markdown) {
    console.log("Content updated:", data.markdown);
    // Update presentation view
  }

  if (data.currentPage !== undefined) {
    console.log("Page changed to:", data.currentPage);
    // Sync page navigation
  }

  if (data.pub?.reaction) {
    console.log("Reaction received:", data.pub.reaction.emoji);
    // Show reaction animation
  }
};

// Send reaction (available to all users)
subscriberWs.send(JSON.stringify({
  pub: {
    reaction: {
      emoji: "👍",
      timestamp: Date.now(),
    },
  },
}));
```

## Testing

### Run Tests

```pseudocode
RUN tests:
  all: deno task test
  specific: deno test tests/integration/api-topics.test.ts
  watch: deno task test:watch
```

### Basic Integration Test

```typescript
// tests/integration/api-topics.test.ts
import { assertEquals } from "https://deno.land/std/assert/mod.ts";

Deno.test("Topic creation and retrieval", async () => {
  const server = await startTestServer();

  // Create topic
  const createResponse = await fetch("http://localhost:8001/api/topics", {
    method: "POST",
  });
  const topic = await createResponse.json();

  assertEquals(createResponse.status, 201);
  assertEquals(topic.topicId.length, 22);

  // Get topic content
  const getResponse = await fetch(
    `http://localhost:8001/api/topics/${topic.topicId}`,
  );
  const content = await getResponse.json();

  assertEquals(getResponse.status, 200);
  assertEquals(content.markdown, "");

  await server.close();
});
```

## Deployment

### Production Environment Variables

```pseudocode
ENV config (.env):
  HMAC_KEY = your-production-hmac-key-base64
  PORT = 8000
  ENVIRONMENT = production
```

### Start Production Server

```pseudocode
RUN production:
  WITH env_vars:
    HMAC_KEY, PORT
  
  EXECUTE:
    deno run \
      --allow-net \
      --allow-env \
      --unstable-kv \
      src/server.ts
```

## Development Workflow

```pseudocode
WORKFLOW:
  1. START dev_server:
     deno task dev
  
  2. RUN tests (separate terminal):
     deno task test:watch
  
  3. CREATE topic:
     curl OR frontend_client
  
  4. TEST WebSocket:
     browser_devtools OR WebSocket_client
```
5. **Validate Features**: Check real-time updates work between connections

## Next Steps

- Implement complete storage abstraction layer
- Add comprehensive error handling
- Set up WebSocket connection management
- Create frontend presentation client
- Add monitoring and logging
- Deploy to production environment

This quickstart provides the foundation for building the real-time presentation
server according to the specification and constitution requirements.
