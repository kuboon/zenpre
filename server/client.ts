import { hc } from "npm:hono@4.6.14/client";
import type { AppType } from "./main.ts";

// Create a typed RPC client
const client = hc<AppType>("http://localhost:8000/api");

// Example usage of the RPC client
async function exampleUsage() {
  try {
    // Create a new post using the typed client
    console.log("Creating a new post...");
    const createResponse = await client.posts.$post({
      json: {
        title: "My First Post",
        content: "This is the content of my first post",
        published: true,
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

// Run the example if this file is executed directly
if (import.meta.main) {
  console.log("RPC Client Example\n");
  await exampleUsage();
  Deno.exit(0);
}

export { client };
