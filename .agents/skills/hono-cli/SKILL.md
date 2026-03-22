---
name: hono-cli
description: Guidance for using the Hono CLI (@hono/cli). Use this when building, testing, or serving Hono applications, especially when looking up Hono documentation, testing routes without a network server, or optimizing a Hono app build.
---

# Hono CLI Skill

This skill provides guidance on using the Hono CLI (`@hono/cli`), a specialized
tool for interacting with the Hono framework.

## Installation

Ensure the CLI is installed in the project or globally:
`npm install -D @hono/cli` or `npm install -g @hono/cli`

## Core Commands and Usage

### 1. Documentation Access (`hono docs`)

The CLI provides built-in access to Hono documentation. This is especially
useful for quickly referencing API details.

- `npx hono docs [path]`: Displays specific documentation pages.
  - Example: `npx hono docs /docs/api/context`
- `npx hono docs llms.txt`: Outputs a summary of the documentation optimized for
  AI context.

### 2. Fast Route Testing (`hono request`)

Test routes using Hono's internal `app.request()` method without starting a full
network server. This is faster and simpler for local testing.

- `npx hono request <file>`: Sends a request to the default exported app in the
  specified file.
- **Options:**
  - `-X, --method <method>`: HTTP Method (e.g., GET, POST)
  - `-P, --path <path>`: Request path (default: `/`)
  - `-d, --data <data>`: Request body data
  - `-H, --header <header>`: Request headers (can be used multiple times)
  - `-w, --watch`: Automatically re-run requests on file changes.
- Example:
  `npx hono request src/index.ts -X POST -P /api/users -d '{"name": "test"}' -H "Content-Type: application/json"`

### 3. Development Server (`hono serve`)

Start a specialized development server with built-in TypeScript and JSX support.

- `npx hono serve <entry_file>`
- **Options:**
  - `--show-routes`: Visualize the application's routing table on startup.
  - `--use <middleware>`: Inject middleware directly from the CLI (e.g.,
    `--use 'cors()'`).

### 4. Smart Optimization (`hono optimize`)

Optimize the Hono application by stripping unused APIs, significantly reducing
bundle size.

- `npx hono optimize <entry_file>`
- This removes unused request body APIs, context response utilities, and
  initialization methods from the final bundle.

### 5. Documentation Search (`hono search`)

Perform a fuzzy search of Hono documentation.

- `npx hono search <query>`
- Outputs JSON by default. Use `--pretty` for human-readable output.

## Recommended Workflows

1. **Exploring APIs:** If you need to know how a specific Hono feature works
   (e.g., context, routing, middleware), use `hono docs /docs/api/<feature>`
   before writing code.
2. **Iterative Testing:** When developing a new route, use
   `hono request <file> --watch -P <path>` to quickly verify the response
   behavior as you code, without needing to set up a full server or external
   HTTP client.
3. **Deployment Prep:** Before deploying or building the final bundle, consider
   running `hono optimize` to minimize the footprint of the Hono application.
