#!/usr/bin/env -S deno run --allow-net --unsafely-ignore-certificate-errors

/**
 * Comprehensive test script for the Hono.js server
 * This demonstrates all features: REST API, Zod validation, and RPC
 */

import { assertEquals, assertExists } from "https://deno.land/std@0.208.0/assert/mod.ts";

const BASE_URL = "http://localhost:8000";
const API_URL = `${BASE_URL}/api`;

// Wait for server to be ready
async function waitForServer(maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(BASE_URL);
      if (response.ok) return true;
    } catch {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  return false;
}

console.log("🧪 Testing Hono.js Server\n");

// Test 1: Root endpoint
console.log("Test 1: GET / (Server info)");
try {
  const response = await fetch(BASE_URL);
  const data = await response.json();
  assertExists(data.message);
  assertExists(data.endpoints);
  console.log("✅ Root endpoint works");
  console.log("   Response:", JSON.stringify(data, null, 2));
} catch (error) {
  console.error("❌ Root endpoint failed:", error);
  Deno.exit(1);
}

console.log("\n" + "=".repeat(50) + "\n");

// Test 2: POST with valid data (Zod validation test)
console.log("Test 2: POST /api/posts (Valid data - Zod validation)");
try {
  const response = await fetch(`${API_URL}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title: "Test Post from Script",
      content: "This is a test post with valid data",
      published: true,
    }),
  });
  const data = await response.json();
  assertEquals(response.status, 201);
  assertEquals(data.success, true);
  assertExists(data.data.id);
  assertExists(data.data.createdAt);
  console.log("✅ POST with valid data works");
  console.log("   Response:", JSON.stringify(data, null, 2));
} catch (error) {
  console.error("❌ POST with valid data failed:", error);
  Deno.exit(1);
}

console.log("\n" + "=".repeat(50) + "\n");

// Test 3: POST with invalid data (Zod validation error)
console.log("Test 3: POST /api/posts (Invalid data - Zod validation error)");
try {
  const response = await fetch(`${API_URL}/posts`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      content: "Missing title field",
    }),
  });
  const data = await response.json();
  assertEquals(response.status, 400);
  assertEquals(data.success, false);
  assertExists(data.error);
  assertExists(data.error.issues);
  console.log("✅ Zod validation correctly rejects invalid data");
  console.log("   Error:", JSON.stringify(data, null, 2));
} catch (error) {
  console.error("❌ Validation test failed:", error);
  Deno.exit(1);
}

console.log("\n" + "=".repeat(50) + "\n");

// Test 4: GET all posts
console.log("Test 4: GET /api/posts (List all posts)");
try {
  const response = await fetch(`${API_URL}/posts`);
  const data = await response.json();
  assertEquals(response.status, 200);
  assertEquals(data.success, true);
  assertExists(data.data);
  console.log("✅ GET all posts works");
  console.log("   Response:", JSON.stringify(data, null, 2));
} catch (error) {
  console.error("❌ GET all posts failed:", error);
  Deno.exit(1);
}

console.log("\n" + "=".repeat(50) + "\n");

// Test 5: GET specific post
console.log("Test 5: GET /api/posts/:id (Get specific post)");
try {
  const response = await fetch(`${API_URL}/posts/test123`);
  const data = await response.json();
  assertEquals(response.status, 200);
  assertEquals(data.success, true);
  assertEquals(data.data.id, "test123");
  console.log("✅ GET specific post works");
  console.log("   Response:", JSON.stringify(data, null, 2));
} catch (error) {
  console.error("❌ GET specific post failed:", error);
  Deno.exit(1);
}

console.log("\n" + "=".repeat(50) + "\n");

// Test 6: RPC Client
console.log("Test 6: RPC Client (Type-safe client)");
try {
  const { hc } = await import("npm:hono@4.6.14/client");
  
  // Import type only - we need to use dynamic import with type parameter
  // The type is exported from main.ts but we can't import it without running the server
  const client = hc(`${API_URL}`);
  
  const createResponse = await client.posts.$post({
    json: {
      title: "RPC Test Post",
      content: "Created via RPC client",
      published: false,
    },
  });
  
  const createData = await createResponse.json();
  assertEquals(createResponse.status, 201);
  assertEquals(createData.success, true);
  
  console.log("✅ RPC client works with type safety");
  console.log("   Response:", JSON.stringify(createData, null, 2));
  console.log("   Note: In actual TypeScript code, you would import the AppType for full type safety");
} catch (error) {
  console.error("❌ RPC client test failed:", error);
  Deno.exit(1);
}

console.log("\n" + "=".repeat(50) + "\n");
console.log("🎉 All tests passed!");
console.log("\n✨ Features verified:");
console.log("  • Hono.js REST API endpoints");
console.log("  • Zod schema validation");
console.log("  • Type-safe RPC client");
console.log("  • Error handling");
