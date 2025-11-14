/**
 * Integration tests for Topic API endpoints
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = "http://localhost:8000";
const API_URL = `${BASE_URL}/api/topics`;

Deno.test("Topic API - Create topic", async () => {
  const response = await fetch(API_URL, {
    method: "POST",
  });

  assertEquals(response.status, 200);

  const data = await response.json();
  assertExists(data.topicId);
  assertExists(data.secret);
  assertExists(data.subPath);
  assertExists(data.pubPath);

  // Verify topicId format (base64url, 22 characters)
  assertEquals(data.topicId.length, 22);
  assertEquals(data.subPath, `/api/topics/${data.topicId}`);
  assertEquals(
    data.pubPath,
    `/api/topics/${data.topicId}?secret=${data.secret}`,
  );
});

Deno.test("Topic API - Get topic content", async () => {
  // Create a topic first
  const createResponse = await fetch(API_URL, {
    method: "POST",
  });
  const topic = await createResponse.json();

  // Get topic content
  const getResponse = await fetch(`${API_URL}/${topic.topicId}`);
  assertEquals(getResponse.status, 200);

  const content = await getResponse.json();
  assertEquals(content.markdown, "");
  assertExists(content.createdAt);
  assertExists(content.updatedAt);
});

Deno.test("Topic API - Update topic content with valid secret", async () => {
  // Create a topic
  const createResponse = await fetch(API_URL, {
    method: "POST",
  });
  const topic = await createResponse.json();

  // Update content
  const updateResponse = await fetch(
    `${API_URL}/${topic.topicId}?secret=${topic.secret}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        markdown: "# Test Presentation\n\n## Introduction\n\nHello World!",
      }),
    },
  );

  assertEquals(updateResponse.status, 201);

  const updateData = await updateResponse.json();
  assertEquals(updateData.success, true);
  assertExists(updateData.updatedAt);

  // Verify content was updated
  const getResponse = await fetch(`${API_URL}/${topic.topicId}`);
  const content = await getResponse.json();
  assertEquals(
    content.markdown,
    "# Test Presentation\n\n## Introduction\n\nHello World!",
  );
});

Deno.test("Topic API - Update topic content without secret returns 403", async () => {
  // Create a topic
  const createResponse = await fetch(API_URL, {
    method: "POST",
  });
  const topic = await createResponse.json();

  // Try to update without secret
  const updateResponse = await fetch(`${API_URL}/${topic.topicId}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      markdown: "# Unauthorized Update",
    }),
  });

  assertEquals(updateResponse.status, 403);
});

Deno.test("Topic API - Get non-existent topic returns 404", async () => {
  const response = await fetch(`${API_URL}/nonexistenttopicid123`);
  assertEquals(response.status, 404);
});

Deno.test("Topic API - Invalid topic ID format returns 400", async () => {
  const response = await fetch(`${API_URL}/invalid-format`);
  assertEquals(response.status, 400);
});
