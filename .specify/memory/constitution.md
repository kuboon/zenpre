<!--
  SYNC IMPACT REPORT
  ==================
  Version change: 1.0.0 → 1.0.1
  Modified principles:
  - All sections: Reformatted using pseudocode + bullet points per user request
  - No semantic changes to principles

  Templates requiring updates: ✅ all reviewed
  - .specify/templates/plan-template.md (compatible)
  - .specify/templates/spec-template.md (compatible)
  - .specify/templates/tasks-template.md (compatible)

  Follow-up TODOs: None
-->

# ZenPre Constitution

## Core Principles

### I. Modern Runtime Platform

```pseudocode
MUST use:
  runtime = Deno
  registry = JSR (primary)
  
MUST publish:
  libraries → JSR
  modules → JSR

DISCOURAGED:
  Node.js deps (unless interop required)
  
MUST leverage Deno built-ins:
  - TypeScript (native)
  - Web standards APIs
  - Security model
  - NO external polyfills
```

**Rationale**: Modern DX, security-first, simplified deps via
standards-compliant runtime.

### II. Frontend Build System

```pseudocode
MUST use:
  build_tool = Lume (static site generator)
  
MUST build UI with:
  - JSX/TSX via Lume plugins
  
MUST process CSS:
  - Tailwind CSS via Lume plugins
  
MUST optimize assets via Lume pipeline:
  - images
  - scripts
  - styles
```

**Rationale**: Consistent optimized builds, simplicity, Deno ecosystem
integration.

### III. Backend API Architecture

```pseudocode
MUST implement APIs:
  framework = Hono.js
  
MUST follow:
  - RESTful principles OR
  - Documented RPC patterns
  
MUST use middleware for:
  - authentication
  - logging
  - validation
  
API responses MUST have:
  - Consistent structure
  - Proper HTTP status codes
  - Error handling
```

**Rationale**: Lightweight, performant API layer with TypeScript support in Deno
ecosystem.

### IV. Data Storage Abstraction

```pseudocode
ALL data access:
  business_logic → abstraction_layer → Deno KV
  
PROHIBITED:
  business_logic → Deno KV (direct)
  
abstraction_layer MUST support:
  - Migration to alternative storage
  - Strong typing
  - Validation at boundary
  
ONLY abstraction_layer MAY:
  - Call Deno KV directly
```

**Rationale**: Future migration capability, clean separation, testability.

### V. Japanese-First Development

```pseudocode
MUST be in Japanese:
  - Primary UI
  - User-facing docs
  - Error messages (user-facing)
  
MAY be in English:
  - Code comments (for intl collab)
  - Commit messages (for intl collab)
  
OPTIONAL:
  - i18n support (unless explicitly required)
```

**Rationale**: Primary audience effectiveness + international contribution
capability.

## Technology Constraints

```pseudocode
REQUIRED stack = {
  runtime: Deno,
  registry: JSR,
  frontend: Lume,
  backend: Hono.js,
  storage: Deno KV,
  types: TypeScript
}

FORBIDDEN = {
  Node.js in production,
  Direct DB access (bypass abstraction),
  Frontend frameworks ≠ Lume JSX
}

PERFORMANCE thresholds:
  frontend_build_time < 10s
  api_p95_latency < 200ms
  storage_abstraction_overhead < 5ms
```

## Development Workflow

```pseudocode
FOR each feature:
  MUST follow spec-driven process (project templates)
  MUST pass TypeScript compilation (0 errors)
  MUST pass Deno fmt + lint (CI/CD enforced)
  
  IF has_frontend AND has_backend:
    branch MUST include both components
    
  IF data_model_changes:
    MUST include migration_strategy via abstraction_layer
```

## Governance

```pseudocode
constitution.precedence = MAX (supersedes all practices)

FOR amendment:
  MUST document:
    - Breaking changes
    - Migration path
  MUST get:
    - PR review approval
    
FOR feature_implementation:
  MUST verify constitution_compliance BEFORE merge
  
IF violates_principles:
  MUST provide:
    - Technical justification
    - Maintainer approval
    
WHEN in_doubt:
  CHOOSE solution WITH:
    - MAX(alignment_to_deno_patterns)
    - MAX(japanese_user_fit)
```

**Version**: 1.0.1 | **Ratified**: 2025-11-13 | **Last Amended**: 2025-11-22
