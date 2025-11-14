# Data Model: Real-time Presentation Server

**Date**: November 13, 2025\
**Feature**: Real-time Presentation Server with WebSocket Pub-Sub

## Core Entities

### Topic

Represents a presentation session with unique identifier and access control.

**Fields**:

- `topicId: string` - Unique identifier (base64url encoded, 16 bytes random)
- `secret: string` - HMAC authentication secret (base64url encoded)
- `markdown: string` - Current presentation content in markdown format
- `createdAt: Date` - Topic creation timestamp
- `updatedAt: Date` - Last content modification timestamp
- `expiresAt: Date` - Automatic expiration timestamp (7 days from creation)

**Validation Rules**:

- `topicId` must be exactly 22 characters (base64url of 16 bytes)
- `secret` must be valid HMAC-SHA256 signature of topicId
- `markdown` content size limited to 1MB (1,048,576 bytes)
- `expiresAt` must be set to 7 days from `createdAt`
- `updatedAt` automatically set on content modifications

**Storage Key Pattern**: `["topic", topicId]`

### WebSocket Connection

Represents active real-time connection to a topic.

**Fields**:

- `connectionId: string` - Unique connection identifier (UUID)
- `topicId: string` - Associated topic identifier
- `accessLevel: "readable" | "writable"` - Permission level based on secret
  verification
- `connectedAt: Date` - Connection establishment timestamp
- `lastActivity: Date` - Last message timestamp

**Validation Rules**:

- `accessLevel` determined by HMAC verification of secret parameter
- `connectedAt` set on WebSocket connection establishment
- `lastActivity` updated on each message send/receive

**Storage**: In-memory only (Map-based registry), not persisted

### Message

Represents real-time messages broadcast between connections.

**Fields**:

- `type: "content" | "meta"` - Message category
- `topicId: string` - Target topic for broadcasting
- `data: ContentMessage | MetaMessage` - Typed message payload
- `timestamp: Date` - Message creation timestamp
- `senderId?: string` - Optional connection identifier of sender

**Message Types**:

```typescript
interface ContentMessage {
  markdown: string;
}

interface MetaMessage {
  currentPage?: number;
  currentSection?: number;
  reaction?: {
    emoji: string;
    timestamp: number;
  };
}
```

**Validation Rules**:

- `type` must be either "content" or "meta"
- `data.markdown` size limited to 1MB when type is "content"
- `timestamp` automatically set on message creation
- `senderId` optional for anonymous broadcasting

**Storage**: Not persisted, broadcast through BroadcastChannel only

## Data Relationships

```
Topic (1) ←→ (many) WebSocket Connections
  │
  └─ Contains: markdown content, access control
  │
WebSocket Connection (many) → (many) Messages
  │
  └─ Broadcasts: content updates, meta information

BroadcastChannel (per topic) → All Connections (for that topic)
```

## State Transitions

### Topic Lifecycle

```
[Create] → [Active] → [Expired/Deleted]
    ↓         ↓
[Store]   [Update Content]
           ↓
       [Broadcast to Connections]
```

### Connection Lifecycle

```
[WebSocket Open] → [Authenticate] → [Active] → [Closed]
       ↓              ↓              ↓
   [Register]     [Set Access]   [Broadcast/Receive]
                     Level           Messages
```

### Message Flow

```
[Publisher Sends] → [Validate] → [Store Content] → [Broadcast] → [Subscribers Receive]
                       ↓              ↓              ↓
                  [Size/Format]  [Update Topic]  [BroadcastChannel]
```

## Storage Implementation

### Deno KV Schema

```typescript
// Topic storage
key: ["topic", topicId: string]
value: {
  markdown: string
  createdAt: string  // ISO timestamp
  updatedAt: string  // ISO timestamp
}
// TTL: 7 days (604800000ms)

// No additional KV storage needed for connections/messages
```

### In-Memory Structures

```typescript
// WebSocket connection registry
connections: Map<string, Map<string, WebSocketConnection>>;
// Key: topicId → Map of connectionId → connection details

// BroadcastChannel registry
channels: Map<string, BroadcastChannel>;
// Key: topicId → BroadcastChannel instance
```

## Validation Schema

### Topic Creation Request

```typescript
interface CreateTopicRequest {
  // No body required - generates topicId and secret
}

interface CreateTopicResponse {
  topicId: string;
  secret: string;
  subPath: string; // Read-only access path
  pubPath: string; // Publisher access path
}
```

### Content Update Request

```typescript
interface UpdateContentRequest {
  markdown: string; // Required, max 1MB
}

interface UpdateContentResponse {
  success: boolean;
  updatedAt: string; // ISO timestamp
}
```

### WebSocket Message Format

```typescript
// Inbound (from clients)
interface WebSocketInbound {
  markdown?: string; // Content update (publisher only)
  currentPage?: number; // Page navigation (publisher only)
  currentSection?: number; // Section navigation (publisher only)
  pub?: { // Subscriber interaction
    reaction: {
      emoji: string;
      timestamp: number;
    };
  };
}

// Outbound (to clients)
interface WebSocketOutbound {
  markdown?: string; // Content broadcast
  currentPage?: number; // Page sync
  currentSection?: number; // Section sync
  pub?: { // Subscriber interaction broadcast
    reaction: {
      emoji: string;
      timestamp: number;
    };
  };
}
```

This data model provides strong typing, validation boundaries, and clear
separation between persisted data (topics) and transient state (connections,
messages) while supporting the real-time presentation requirements.
