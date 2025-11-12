# Hono.js Server

This directory contains a Hono.js server with Zod validation and RPC capabilities.

## Features

- **Hono.js**: Fast, lightweight web framework for edge
- **Zod**: TypeScript-first schema validation
- **RPC**: Type-safe RPC using Hono's RPC client

## File Structure

```
server/
├── main.ts    # Main server file with API routes
├── client.ts  # RPC client example
└── README.md  # This file
```

## Running the Server

```bash
deno task server
```

The server will start on `http://localhost:8000`.

## Running Tests

```bash
# In one terminal, start the server
deno task server

# In another terminal, run the tests
deno task server:test
```

Or use the provided test script that handles server startup:
```bash
deno run --allow-net --unsafely-ignore-certificate-errors server/test.ts
```

## API Endpoints

### Root
- `GET /` - Server information and available endpoints

### Posts API
- `POST /api/posts` - Create a new post
  - Request body:
    ```json
    {
      "title": "string (required)",
      "content": "string (required)",
      "published": "boolean (optional, default: false)"
    }
    ```

- `GET /api/posts` - Get all posts
- `GET /api/posts/:id` - Get a specific post by ID

## Using the RPC Client

The RPC client provides type-safe access to the API:

```bash
deno task server:client
```

Or in your code:

```typescript
import { hc } from "npm:hono@4.6.14/client";
import type { AppType } from "./server/main.ts";

const client = hc<AppType>("http://localhost:8000/api");

// Create a post with type safety
const response = await client.posts.$post({
  json: {
    title: "My Post",
    content: "Post content",
    published: true,
  },
});

const result = await response.json();
```

## Validation

All POST requests are validated using Zod schemas. Invalid requests will return a 400 error with details about the validation failure.

Example validation error:
```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "path": ["title"],
        "message": "Title is required"
      }
    ]
  }
}
```

## Development

To add new endpoints:

1. Define a Zod schema for validation
2. Add the route to the `apiRoutes` in `main.ts`
3. The type will be automatically available in the RPC client
