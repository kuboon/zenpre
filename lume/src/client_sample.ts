import { hc } from "@hono/hono/client";
import type { AppType } from "../../server/app.ts";

// Create a typed RPC client
const client = hc<AppType>(location.origin + "/api").api;

// Example usage of the RPC client
export async function exampleUsage() {
  try {
    // Create a new post using the typed client
    console.log("Creating a new post...");
    const createResponse = await client.posts.$post({
      json: {
        name: "My First Post",
        age: 25,
      },
    });

    const createResult = await createResponse.json();
    console.log("Created post:", createResult);

    // Get all posts
    console.log("\nFetching all posts...");
    const listResponse = await client.posts.$get();
    const listResult = await listResponse.json();
    console.log("Posts:", listResult);

    // Get a specific post
    console.log("\nFetching specific post...");
    const getResponse = await client.posts[":id"].$get({
      param: { id: "abc123" },
    });
    const getResult = await getResponse.json();
    console.log("Post:", getResult);
  } catch (error) {
    console.error("Error:", error);
  }
}
