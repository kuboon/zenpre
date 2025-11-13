<!--
  SYNC IMPACT REPORT
  ==================
  Version change: INITIAL → 1.0.0
  New constitution creation with 5 core principles:
  - I. Modern Runtime Platform (Deno + JSR)
  - II. Frontend Build System (Lume-based)
  - III. Backend API Architecture (Hono.js)
  - IV. Data Storage Abstraction (Deno KV with abstraction layer)
  - V. Japanese-First Development

  Templates requiring updates: ✅ reviewed, no changes needed
  - .specify/templates/plan-template.md (Constitution Check section compatible)
  - .specify/templates/spec-template.md (no direct constitution dependencies)
  - .specify/templates/tasks-template.md (task organization aligns with principles)

  Follow-up TODOs: None
-->

# ZenPre Constitution

## Core Principles

### I. Modern Runtime Platform

All development MUST use Deno as the runtime environment with JSR as the primary
package registry. Libraries and modules MUST be published to JSR for
reusability. Node.js dependencies are discouraged unless absolutely necessary
for interoperability. All code MUST leverage Deno's built-in capabilities
(TypeScript, web standards, security model) rather than external polyfills.

**Rationale**: Ensures modern development experience, security-first approach,
and simplified dependency management through Deno's standards-compliant runtime.

### II. Frontend Build System

All frontend builds MUST use Lume as the static site generator. UI components
MUST be built with JSX/TSX using Lume's plugin ecosystem. CSS MUST be processed
through Tailwind CSS via Lume plugins. Frontend assets MUST be optimized through
Lume's built-in transformation pipeline (images, scripts, styles).

**Rationale**: Provides consistent, optimized build process while maintaining
simplicity and leveraging Deno ecosystem integration.

### III. Backend API Architecture

All backend APIs MUST be implemented using Hono.js framework. APIs MUST follow
RESTful principles or documented RPC patterns. Middleware MUST be used for
cross-cutting concerns (authentication, logging, validation). API responses MUST
be consistently structured with proper HTTP status codes and error handling.

**Rationale**: Ensures lightweight, performant API layer with consistent
patterns and excellent TypeScript support within the Deno ecosystem.

### IV. Data Storage Abstraction

All data access MUST go through an abstraction layer that wraps Deno KV. Direct
Deno KV calls are prohibited in business logic; only the data access layer may
interact with KV directly. The abstraction MUST support easy migration to
alternative storage solutions. Data models MUST be strongly typed with
validation at the abstraction boundary.

**Rationale**: Enables future migration to different storage solutions while
maintaining clean separation of concerns and testability.

### V. Japanese-First Development

Primary user interface and documentation MUST be in Japanese. Code comments and
commit messages MAY be in English for international collaboration. User-facing
error messages MUST be in Japanese. Internationalization support is optional
unless explicitly required.

**Rationale**: Serves the primary target audience effectively while maintaining
developer productivity and international contribution capability.

## Technology Constraints

**Required Stack**: Deno runtime, JSR package registry, Lume for frontend
builds, Hono.js for backend APIs, Deno KV for storage, TypeScript for type
safety.

**Forbidden**: Node.js runtime in production, direct database access bypassing
abstraction layer, frontend frameworks other than Lume's JSX implementation.

**Performance Standards**: Frontend builds MUST complete under 10 seconds, API
responses MUST have p95 latency under 200ms, storage abstraction MUST add less
than 5ms overhead per operation.

## Development Workflow

All features MUST follow the specification-driven development process defined in
project templates. Code MUST pass TypeScript compilation without errors. Deno
formatting and linting MUST be enforced in CI/CD pipeline.

Feature branches MUST include both frontend and backend components when
applicable. Data model changes MUST include migration strategy through the
storage abstraction layer.

## Governance

This constitution supersedes all other development practices and decisions.
Amendments require explicit documentation of breaking changes, migration path,
and approval through pull request review. All feature implementations MUST
verify compliance with these principles before merging.

Complexity that violates these principles MUST be explicitly justified with
technical reasoning and approved by maintainers. When in doubt, choose the
solution that best aligns with Deno ecosystem patterns and Japanese user needs.

**Version**: 1.0.0 | **Ratified**: 2025-11-13 | **Last Amended**: 2025-11-13
