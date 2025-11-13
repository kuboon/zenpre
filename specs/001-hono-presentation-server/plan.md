# Implementation Plan: Real-time Presentation Server with WebSocket Pub-Sub

**Branch**: `001-hono-presentation-server` | **Date**: November 13, 2025 | **Spec**: [link](spec.md)
**Input**: Feature specification from `/specs/001-hono-presentation-server/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See
`.specify/templates/commands/plan.md` for the execution workflow.

## Summary

Implement a real-time presentation server using Hono.js that enables presenters to share markdown content with multiple participants via WebSocket connections. The system provides HTTP APIs for topic creation and authentication, WebSocket connections for real-time updates, and Deno KV for content persistence with HMAC-based access control.

## Technical Context

**Language/Version**: TypeScript with Deno 2.x runtime\
**Primary Dependencies**: Hono.js for HTTP/WebSocket API, Deno KV for storage, Web Crypto API for HMAC authentication\
**Storage**: Deno KV for topic content and metadata with 7-day expiration\
**Testing**: Deno test framework with WebSocket testing utilities\
**Target Platform**: Deno runtime server environment with WebSocket support\
**Project Type**: Web application with backend API and real-time WebSocket communication\
**Performance Goals**: <100ms message broadcast latency, 50+ concurrent connections per topic, <200ms API response time\
**Constraints**: <1MB content payload limit, 7-day content expiration, HMAC authentication required\
**Scale/Scope**: Support multiple concurrent presentation topics, hundreds of participants across topics

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Initial Check (Before Phase 0)
✅ **I. Modern Runtime Platform**: Uses Deno runtime with TypeScript, leverages built-in Web Crypto API and WebSocket support
✅ **II. Frontend Build System**: N/A - This is a backend API service only  
✅ **III. Backend API Architecture**: Uses Hono.js framework with RESTful HTTP endpoints and WebSocket upgrade handling
✅ **IV. Data Storage Abstraction**: Will implement abstraction layer over Deno KV for topic storage and content persistence
✅ **V. Japanese-First Development**: Error messages and API responses can be in Japanese where user-facing

### Post-Design Check (After Phase 1)
✅ **I. Modern Runtime Platform**: Confirmed - All dependencies are JSR-compatible, using Deno's built-in WebSocket and Web Crypto APIs
✅ **II. Frontend Build System**: N/A - Backend-only service
✅ **III. Backend API Architecture**: Confirmed - Hono.js with proper middleware pipeline, RESTful endpoints, consistent error responses
✅ **IV. Data Storage Abstraction**: Confirmed - Designed complete abstraction layer (`StorageAbstraction<T>` interface) wrapping Deno KV
✅ **V. Japanese-First Development**: Confirmed - Error messages structure supports Japanese localization

**Performance Standards Check**:
- API responses target <200ms (meets <200ms p95 requirement) ✅
- Storage abstraction designed with minimal overhead (<5ms per operation) ✅
- Build not applicable for backend-only service ✅

All constitution principles remain satisfied. The detailed design reinforces compliance with all requirements.

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
src/
├── api/
│   ├── topics.ts          # HTTP endpoints for topic CRUD
│   ├── websocket.ts       # WebSocket connection handling
│   └── middleware.ts      # CORS, authentication middleware
├── storage/
│   ├── abstraction.ts     # Deno KV abstraction layer
│   ├── topic-store.ts     # Topic data access layer
│   └── types.ts           # Storage type definitions
├── auth/
│   ├── crypto.ts          # HMAC generation and verification
│   └── types.ts           # Authentication type definitions
├── models/
│   └── topic.ts           # Topic domain models and validation
├── services/
│   ├── topic-service.ts   # Business logic for topics
│   └── broadcast-service.ts # WebSocket message broadcasting
├── utils/
│   └── validation.ts      # Content validation utilities
└── server.ts              # Main Hono application entry point

tests/
├── integration/
│   ├── api-topics.test.ts      # HTTP API integration tests
│   ├── websocket.test.ts       # WebSocket integration tests
│   └── end-to-end.test.ts      # Full system tests
├── unit/
│   ├── auth.test.ts            # Authentication unit tests
│   ├── storage.test.ts         # Storage abstraction tests
│   └── services.test.ts        # Business logic tests
└── fixtures/
    └── test-data.ts            # Test data and helpers
```

**Structure Decision**: Single project structure with clear separation of concerns. The API layer handles HTTP and WebSocket endpoints, storage layer provides Deno KV abstraction, auth layer manages HMAC security, and services layer contains business logic. This aligns with constitution requirements for Hono.js backend architecture and data storage abstraction.

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation                  | Why Needed         | Simpler Alternative Rejected Because |
| -------------------------- | ------------------ | ------------------------------------ |
| [e.g., 4th project]        | [current need]     | [why 3 projects insufficient]        |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient]  |
