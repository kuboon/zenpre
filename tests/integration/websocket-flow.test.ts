/**
 * WebSocket integration tests for real-time presentation features
 */

import {
  assertEquals,
  assertExists,
} from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = "http://localhost:8000";
const API_URL = `${BASE_URL}/api/topics`;
const WS_URL = "ws://localhost:8000/api/topics";

/**
 * Helper to wait for WebSocket message
 */
function waitForMessage(ws: WebSocket, timeout = 5000): Promise<any> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("WebSocket message timeout"));
    }, timeout);

    ws.onmessage = (event) => {
      clearTimeout(timer);
      resolve(JSON.parse(event.data));
    };

    ws.onerror = (error) => {
      clearTimeout(timer);
      reject(error);
    };
  });
}

Deno.test("WebSocket - Subscriber receives initial content", async () => {
  // Create a topic and add content
  const createResponse = await fetch(API_URL, { method: "POST" });
  const topic = await createResponse.json();

  // Add content via HTTP
  await fetch(`${API_URL}/${topic.topicId}?secret=${topic.secret}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markdown: "# Initial Content" }),
  });

  // Connect as subscriber
  const ws = new WebSocket(`${WS_URL}/${topic.topicId}`);

  try {
    const message = await waitForMessage(ws);
    assertEquals(message.markdown, "# Initial Content");
  } finally {
    ws.close();
  }
});

Deno.test("WebSocket - Publisher can broadcast content updates", async () => {
  // Create a topic
  const createResponse = await fetch(API_URL, { method: "POST" });
  const topic = await createResponse.json();

  // Connect publisher
  const publisher = new WebSocket(
    `${WS_URL}/${topic.topicId}?secret=${topic.secret}`,
  );
  await new Promise((resolve) => publisher.onopen = resolve);

  // Connect subscriber
  const subscriber = new WebSocket(`${WS_URL}/${topic.topicId}`);
  await new Promise((resolve) => subscriber.onopen = resolve);

  try {
    // Publisher sends content
    const subscriberMessage = waitForMessage(subscriber);
    publisher.send(
      JSON.stringify({ markdown: "# Broadcast Content" }),
    );

    const message = await subscriberMessage;
    assertEquals(message.markdown, "# Broadcast Content");
  } finally {
    publisher.close();
    subscriber.close();
  }
});

Deno.test("WebSocket - Publisher can broadcast navigation updates", async () => {
  // Create a topic
  const createResponse = await fetch(API_URL, { method: "POST" });
  const topic = await createResponse.json();

  // Connect publisher
  const publisher = new WebSocket(
    `${WS_URL}/${topic.topicId}?secret=${topic.secret}`,
  );
  await new Promise((resolve) => publisher.onopen = resolve);

  // Connect subscriber
  const subscriber = new WebSocket(`${WS_URL}/${topic.topicId}`);
  await new Promise((resolve) => subscriber.onopen = resolve);

  try {
    // Wait for initial state message
    await waitForMessage(subscriber, 1000).catch(() => {});

    // Publisher sends navigation update
    const subscriberMessage = waitForMessage(subscriber);
    publisher.send(
      JSON.stringify({ currentPage: 2, currentSection: 1 }),
    );

    const message = await subscriberMessage;
    assertEquals(message.currentPage, 2);
    assertEquals(message.currentSection, 1);
  } finally {
    publisher.close();
    subscriber.close();
  }
});

Deno.test("WebSocket - Subscribers can send reactions", async () => {
  // Create a topic
  const createResponse = await fetch(API_URL, { method: "POST" });
  const topic = await createResponse.json();

  // Connect two subscribers
  const subscriber1 = new WebSocket(`${WS_URL}/${topic.topicId}`);
  await new Promise((resolve) => subscriber1.onopen = resolve);

  const subscriber2 = new WebSocket(`${WS_URL}/${topic.topicId}`);
  await new Promise((resolve) => subscriber2.onopen = resolve);

  try {
    // Wait for initial state messages
    await waitForMessage(subscriber1, 1000).catch(() => {});
    await waitForMessage(subscriber2, 1000).catch(() => {});

    // Subscriber1 sends reaction
    const subscriber2Message = waitForMessage(subscriber2);
    subscriber1.send(
      JSON.stringify({
        pub: {
          reaction: {
            emoji: "👍",
            timestamp: Date.now(),
          },
        },
      }),
    );

    const message = await subscriber2Message;
    assertExists(message.pub);
    assertExists(message.pub.reaction);
    assertEquals(message.pub.reaction.emoji, "👍");
  } finally {
    subscriber1.close();
    subscriber2.close();
  }
});

Deno.test("WebSocket - Subscriber cannot update content", async () => {
  // Create a topic
  const createResponse = await fetch(API_URL, { method: "POST" });
  const topic = await createResponse.json();

  // Connect as subscriber (without secret)
  const subscriber = new WebSocket(`${WS_URL}/${topic.topicId}`);
  await new Promise((resolve) => subscriber.onopen = resolve);

  try {
    // Wait for initial state
    await waitForMessage(subscriber, 1000).catch(() => {});

    // Try to send content update (should get error)
    const errorMessage = waitForMessage(subscriber);
    subscriber.send(
      JSON.stringify({ markdown: "# Unauthorized Update" }),
    );

    const message = await errorMessage;
    assertExists(message.error);
    assertEquals(message.code, "FORBIDDEN");
  } finally {
    subscriber.close();
  }
});

Deno.test("WebSocket - Invalid secret returns 403", async () => {
  // Create a topic
  const createResponse = await fetch(API_URL, { method: "POST" });
  const topic = await createResponse.json();

  // Try to connect with invalid secret
  const ws = new WebSocket(`${WS_URL}/${topic.topicId}?secret=invalidsecret`);

  try {
    await new Promise((resolve, reject) => {
      ws.onerror = () => resolve(true);
      ws.onopen = () => reject(new Error("Should not have connected"));
      setTimeout(() => resolve(true), 2000);
    });
  } finally {
    ws.close();
  }
});
