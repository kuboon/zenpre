import { Hono } from "npm:hono@4.6.14";
import { zValidator } from "npm:@hono/zod-validator@0.3.0";
import { z } from "npm:zod@3.24.1";

// Create the main app
const app = new Hono();

// Define validation schemas using Zod
const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  published: z.boolean().optional().default(false),
});

// Create a route for the RPC
const apiRoutes = new Hono()
  // Sample POST endpoint with Zod validation
  .post("/posts", zValidator("json", postSchema), (c) => {
    const data = c.req.valid("json");
    
    // In a real application, you would save this to a database
    const post = {
      id: Math.random().toString(36).substring(7),
      ...data,
      createdAt: new Date().toISOString(),
    };
    
    return c.json({
      success: true,
      data: post,
    }, 201);
  })
  // GET endpoint to retrieve posts
  .get("/posts", (c) => {
    // Mock data for demonstration
    const posts = [
      {
        id: "abc123",
        title: "Sample Post",
        content: "This is a sample post",
        published: true,
        createdAt: new Date().toISOString(),
      },
    ];
    
    return c.json({
      success: true,
      data: posts,
    });
  })
  // GET endpoint to retrieve a specific post
  .get("/posts/:id", (c) => {
    const id = c.req.param("id");
    
    // Mock data for demonstration
    const post = {
      id,
      title: "Sample Post",
      content: "This is a sample post",
      published: true,
      createdAt: new Date().toISOString(),
    };
    
    return c.json({
      success: true,
      data: post,
    });
  });

// Mount the API routes
app.route("/api", apiRoutes);

// Root endpoint
app.get("/", (c) => {
  return c.json({
    message: "Hono.js server with Zod validation and RPC",
    endpoints: {
      posts: {
        create: "POST /api/posts",
        list: "GET /api/posts",
        get: "GET /api/posts/:id",
      },
    },
  });
});

// Export the app type for RPC client
export type AppType = typeof apiRoutes;

// Export the Hono app for use as middleware
export { app };

// Start the server only if this module is run directly
if (import.meta.main) {
  Deno.serve({ port: 8000 }, app.fetch);
  console.log("Server running on http://localhost:8000");
}
