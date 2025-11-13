# Research: Real-time Presentation Server with WebSocket Pub-Sub

**Date**: November 13, 2025  
**Feature**: Real-time Presentation Server implementation in Hono.js with Deno runtime

## Research Tasks Completed

### 1. Hono.js WebSocket Integration Patterns

**Decision**: Use Hono's `upgradeWebSocket()` middleware with connection management through Map-based registry

**Rationale**: 
- Hono v4+ provides native WebSocket support via `hono/ws` package
- Connection registry allows efficient broadcasting to topic-specific clients
- Integrates seamlessly with Hono's middleware pipeline for authentication
- Supports both HTTP and WebSocket endpoints in single application

**Alternatives Considered**:
- Native Deno WebSocket handling: More complex, lacks middleware integration
- External WebSocket libraries: Adds unnecessary dependencies, conflicts with constitution

**Implementation Pattern**:
```typescript
import { upgradeWebSocket } from 'hono/ws'

app.get('/api/topics/:topicId', upgradeWebSocket((c) => ({
  onOpen: (evt, ws) => registerConnection(topicId, ws, accessLevel),
  onMessage: (evt, ws) => handleMessage(evt.data, topicId, accessLevel),
  onClose: () => cleanupConnection(topicId, ws)
})))
```

### 2. Deno KV Storage Abstraction Design

**Decision**: Implement typed abstraction layer with generic repository pattern and automatic serialization

**Rationale**:
- Satisfies constitution requirement for storage abstraction
- Enables future migration to alternative storage (PostgreSQL, Redis)
- Provides type safety and validation at storage boundary
- Leverages Deno KV's built-in TTL for automatic content expiration

**Alternatives Considered**:
- Direct Deno KV usage: Violates constitution, tight coupling
- ORM-style abstraction: Overengineered for key-value storage patterns

**Implementation Pattern**:
```typescript
interface StorageAbstraction<T> {
  get(key: string): Promise<T | null>
  set(key: string, value: T, expireIn?: number): Promise<void>
  delete(key: string): Promise<void>
}

class TopicStore implements StorageAbstraction<TopicData> {
  private kv = await Deno.openKv()
  // Implementation details...
}
```

### 3. HMAC Authentication Best Practices

**Decision**: Use Web Crypto API's HMAC-SHA256 with base64url encoding for topic secrets

**Rationale**:
- Leverages Deno's built-in Web Crypto API (constitution compliance)
- HMAC-SHA256 provides strong security for topic access control
- Base64url encoding ensures URL-safe secret transmission
- Cryptographically secure random topic ID generation

**Alternatives Considered**:
- JWT tokens: Overkill for simple topic access, adds complexity
- Plain secret strings: Insufficient security for authentication
- External crypto libraries: Violates constitution, unnecessary dependency

**Implementation Pattern**:
```typescript
async function generateTopic(): Promise<{topicId: string, secret: string}> {
  const topicIdRaw = crypto.getRandomValues(new Uint8Array(16))
  const key = await crypto.subtle.importKey('raw', hmacKeyBytes, 
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
  const secretRaw = await crypto.subtle.sign('HMAC', key, topicIdRaw)
  return {
    topicId: encodeBase64Url(topicIdRaw),
    secret: encodeBase64Url(secretRaw)
  }
}
```

### 4. WebSocket Message Broadcasting Architecture

**Decision**: Use BroadcastChannel API for message distribution with topic-specific channels

**Rationale**:
- Deno provides native BroadcastChannel support for message passing
- Enables scalable message distribution across WebSocket connections
- Isolates messages by topic for efficient routing
- Works within single Deno process and can extend to multi-process

**Alternatives Considered**:
- Direct WebSocket iteration: Not scalable, couples publishers to connections
- External message queues: Overengineered for single-process deployment
- Custom event emitters: Reimplements existing browser standard

**Implementation Pattern**:
```typescript
class BroadcastService {
  private channels = new Map<string, BroadcastChannel>()
  
  getChannel(topicId: string): BroadcastChannel {
    if (!this.channels.has(topicId)) {
      const channel = new BroadcastChannel(topicId)
      channel.onmessage = (event) => this.broadcastToConnections(topicId, event.data)
      this.channels.set(topicId, channel)
    }
    return this.channels.get(topicId)!
  }
}
```

### 5. Content Validation and Size Limits

**Decision**: Implement middleware-based validation with configurable size limits and markdown sanitization

**Rationale**:
- Prevents abuse through oversized content submissions
- Validates markdown format before storage and broadcast
- Integrates with Hono middleware pipeline for consistent error handling
- Configurable limits allow tuning for deployment requirements

**Alternatives Considered**:
- No validation: Security risk, potential for abuse
- Client-side only validation: Insufficient, can be bypassed
- Schema validation libraries: Adds dependencies for simple validation

**Implementation Pattern**:
```typescript
const contentValidation = async (c: Context, next: Next) => {
  const body = await c.req.json()
  if (body.markdown && body.markdown.length > MAX_CONTENT_SIZE) {
    return c.json({ error: 'Content exceeds size limit' }, 413)
  }
  await next()
}
```

### 6. Testing Strategy for WebSocket APIs

**Decision**: Use Deno's testing framework with WebSocket test clients for integration testing

**Rationale**:
- Native Deno test support with no external dependencies
- WebSocket testing requires real connections for realistic scenarios
- Integration tests verify end-to-end WebSocket message flow
- Unit tests cover business logic separate from connection handling

**Implementation Pattern**:
```typescript
Deno.test("WebSocket broadcasting", async () => {
  const server = await startTestServer()
  const ws1 = new WebSocket(`ws://localhost:8000/api/topics/${topicId}`)
  const ws2 = new WebSocket(`ws://localhost:8000/api/topics/${topicId}?secret=${secret}`)
  
  // Test message broadcasting between connections
  ws2.send(JSON.stringify({ markdown: "test content" }))
  const received = await waitForMessage(ws1)
  assertEquals(received.markdown, "test content")
})
```

## Summary

All technical unknowns have been resolved with concrete implementation decisions that align with ZenPre constitution requirements. The research establishes:

1. Hono.js WebSocket patterns for real-time communication
2. Deno KV abstraction layer design for storage
3. Web Crypto API usage for HMAC authentication
4. BroadcastChannel architecture for message distribution
5. Content validation middleware approach
6. WebSocket testing strategies with Deno test framework

These decisions provide the foundation for Phase 1 design and implementation.