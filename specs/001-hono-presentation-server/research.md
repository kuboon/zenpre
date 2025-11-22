# Research: Real-time Presentation Server with WebSocket Pub-Sub

**Date**: November 13, 2025\
**Feature**: Real-time Presentation Server implementation in Hono.js with Deno
runtime

## Research Tasks Completed

### 1. Hono.js WebSocket Integration Patterns

**Decision**: `upgradeWebSocket()` middleware + Map-based connection registry

**Rationale**:
- Hono v4+ native WebSocket via `hono/ws`
- Connection registry → efficient topic-specific broadcast
- Middleware pipeline integration → authentication
- Single app → HTTP + WebSocket endpoints

**Alternatives Rejected**:
- Native Deno WebSocket: complex, no middleware
- External libs: unnecessary deps, violates constitution

**Implementation**:

```pseudocode
IMPORT upgradeWebSocket FROM "hono/ws"

app.get("/api/topics/:topicId",
  upgradeWebSocket((c) => ({
    onOpen: (evt, ws) →
      registerConnection(topicId, ws, accessLevel),
    
    onMessage: (evt, ws) →
      handleMessage(evt.data, topicId, accessLevel),
    
    onClose: () →
      cleanupConnection(topicId, ws)
  }))
)
```

### 2. Deno KV Storage Abstraction Design

**Decision**: Typed abstraction layer + generic repository pattern + auto serialization

**Rationale**:
- Satisfies constitution: storage abstraction
- Future migration → PostgreSQL/Redis
- Type safety + validation at boundary
- Deno KV built-in TTL → auto expiration

**Alternatives Rejected**:
- Direct Deno KV: violates constitution, tight coupling
- ORM-style: overengineered for KV

**Implementation**:

```pseudocode
INTERFACE StorageAbstraction<T>:
  get(key: string) → Promise<T | null>
  set(key: string, value: T, expireIn?: number) → Promise<void>
  delete(key: string) → Promise<void>

CLASS TopicStore IMPLEMENTS StorageAbstraction<TopicData>:
  private kv = await Deno.openKv()
  // ... implementation
```

### 3. HMAC Authentication Best Practices

**Decision**: Web Crypto API HMAC-SHA256 + base64url encoding

**Rationale**:
- Deno built-in Web Crypto API (constitution compliance)
- HMAC-SHA256 → strong security for topic access
- Base64url → URL-safe secret transmission
- Crypto-secure random topic ID generation

**Alternatives Rejected**:
- JWT tokens: overkill, adds complexity
- Plain secrets: insufficient security
- External crypto libs: violates constitution

**Implementation**:

```pseudocode
FUNCTION generateTopic() → {topicId, secret}:
  topicIdRaw = crypto.getRandomValues(Uint8Array(16))
  
  key = crypto.subtle.importKey(
    "raw", hmacKeyBytes,
    {name: "HMAC", hash: "SHA-256"},
    false, ["sign", "verify"]
  )
  
  secretRaw = await crypto.subtle.sign("HMAC", key, topicIdRaw)
  
  RETURN {
    topicId: encodeBase64Url(topicIdRaw),
    secret: encodeBase64Url(secretRaw)
  }
```

### 4. WebSocket Message Broadcasting Architecture

**Decision**: BroadcastChannel API + topic-specific channels

**Rationale**:
- Deno native BroadcastChannel support
- Scalable message distribution across WebSocket connections
- Topic-isolated messages → efficient routing
- Single-process + extensible to multi-process

**Alternatives Rejected**:
- Direct WebSocket iteration: not scalable, couples publishers to connections
- External message queues: overengineered for single-process
- Custom event emitters: reimplements browser standard

**Implementation**:

```pseudocode
CLASS BroadcastService:
  private channels = Map<topicId, BroadcastChannel>
  
  FUNCTION getChannel(topicId):
    IF NOT channels.has(topicId):
      channel = NEW BroadcastChannel(topicId)
      channel.onmessage = (event) →
        broadcastToConnections(topicId, event.data)
      channels.set(topicId, channel)
    
    RETURN channels.get(topicId)
```

### 5. Content Validation and Size Limits

**Decision**: Middleware-based validation + configurable size limits + markdown sanitization

**Rationale**:
- Prevents abuse via oversized content
- Validates markdown format before storage/broadcast
- Hono middleware integration → consistent error handling
- Configurable limits → deployment tuning

**Alternatives Rejected**:
- No validation: security risk, abuse potential
- Client-side only: insufficient, bypassable
- Schema validation libs: unnecessary deps for simple validation

**Implementation**:

```pseudocode
MIDDLEWARE contentValidation(c, next):
  body = await c.req.json()
  
  IF body.markdown AND body.markdown.length > MAX_CONTENT_SIZE:
    RETURN c.json({error: "Content exceeds size limit"}, 413)
  
  await next()
```

### 6. Testing Strategy for WebSocket APIs

**Decision**: Deno test framework + WebSocket test clients (integration testing)

**Rationale**:
- Native Deno test → no external deps
- WebSocket testing requires real connections → realistic scenarios
- Integration tests → end-to-end WebSocket message flow
- Unit tests → business logic separate from connection handling

**Implementation**:

```pseudocode
TEST "WebSocket broadcasting":
  server = await startTestServer()
  
  ws1 = NEW WebSocket(`ws://localhost:8000/api/topics/${topicId}`)
  ws2 = NEW WebSocket(
    `ws://localhost:8000/api/topics/${topicId}?secret=${secret}`
  )
  
  // Test broadcast
  ws2.send(JSON.stringify({markdown: "test content"}))
  received = await waitForMessage(ws1)
  
  assertEquals(received.markdown, "test content")
```

## Summary

```pseudocode
ALL technical_unknowns RESOLVED:
  ✓ ZenPre constitution alignment
  
  ESTABLISHED:
    1. Hono.js WebSocket patterns
       → realtime communication
    
    2. Deno KV abstraction layer design
       → storage
    
    3. Web Crypto API usage
       → HMAC authentication
    
    4. BroadcastChannel architecture
       → message distribution
    
    5. Content validation middleware
       → approach
    
    6. WebSocket testing strategies
       → Deno test framework

READY FOR:
  Phase 1: design + implementation
```
