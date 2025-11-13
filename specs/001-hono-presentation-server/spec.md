# Feature Specification: Real-time Presentation Server with WebSocket Pub-Sub

**Feature Branch**: `001-hono-presentation-server`\
**Created**: November 13, 2025\
**Status**: Draft\
**Input**: User description: "https://github.com/kuboon/deno-pubsub/blob/main/routes/presen/%5BtopicId%5D.tsx これと同じ機能を hono server に実装する"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Presentation Topic Creation and Access (Priority: P1)

A presenter creates a new presentation topic to host a real-time presentation session. The system generates a unique topic ID with publisher credentials and provides a shareable viewer URL for participants.

**Why this priority**: Core functionality that enables the entire presentation system - without topic creation, no presentations can occur.

**Independent Test**: Can be fully tested by making a POST request to create a topic, receiving topic credentials, and verifying the topic can be accessed via GET request. Delivers immediate value by establishing the basic pub-sub infrastructure.

**Acceptance Scenarios**:

1. **Given** the server is running, **When** a presenter makes a POST request to `/api/topics`, **Then** the system returns a unique topicId and secret for publisher access
2. **Given** a valid topicId and secret, **When** accessing the topic via GET request with secret, **Then** the system returns writable access to stored presentation data
3. **Given** a valid topicId without secret, **When** accessing the topic via GET request, **Then** the system returns readable access to stored presentation data

---

### User Story 2 - Real-time Markdown Content Synchronization (Priority: P1)

A presenter edits markdown content for their presentation and publishes changes that are immediately synchronized to all connected participants via WebSocket connections.

**Why this priority**: Essential core functionality for real-time presentation - the primary value proposition of the system.

**Independent Test**: Can be tested by connecting presenter and viewer WebSockets, publishing markdown content from presenter, and verifying viewers receive the update in real-time.

**Acceptance Scenarios**:

1. **Given** a presenter has write access to a topic, **When** they publish markdown content via POST, **Then** the content is stored and broadcast to all connected WebSocket clients
2. **Given** multiple participants are connected via WebSocket, **When** presenter sends markdown updates, **Then** all participants receive the updated content immediately
3. **Given** new participants join an active session, **When** they connect via WebSocket, **Then** they receive the current markdown content state

---

### User Story 3 - WebSocket Connection Management (Priority: P1)

Participants connect to presentation topics via WebSocket to receive real-time updates, with proper connection handling for publishers vs viewers.

**Why this priority**: Core infrastructure required for real-time functionality - without WebSocket management, no real-time features work.

**Independent Test**: Can be tested by establishing WebSocket connections with different access levels and verifying proper message routing and connection lifecycle management.

**Acceptance Scenarios**:

1. **Given** a valid topicId, **When** a participant connects via WebSocket without secret, **Then** they receive read-only access to presentation updates
2. **Given** a valid topicId and secret, **When** a presenter connects via WebSocket, **Then** they receive write access and can publish updates
3. **Given** WebSocket connections are established, **When** connections close or disconnect, **Then** the system properly cleans up resources

---

### User Story 4 - Topic Authentication and Access Control (Priority: P2)

The system validates topic access using HMAC-based authentication to ensure only authorized publishers can modify content while allowing public read access.

**Why this priority**: Important security feature but not required for basic functionality - can be implemented after core features work.

**Independent Test**: Can be tested by attempting topic access with valid/invalid secrets and verifying proper access control enforcement.

**Acceptance Scenarios**:

1. **Given** an invalid or missing secret, **When** attempting write operations, **Then** the system returns 403 Forbidden
2. **Given** a valid secret, **When** attempting write operations, **Then** the system allows content updates
3. **Given** an expired or tampered secret, **When** attempting access, **Then** the system returns appropriate error response

---

### User Story 5 - Data Persistence and Retrieval (Priority: P2)

Presentation content is persisted with configurable expiration and can be retrieved by topic ID for session continuity.

**Why this priority**: Enhances user experience but basic real-time functionality can work without persistence initially.

**Independent Test**: Can be tested by storing content, restarting the server, and verifying content retrieval from persistent storage.

**Acceptance Scenarios**:

1. **Given** presentation content is published, **When** the content is stored, **Then** it remains accessible until expiration period
2. **Given** a topic has stored content, **When** new participants join, **Then** they receive the current state immediately
3. **Given** content expires, **When** attempting to access expired topics, **Then** the system returns appropriate not found responses

---

### Edge Cases

- What happens when WebSocket connections fail or disconnect unexpectedly?
- How does system handle concurrent updates from multiple publishers with the same secret?
- What happens when storage quota is exceeded or persistence layer fails?
- How does system handle malformed or oversized content submissions?
- What happens when attempting to access non-existent topic IDs?

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST provide HTTP API endpoint to create new presentation topics with unique identifiers and authentication credentials
- **FR-002**: System MUST store and retrieve presentation content (markdown) associated with topic identifiers  
- **FR-003**: System MUST establish WebSocket connections for real-time communication between presenters and participants
- **FR-004**: System MUST authenticate publisher access using HMAC-based verification of topic secrets
- **FR-005**: System MUST broadcast content updates from publishers to all connected WebSocket clients for the same topic
- **FR-006**: System MUST handle both read-only (participant) and write-enabled (presenter) access levels for topics
- **FR-007**: System MUST generate cryptographically secure topic identifiers and authentication secrets
- **FR-008**: System MUST persist presentation content with configurable expiration periods
- **FR-009**: System MUST provide CORS support for cross-origin WebSocket and HTTP requests
- **FR-010**: System MUST handle WebSocket connection lifecycle including connection, disconnection, and error states
- **FR-011**: System MUST validate content format and size limits before storage and broadcast
- **FR-012**: System MUST use BroadcastChannel or equivalent for message distribution across WebSocket connections

### Key Entities

- **Topic**: Represents a presentation session with unique identifier, authentication secret, and associated content
- **Publisher**: Authenticated user with write access to modify and broadcast topic content
- **Participant**: Read-only user who receives real-time updates for a specific topic
- **WebSocket Connection**: Real-time communication channel between server and clients, associated with specific topics and access levels
- **Presentation Content**: Markdown-formatted content associated with topics, including metadata like timestamps and formatting

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Multiple participants can connect to the same presentation topic and receive updates within 100ms of publisher changes
- **SC-002**: System supports at least 50 concurrent WebSocket connections per topic without performance degradation  
- **SC-003**: Topic creation and authentication verification complete within 200ms under normal load
- **SC-004**: Presentation content persists reliably for the configured expiration period (7 days by default)
- **SC-005**: WebSocket connections recover gracefully from temporary network disruptions with automatic reconnection
- **SC-006**: System handles content payloads up to 1MB without blocking other operations
- **SC-007**: 99% uptime for real-time message delivery during active presentation sessions
