# Implementation Plan: Real-time Presentation Server with WebSocket Pub-Sub

**Branch**: `001-hono-presentation-server` | **Date**: November 14, 2025 |
**Spec**: [spec.md](./spec.md) **Input**: Feature specification from
`/specs/001-hono-presentation-server/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See
`.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a real-time presentation server that replicates deno-pubsub
functionality using Hono.js framework. The system provides WebSocket-based
pub-sub for markdown content synchronization between presenters and
participants, with HMAC-based authentication for topic management and Deno KV
for data persistence.

## Technical Context

**Language/Version**: TypeScript with Deno 2.x runtime\
**Primary Dependencies**: Hono.js for HTTP/WebSocket API, Deno KV for storage,
Web Crypto API for HMAC authentication\
**Storage**: Deno KV with abstraction layer for future migration capability\
**Testing**: Deno test framework with WebSocket testing utilities\
**Target Platform**: Deno runtime environment (cross-platform server
deployment)\
**Project Type**: Backend API server with real-time WebSocket capabilities\
**Performance Goals**: Support 50+ concurrent WebSocket connections per topic,
<100ms message propagation, <200ms API response times\
**Constraints**: Follow ZenPre constitution, use only Deno ecosystem, implement
storage abstraction layer\
**Scale/Scope**: Medium-scale real-time application supporting multiple
concurrent presentation sessions

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

✅ **I. Modern Runtime Platform**: Using Deno 2.x runtime with TypeScript,
leveraging built-in Web APIs (WebSocket, Web Crypto, BroadcastChannel, Deno KV)
✅ **III. Backend API Architecture**: Implementing with Hono.js framework
following RESTful principles with proper middleware and error handling ✅ **IV.
Data Storage Abstraction**: Implemented StorageAbstraction<T> interface wrapping
Deno KV as documented in data-model.md ✅ **V. Japanese-First Development**:
Error messages and user-facing content configured for Japanese language

❓ **II. Frontend Build System**: Not applicable - this is backend-only server
implementation

**Gate Status**: ✅ PASSED - All applicable constitution principles satisfied
with concrete implementation plans

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
