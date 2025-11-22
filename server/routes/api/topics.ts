/**
 * Topic API routes - HTTP endpoints and WebSocket handling
 */

import { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import type { Context } from "@hono/hono";
import { KVStorage } from "../../storage/kv-storage.ts";
import type { StoredTopic } from "../../models/topic.ts";
import { TopicService } from "../../services/topic-service.ts";
import { verifyAccess } from "../../utils/crypto.ts";
import { validateEmoji, validateTopicId } from "../../utils/validation.ts";
import * as broadcastService from "../../services/broadcast-service.ts";
import type {
  CreateTopicResponse,
  WebSocketInbound,
  WebSocketOutbound,
} from "../../models/topic.ts";

// Initialize storage and service
const storage = await KVStorage.create<StoredTopic>();
const topicService = new TopicService(storage);

// Validation schemas
const contentUpdateSchema = z.object({
  markdown: z.string(),
});

export const topicsRouter = new Hono()
  // Create new topic
  .post("/", async (c: Context) => {
    try {
      const pair = await topicService.createTopic();

      const response: CreateTopicResponse = {
        topicId: pair.topicId,
        secret: pair.secret,
        subPath: `/api/topics/${pair.topicId}`,
        pubPath: `/api/topics/${pair.topicId}?secret=${pair.secret}`,
      };

      return c.json(response, 200);
    } catch (error) {
      console.error("Topic creation error:", error);
      return c.json({ error: "Failed to create topic" }, 500);
    }
  })
  // Get topic content or upgrade to WebSocket
  .get("/:topicId", async (c: Context) => {
    const topicId = c.req.param("topicId");
    const secret = c.req.query("secret") || "";

    // Validate topic ID format
    if (!validateTopicId(topicId)) {
      return c.json({ error: "Invalid topic ID format" }, 400);
    }

    // Check for WebSocket upgrade
    const upgrade = c.req.header("upgrade");
    if (upgrade === "websocket") {
      return handleWebSocketUpgrade(c, topicId, secret);
    }

    // Regular HTTP GET - return topic content
    try {
      const topic = await topicService.getTopic(topicId);

      if (!topic) {
        return c.json({ error: "Topic not found" }, 404);
      }

      return c.json({
        markdown: topic.markdown,
        createdAt: topic.createdAt.toISOString(),
        updatedAt: topic.updatedAt.toISOString(),
      });
    } catch (error) {
      console.error("Get topic error:", error);
      return c.json({ error: "Failed to retrieve topic" }, 500);
    }
  })
  // Update topic content
  .post(
    "/:topicId",
    zValidator("json", contentUpdateSchema),
    async (c: Context) => {
      const topicId = c.req.param("topicId");
      const secret = c.req.query("secret") || "";
      const { markdown } = c.req.valid("json");

      // Validate topic ID format
      if (!validateTopicId(topicId)) {
        return c.json({ error: "Invalid topic ID format" }, 400);
      }

      // Verify write access
      const accessLevel = await verifyAccess({ topicId, secret });
      if (accessLevel !== "writable") {
        return c.json({ error: "Forbidden - invalid secret" }, 403);
      }

      try {
        await topicService.updateContent(topicId, markdown);

        // Broadcast update to WebSocket connections
        broadcastService.broadcast(topicId, { markdown });

        return c.json({
          success: true,
          updatedAt: new Date().toISOString(),
        }, 201);
      } catch (error) {
        const message = error instanceof Error
          ? error.message
          : "Unknown error";

        if (message.includes("not found")) {
          return c.json({ error: "Topic not found" }, 404);
        }
        if (message.includes("size limit")) {
          return c.json({ error: "Content exceeds size limit (1MB)" }, 413);
        }

        console.error("Update content error:", error);
        return c.json({ error: "Failed to update content" }, 500);
      }
    },
  );

/**
 * Handle WebSocket upgrade
 */
async function handleWebSocketUpgrade(
  c: Context,
  topicId: string,
  secret: string,
): Promise<Response> {
  // Verify topic exists
  const topicExists = await topicService.topicExists(topicId);
  if (!topicExists) {
    return c.json({ error: "Topic not found" }, 404);
  }

  // Verify access level
  const accessLevel = await verifyAccess({ topicId, secret });
  if (accessLevel === "invalid") {
    return c.json({ error: "Forbidden - invalid secret" }, 403);
  }

  const { socket, response } = Deno.upgradeWebSocket(c.req.raw);

  socket.onopen = async () => {
    console.log(`WebSocket connected: topic=${topicId}, access=${accessLevel}`);

    // Send initial state
    const topic = await topicService.getTopic(topicId);
    if (topic && topic.markdown) {
      socket.send(JSON.stringify({ markdown: topic.markdown }));
    }

    // Subscribe to broadcast messages
    const unsubscribe = broadcastService.subscribe(topicId, (message) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(message));
      }
    });

    // Store unsubscribe function for cleanup
    (socket as any)._unsubscribe = unsubscribe;
  };

  socket.onmessage = async (event) => {
    try {
      const data: WebSocketInbound = JSON.parse(event.data);

      // Handle content update (publisher only)
      if (data.markdown !== undefined) {
        if (accessLevel !== "writable") {
          socket.send(
            JSON.stringify({
              error: "Permission denied",
              code: "FORBIDDEN",
            }),
          );
          return;
        }

        await topicService.updateContent(topicId, data.markdown);
        broadcastService.broadcast(topicId, { markdown: data.markdown });
      }

      // Handle navigation update (publisher only)
      if (
        data.currentPage !== undefined || data.currentSection !== undefined
      ) {
        if (accessLevel !== "writable") {
          socket.send(
            JSON.stringify({
              error: "Permission denied",
              code: "FORBIDDEN",
            }),
          );
          return;
        }

        const message: WebSocketOutbound = {};
        if (data.currentPage !== undefined) {
          message.currentPage = data.currentPage;
        }
        if (data.currentSection !== undefined) {
          message.currentSection = data.currentSection;
        }
        broadcastService.broadcast(topicId, message);
      }

      // Handle reaction (all users)
      if (data.pub?.reaction) {
        if (!validateEmoji(data.pub.reaction.emoji)) {
          socket.send(
            JSON.stringify({
              error: "Invalid emoji",
              code: "INVALID_EMOJI",
            }),
          );
          return;
        }

        broadcastService.broadcast(topicId, { pub: data.pub });
      }
    } catch (error) {
      console.error("WebSocket message error:", error);
      socket.send(
        JSON.stringify({
          error: "Invalid message format",
          code: "INVALID_MESSAGE",
        }),
      );
    }
  };

  socket.onclose = () => {
    console.log(`WebSocket disconnected: topic=${topicId}`);
    // Cleanup subscription
    const unsubscribe = (socket as any)._unsubscribe;
    if (unsubscribe) {
      unsubscribe();
    }
  };

  socket.onerror = (error) => {
    console.error("WebSocket error:", error);
  };

  return response;
}
