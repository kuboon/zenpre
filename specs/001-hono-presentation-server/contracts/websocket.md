# WebSocket API Contract

**Feature**: Real-time Presentation Server  
**Protocol**: WebSocket over HTTP/1.1  
**Date**: November 13, 2025

## Connection Establishment

### Endpoint Pattern

```
ws://localhost:8000/api/topics/{topicId}[?secret={secret}]
```

**Parameters**:
- `topicId`: Required. Unique topic identifier (base64url, 22 characters)
- `secret`: Optional. HMAC authentication secret for publisher access

### Access Levels

| Secret Present | Access Level | Capabilities |
|----------------|--------------|--------------|
| Yes (valid)    | `writable`   | Send content updates, receive all messages |
| No             | `readable`   | Receive content updates only, send reactions |
| Yes (invalid)  | N/A          | Connection rejected with 403 |

### Connection Lifecycle

```
1. HTTP Upgrade Request
   ↓
2. Authentication Check
   ↓  
3. WebSocket Established
   ↓
4. Connection Registered
   ↓
5. Initial State Sent (if available)
   ↓
6. Real-time Message Exchange
   ↓
7. Connection Cleanup on Close
```

## Message Format

All WebSocket messages use JSON format with UTF-8 encoding.

### Inbound Messages (Client → Server)

#### Content Update (Publisher Only)

```json
{
  "markdown": "# Updated Content\n\nNew presentation content here..."
}
```

**Validation**:
- `markdown` required string, max 1MB
- Only allowed for `writable` access level
- Triggers storage update and broadcast to all connections

#### Navigation Update (Publisher Only)

```json
{
  "currentPage": 2,
  "currentSection": 1
}
```

**Validation**:
- `currentPage` optional integer >= 0
- `currentSection` optional integer >= 0
- Only allowed for `writable` access level
- Broadcasts navigation state to all connections

#### Reaction (All Users)

```json
{
  "pub": {
    "reaction": {
      "emoji": "👍",
      "timestamp": 1699876543210
    }
  }
}
```

**Validation**:
- `pub.reaction.emoji` required string, single emoji character
- `pub.reaction.timestamp` required integer, Unix timestamp in milliseconds
- Allowed for all access levels
- Broadcasts to all connections for the topic

### Outbound Messages (Server → Client)

#### Content Broadcast

```json
{
  "markdown": "# Updated Content\n\nBroadcast to all connected clients..."
}
```

**Triggers**:
- Publisher sends content update
- New connection joins (initial state)

#### Navigation Broadcast

```json
{
  "currentPage": 2,
  "currentSection": 1
}
```

**Triggers**:
- Publisher sends navigation update
- Automatic sync for new connections

#### Reaction Broadcast

```json
{
  "pub": {
    "reaction": {
      "emoji": "👍", 
      "timestamp": 1699876543210
    }
  }
}
```

**Triggers**:
- Any connected user sends reaction
- Includes original timestamp for client-side animations

#### Error Response

```json
{
  "error": "Invalid message format",
  "code": "INVALID_MESSAGE",
  "timestamp": 1699876543210
}
```

**Triggers**:
- Malformed JSON
- Invalid message structure
- Permission violations

## Connection Management

### Registration

```typescript
// Server-side connection tracking
interface ConnectionRegistry {
  [topicId: string]: {
    [connectionId: string]: {
      ws: WebSocket
      accessLevel: 'readable' | 'writable'
      connectedAt: Date
      lastActivity: Date
    }
  }
}
```

### Broadcasting Strategy

```typescript
// Message distribution flow
1. Receive message from publisher connection
2. Validate message format and permissions
3. Store content update (if applicable)
4. Get BroadcastChannel for topic
5. Send message to channel
6. Channel delivers to all registered connections
7. Update lastActivity for active connections
```

### Error Handling

| Error Condition | Action | Response |
|-----------------|--------|-----------|
| Invalid JSON | Log warning | Send error message |
| Permission denied | Log attempt | Send error message |
| Content too large | Reject message | Send 413 error |
| Connection lost | Cleanup registry | Remove from topic |
| Topic not found | Close connection | Send 404 error |

### Performance Considerations

- **Connection Limits**: No hard limit per topic (relies on system resources)
- **Message Rate**: No rate limiting implemented (trust-based system)
- **Broadcast Latency**: Target <100ms for message delivery
- **Memory Usage**: Connections cleaned up on close/error events

### WebSocket Events

#### onOpen

```typescript
onOpen: (event, ws) => {
  // 1. Extract topicId and secret from URL
  // 2. Verify HMAC authentication
  // 3. Register connection in topic registry
  // 4. Send initial state if topic has content
  // 5. Log connection establishment
}
```

#### onMessage

```typescript
onMessage: (event, ws) => {
  // 1. Parse JSON message
  // 2. Validate message format
  // 3. Check permissions for operation
  // 4. Execute business logic (store/broadcast)
  // 5. Update lastActivity timestamp
}
```

#### onClose

```typescript
onClose: (event, ws) => {
  // 1. Remove connection from topic registry
  // 2. Clean up associated resources
  // 3. Close BroadcastChannel if no connections remain
  // 4. Log disconnection
}
```

#### onError

```typescript
onError: (event, ws) => {
  // 1. Log error details
  // 2. Send error response if connection still active
  // 3. Clean up connection registry
  // 4. Monitor for recurring issues
}
```

This contract ensures consistent WebSocket behavior for real-time presentation features while maintaining security and performance requirements.