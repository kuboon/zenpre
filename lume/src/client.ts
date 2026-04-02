import type { AppType } from "#/server/app.ts";
import { hc } from "@hono/hono/client";

// Create a typed RPC client
const client = hc<AppType>(location.origin + "/api").api;

// Example usage of the RPC client
export async function exampleUsage() {
  try {
    // Create a new post using the typed client
    console.log("Creating a new post...");
    const createResponse = await client.slide.$post({
      json: {
        id: "abc123",
        key: "my-first-post",
        title: "My First Post",
        markdown: "This is the content of my first post.",
        css: "body { background-color: #f0f0f0; }",
      },
    });

    const createResult = await createResponse.json();
    console.log("Created post:", createResult);

    // Get all posts
    console.log("\nFetching all posts...");
    const listResponse = await client.slide.$get();
    const listResult = await listResponse.json();
    console.log("Posts:", listResult);

    // Get a specific post
    console.log("\nFetching specific post...");
    const getResponse = await client.slide[":id"].$get({
      param: { id: "abc123" },
    });
    const getResult = await getResponse.json();
    console.log("Post:", getResult);
  } catch (error) {
    console.error("Error:", error);
  }
}
