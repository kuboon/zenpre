#!/usr/bin/env -S deno run --allow-net --allow-env --unstable-kv

/**
 * Standalone server runner for development and testing
 */

import { Hono } from "@hono/hono";
import type { Context } from "@hono/hono";
import { topicsRouter } from "./routes/api/topics.ts";

const app = new Hono();

// Root endpoint
app.get("/", (c: Context) => {
  return c.json({
    message: "Real-time Presentation Server",
    version: "1.0.0",
    endpoints: {
      createTopic: "POST /api/topics",
      getTopic: "GET /api/topics/:topicId",
      updateTopic: "POST /api/topics/:topicId?secret=<secret>",
      websocket: "ws://localhost:8000/api/topics/:topicId[?secret=<secret>]",
    },
  });
});

// Mount API routes
app.route("/api/topics", topicsRouter);

const port = parseInt(Deno.env.get("PORT") || "8000");

console.log(`🚀 Server starting on http://localhost:${port}`);
console.log(
  `📡 WebSocket endpoint: ws://localhost:${port}/api/topics/:topicId`,
);

Deno.serve({ port }, app.fetch);
