# Real-time Presentation Server

This is a Hono.js-based real-time presentation server with WebSocket pub-sub capabilities, implementing the specification from `specs/001-hono-presentation-server/`.

## Features

- **Topic Management**: Create presentation topics with unique IDs and authentication
- **HMAC Authentication**: Secure publisher access using HMAC-SHA256
- **WebSocket Real-time**: Real-time content synchronization via WebSocket
- **Content Updates**: Broadcast markdown content to all connected participants
- **Navigation Sync**: Synchronize page and section navigation
- **Reactions**: Allow participants to send emoji reactions
- **Storage Abstraction**: Deno KV with abstraction layer for future migration
- **Auto-expiration**: Topics automatically expire after 30 days

## Architecture

```
server/
├── main.ts                      # Hono middleware export
├── standalone.ts                # Standalone server runner
├── routes/
│   └── api/
│       └── topics.ts            # HTTP/WebSocket endpoints
├── services/
│   ├── topic-service.ts         # Business logic
│   └── broadcast-service.ts     # Message distribution
├── models/
│   └── topic.ts                 # Data models and types
├── storage/
│   ├── abstraction.ts           # Storage interface
│   └── kv-storage.ts            # Deno KV implementation
└── utils/
    ├── crypto.ts                # HMAC authentication
    └── validation.ts            # Input validation
```

## Getting Started

### Prerequisites

- Deno 2.x runtime
- Environment variable `HMAC_KEY` (optional, generates random key in development)

### Running the Server

#### Standalone Mode

```bash
deno run --allow-net --allow-env --unstable-kv server/standalone.ts
```

#### With Lume Integration

```bash
# Build the static site first
deno task build

# Start integrated server (static + API)
deno task serve
```

The server runs on `http://localhost:8000` with:
- API endpoints at `/api/topics/*`
- WebSocket connections at `ws://localhost:8000/api/topics/:topicId`

## API Documentation

### Create Topic

Create a new presentation topic.

```bash
curl -X POST http://localhost:8000/api/topics
```

**Response:**
```json
{
  "topicId": "abc123def456ghi789jklm",
  "secret": "xyz789abc123def456ghi789jklmnop123",
  "subPath": "/api/topics/abc123def456ghi789jklm",
  "pubPath": "/api/topics/abc123def456ghi789jklm?secret=xyz789abc123def456ghi789jklmnop123"
}
```

### Get Topic Content

Retrieve current presentation content (read-only access).

```bash
curl http://localhost:8000/api/topics/{topicId}
```

**Response:**
```json
{
  "markdown": "# My Presentation\n\n## Content here",
  "createdAt": "2025-11-14T10:00:00.000Z",
  "updatedAt": "2025-11-14T10:15:00.000Z"
}
```

### Update Topic Content

Update presentation content (requires secret for write access).

```bash
curl -X POST \
  "http://localhost:8000/api/topics/{topicId}?secret={secret}" \
  -H "Content-Type: application/json" \
  -d '{"markdown": "# Updated Content"}'
```

**Response:**
```json
{
  "success": true,
  "updatedAt": "2025-11-14T10:16:00.000Z"
}
```

## WebSocket Usage

### Publisher Connection (with secret)

```javascript
const ws = new WebSocket(
  "ws://localhost:8000/api/topics/{topicId}?secret={secret}"
);

ws.onopen = () => {
  // Update content
  ws.send(JSON.stringify({
    markdown: "# Live Update"
  }));

  // Update navigation
  ws.send(JSON.stringify({
    currentPage: 1,
    currentSection: 0
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
};
```

### Subscriber Connection (without secret)

```javascript
const ws = new WebSocket(
  "ws://localhost:8000/api/topics/{topicId}"
);

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  if (data.markdown) {
    // Update presentation view
    console.log("Content updated:", data.markdown);
  }
  
  if (data.currentPage !== undefined) {
    // Sync navigation
    console.log("Page:", data.currentPage);
  }
  
  if (data.pub?.reaction) {
    // Display reaction
    console.log("Reaction:", data.pub.reaction.emoji);
  }
};

// Send reaction (available to all users)
ws.send(JSON.stringify({
  pub: {
    reaction: {
      emoji: "👍",
      timestamp: Date.now()
    }
  }
}));
```

## Message Types

### Content Update (Publisher only)
```json
{
  "markdown": "# Presentation content"
}
```

### Navigation Update (Publisher only)
```json
{
  "currentPage": 2,
  "currentSection": 1
}
```

### Reaction (All users)
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

## Testing

Run integration tests:

```bash
# Start the server in one terminal
deno run --allow-net --allow-env --unstable-kv server/standalone.ts

# Run tests in another terminal
deno test --allow-net tests/integration/
```

## Security

- **HMAC Authentication**: Topics use HMAC-SHA256 for publisher authentication
- **Access Levels**: 
  - `writable`: Full access with valid secret
  - `readable`: Read-only access without secret
  - `invalid`: Rejected with 403 for invalid secrets
- **Content Limits**: 1MB maximum content size
- **Auto-expiration**: Topics expire after 30 days

## Environment Variables

- `HMAC_KEY`: Base64url-encoded HMAC key for authentication (generates random key if not set)
- `PORT`: Server port (default: 8000)

## Constitution Compliance

This implementation follows the ZenPre constitution:

✅ **I. Modern Runtime Platform**: Uses Deno 2.x with Web standards (WebSocket, Web Crypto, BroadcastChannel)  
✅ **III. Backend API Architecture**: Implements Hono.js with RESTful patterns and proper middleware  
✅ **IV. Data Storage Abstraction**: Uses abstraction layer wrapping Deno KV for future migration  
✅ **V. Japanese-First Development**: Error messages ready for Japanese localization

## License

See repository LICENSE file.
