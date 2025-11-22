# Implementation Plan: Real-time Presentation Server with WebSocket Pub-Sub

**Branch**: `001-hono-presentation-server` | **Date**: November 14, 2025 |
**Spec**: [spec.md](./spec.md) **Input**: Feature specification from
`/specs/001-hono-presentation-server/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See
`.specify/templates/commands/plan.md` for the execution workflow.

## Summary

```pseudocode
IMPLEMENT realtime_presentation_server:
  replicate: deno-pubsub functionality
  framework: Hono.js
  
  features = {
    WebSocket pub-sub: markdown content sync,
    auth: HMAC-based topic management,
    storage: Deno KV (presenter ↔ participants)
  }
```

## Technical Context

```pseudocode
STACK:
  runtime: Deno 2.x + TypeScript
  dependencies: {
    Hono.js: HTTP/WebSocket API,
    Deno KV: storage,
    Web Crypto API: HMAC auth
  }
  storage: Deno KV WITH abstraction_layer (future migration)
  testing: Deno test + WebSocket utilities
  platform: Deno runtime (cross-platform server)
  project_type: backend API + realtime WebSocket
  
GOALS:
  concurrent_connections: 50+ per topic
  message_propagation: <100ms
  api_response: <200ms
  
CONSTRAINTS:
  - Follow ZenPre constitution
  - Deno ecosystem only
  - Storage abstraction layer MUST
  
SCOPE: medium-scale realtime app
       (multiple concurrent presentation sessions)
```

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

```pseudocode
CHECK constitution_compliance:
  ✓ I. Modern Runtime Platform:
      runtime = Deno 2.x + TypeScript
      APIs = Web standards (WebSocket, Web Crypto, BroadcastChannel, Deno KV)
      
  ✓ III. Backend API Architecture:
      framework = Hono.js
      patterns = RESTful + middleware + error_handling
      
  ✓ IV. Data Storage Abstraction:
      interface = StorageAbstraction<T>
      implementation = wraps Deno KV
      documented_in = data-model.md
      
  ✓ V. Japanese-First Development:
      error_messages = Japanese
      user_facing_content = Japanese
      
  ✗ II. Frontend Build System:
      reason = backend-only (not applicable)

GATE status: ✓ PASSED
  (all applicable principles satisfied)
```

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
server/
├── main.ts              # Hono.js application entrypoint 
├── routes/
│   └── api/
│       └── topics.ts    # Topic creation/management and WebSocket endpoints
├── services/
│   ├── topic-service.ts # Topic business logic
│   ├── auth-service.ts  # HMAC authentication
│   └── broadcast-service.ts # BroadcastChannel message distribution
├── models/
│   └── topic.ts         # Topic data model  
├── storage/
│   ├── abstraction.ts   # Storage abstraction interface
│   └── kv-storage.ts    # Deno KV implementation
└── utils/
    ├── crypto.ts        # HMAC and token utilities
    └── validation.ts    # Input validation

tests/
├── integration/
│   ├── api-endpoints.test.ts
│   ├── websocket-flow.test.ts
│   └── topic-lifecycle.test.ts
├── unit/
│   ├── services/
│   ├── models/
│   └── utils/
└── fixtures/
    └── test-data.ts
```

**Structure Decision**: Single backend project structure under `server/`
directory following Hono.js patterns with clean separation of concerns. The
main.ts entrypoint initializes the Hono application and configures all routes
and middleware. Services layer handles business logic, models define data
structures, storage provides KV abstraction, and utils contain shared
functionality. WebSocket connections use BroadcastChannel for message
distribution across Deno Deploy's edge runtime without connection tracking.

## Implementation Status

### Phase 0: Research ✅ Complete

- Technical decisions documented in [research.md](./research.md)
- All NEEDS CLARIFICATION items resolved
- Technology choices validated against constitution

### Phase 1: Design ✅ Complete

- Data models defined in [data-model.md](./data-model.md)
- API contracts specified in [contracts/](./contracts/)
- Implementation guide available in [quickstart.md](./quickstart.md)
- Agent context updated with new technology stack

### Phase 2: Ready for Implementation

- All planning artifacts complete
- Constitution compliance verified
- Project structure defined with server/ directory
- Ready for development following quickstart guide
