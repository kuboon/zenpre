# Data Model: Real-time Presentation Server

**Date**: November 13, 2025\
**Feature**: Real-time Presentation Server with WebSocket Pub-Sub

## Core Entities

### Topic

```pseudocode
ENTITY Topic:
  topicId: string           // ULID (unique)
  secret: string            // HMAC auth (base64url)
  markdown: string          // presentation content
  createdAt: Date
  updatedAt: Date           // auto-update on modification
  expiresAt: Date           // TTL = 90 days from creation
  
VALIDATION:
  markdown.size ≤ 1MB (1,048,576 bytes)
  updatedAt = auto_set ON content_modification
  
STORAGE:
  key_pattern = ["topic", topicId]
```

### WebSocket Connection

```pseudocode
ENTITY WebSocket_Connection:
  connectionId: string      // UUID (unique)
  topicId: string          // associated topic
  accessLevel: enum        // "readable" | "writable"
  connectedAt: Date        // connection start
  lastActivity: Date       // last message timestamp
  
VALIDATION:
  accessLevel = HMAC_verify(secret) ? "writable" : "readable"
  connectedAt = auto_set ON WebSocket.connect
  lastActivity = auto_update ON message_{send,receive}
```

### Message

```pseudocode
ENTITY Message:  // via BroadcastChannel (Deno native)
  type: enum               // "content" | "meta"
  topicId: string         // broadcast target
  data: union             // ContentMessage | MetaMessage
  timestamp: Date         // auto-set
  senderId: string        // connection ID (optional)
  
TYPES:
  ContentMessage = {
    markdown: string
  }
  
  MetaMessage = {
    currentPage?: number,
    currentSection?: number,
    reaction?: {
      emoji: string,
      timestamp: number
    }
  }
  
VALIDATION:
  type IN ["content", "meta"]
  IF type = "content":
    data.markdown.size ≤ 1MB
  timestamp = auto_set ON create
  senderId = optional (anonymous broadcast)
  
STORAGE: NOT persisted (BroadcastChannel only)
```

## Data Relationships

```pseudocode
RELATIONS:
  Topic (1) ↔ (many) WebSocket_Connections
    ├─ contains: {markdown, access_control}
    └─ lifecycle: independent
    
  WebSocket_Connection (many) → (many) Messages
    ├─ broadcasts: {content_updates, meta_info}
    └─ via: BroadcastChannel[topicId]
    
  BroadcastChannel[topicId] → ALL Connections[topicId]
    └─ distribution: topic-scoped message routing
```

## State Transitions

### Topic Lifecycle

```pseudocode
[Create] → [Active] → [Expired/Deleted]
   ↓         ↓
[Store]   [Update_Content]
             ↓
         [Broadcast → Connections]
```

### Connection Lifecycle

```pseudocode
[WebSocket.Open] → [Authenticate] → [Active] → [Closed]
       ↓              ↓               ↓
   [Register]    [Set_Access_Level]  [Broadcast/Receive]
                                          Messages
```

### Message Flow

```pseudocode
[Publisher.Send] → [Validate] → [Store_Content] → [Broadcast] → [Subscribers.Receive]
                       ↓              ↓                ↓
                  [Size/Format]  [Update_Topic]  [BroadcastChannel]
```

## Storage Implementation

### Deno KV Schema

```pseudocode
KV_STORAGE:
  // Topic storage
  key = ["topic", topicId: string]
  value = {
    markdown: string,
    createdAt: string,  // ISO timestamp
    updatedAt: string   // ISO timestamp
  }
  TTL = 30 days
  
  // Connections/Messages: NOT stored in KV
  // (ephemeral, BroadcastChannel only)
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
