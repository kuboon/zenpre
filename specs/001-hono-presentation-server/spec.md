# Feature Specification: Real-time Presentation Server with WebSocket Pub-Sub

**Feature Branch**: `001-hono-presentation-server`\
**Created**: November 13, 2025\
**Status**: Draft\
**Input**: User description:
"https://github.com/kuboon/deno-pubsub/blob/main/routes/presen/%5BtopicId%5D.tsx
これと同じ機能を hono server に実装する"

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Presentation Topic Creation and Access (Priority: P1)

```pseudocode
PRESENTER creates new_topic:
  POST /api/topics
  ← {topicId, secret, viewer_url}
  
WHY P1: topic作成なし → presentation不可能

INDEPENDENT test:
  POST /api/topics → credentials受信
  GET with/without secret → access確認
  ✓ pub-sub infrastructure確立
```

**Acceptance**:

```pseudocode
1. GIVEN server running
   WHEN POST /api/topics
   THEN ← {topicId, secret}
   
2. GIVEN valid {topicId, secret}
   WHEN GET /api/topics/{topicId}?secret={secret}
   THEN access_level = writable
   
3. GIVEN valid topicId (no secret)
   WHEN GET /api/topics/{topicId}
   THEN access_level = readable
```

---

### User Story 2 - Real-time Markdown Content Synchronization (Priority: P1)

```pseudocode
PRESENTER edits markdown:
  content → WebSocket → ALL participants (realtime)
  
WHY P1: リアルタイム同期 = システムの主価値

INDEPENDENT test:
  presenter_ws.send(markdown)
  → viewer_ws.receive(markdown)
  ✓ realtime sync確認
```

**Acceptance**:

```pseudocode
1. GIVEN presenter WITH write_access
   WHEN POST markdown
   THEN storage.save(content)
        AND broadcast(content, ALL_ws_clients)
   
2. GIVEN participants[] connected via WebSocket
   WHEN presenter.send(markdown_update)
   THEN FOR EACH p IN participants:
          p.receive(markdown_update) (immediately)
   
3. GIVEN new_participant joins active_session
   WHEN new_participant.connect(WebSocket)
   THEN new_participant.receive(current_markdown_state)
```

---

### User Story 3 - WebSocket Connection Management (Priority: P1)

```pseudocode
PARTICIPANTS connect via WebSocket:
  publisher (with secret) → write access
  viewer (no secret) → read-only access
  
WHY P1: WebSocket管理なし → リアルタイム機能なし

INDEPENDENT test:
  connect(different_access_levels)
  → verify routing + lifecycle
```

**Acceptance**:

```pseudocode
1. GIVEN valid topicId (no secret)
   WHEN participant.connect(WebSocket)
   THEN access_level = read_only
        CAN receive updates
   
2. GIVEN valid {topicId, secret}
   WHEN presenter.connect(WebSocket)  
   THEN access_level = writable
        CAN publish updates
   
3. GIVEN connections[] established
   WHEN connection.close() OR disconnect
   THEN cleanup_resources(connection)
        remove_from_registry(connection)
```

---

### User Story 4 - Topic Authentication and Access Control (Priority: P2)

```pseudocode
SYSTEM validates access:
  HMAC_verify(secret) → writable OR readable OR invalid
  authorized_only CAN modify
  public CAN read
  
WHY P2: セキュリティ重要 BUT 基本機能後に実装可

INDEPENDENT test:
  attempt_access(valid/invalid secrets)
  → verify enforcement
```

**Acceptance**:

```pseudocode
1. GIVEN invalid_secret OR missing_secret
   WHEN attempt write_operation
   THEN RETURN 403 Forbidden
   
2. GIVEN valid_secret
   WHEN attempt write_operation
   THEN ALLOW content_updates
   
3. GIVEN expired_secret OR tampered_secret
   WHEN attempt access
   THEN RETURN appropriate_error
```

---

### User Story 5 - Data Persistence and Retrieval (Priority: P2)

```pseudocode
CONTENT persistence:
  storage.save(content, TTL = configurable)
  retrieval BY topicId → session continuity
  
WHY P2: UX向上 BUT リアルタイム機能はpersistenceなしで動作可

INDEPENDENT test:
  save → restart_server → retrieve
  ✓ persistence確認
```

**Acceptance**:

```pseudocode
1. GIVEN content published
   WHEN storage.save(content)
   THEN accessible UNTIL expiration_period
   
2. GIVEN topic HAS stored_content
   WHEN new_participants.join()
   THEN receive current_state (immediately)
   
3. GIVEN content expired
   WHEN attempt access(expired_topic)
   THEN RETURN 404 Not Found
```

---

### Edge Cases

```pseudocode
EDGE case_handling:
  - WebSocket fail/disconnect unexpectedly?
    → cleanup + reconnect_logic
    
  - Concurrent updates (same secret, multiple publishers)?
    → last_write_wins OR conflict_resolution
    
  - Storage quota exceeded OR persistence fails?
    → fallback + error_response
    
  - Malformed/oversized content?
    → validation + 413/400 errors
    
  - Non-existent topicId access?
    → 404 Not Found
```

## Requirements _(mandatory)_

### Functional Requirements

```pseudocode
SYSTEM MUST provide:
  FR-001: POST /api/topics → {topicId, secret}
  FR-002: storage.{save, retrieve}(markdown, topicId)
  FR-003: WebSocket connections (presenter ↔ participants)
  FR-004: HMAC_verify(secret) → authentication
  FR-005: broadcast(updates, ALL_clients[topicId])
  FR-006: access_levels = {read_only, write_enabled}
  FR-007: crypto.secure_random({topicId, secret})
  FR-008: persist(content, TTL = configurable)
  FR-009: CORS support (cross-origin WebSocket + HTTP)
  FR-010: WebSocket lifecycle = {connect, disconnect, error}
  FR-011: validate(content) BEFORE {storage, broadcast}
         → format + size_limits
  FR-012: message_distribution via BroadcastChannel
```

### Key Entities

```pseudocode
ENTITIES:
  Topic = {
    id: unique_identifier,
    secret: auth_credential,
    content: markdown
  }
  
  Publisher = {
    access: write,
    CAN: {modify, broadcast}
  }
  
  Participant = {
    access: read_only,
    CAN: receive_updates
  }
  
  WebSocket_Connection = {
    channel: server ↔ client,
    bound_to: {topic, access_level}
  }
  
  Presentation_Content = {
    format: markdown,
    metadata: {timestamps, formatting}
  }
```

## Success Criteria _(mandatory)_

### Measurable Outcomes

```pseudocode
PERFORMANCE thresholds:
  SC-001: message_propagation < 100ms
          (publisher → all participants)
  
  SC-002: concurrent_connections ≥ 50 per topic
          (no degradation)
  
  SC-003: topic_creation + auth_verify < 200ms
          (normal load)
  
  SC-004: content_persistence = configurable_TTL
          (default: 7 days, reliable)
  
  SC-005: network_disruption → auto_reconnect
          (graceful recovery)
  
  SC-006: content_payload ≤ 1MB
          (non-blocking)
  
  SC-007: uptime = 99%
          (realtime delivery, active sessions)
```
