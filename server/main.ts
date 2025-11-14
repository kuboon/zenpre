import { Hono } from "@hono/hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

// Define validation schemas using Zod
const postSchema = z.object({
  title: z.string().min(1, "Title is required"),
  content: z.string().min(1, "Content is required"),
  published: z.boolean().optional().default(false),
});

// Create a route for the RPC
const apiRoutes = new Hono().basePath("/api")
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

// Export the app type for RPC client
export type AppType = typeof apiRoutes;

// Export the Hono app for use as middleware
export async function myServer(req: Request, next: (req: Request) => Promise<Response>): Promise<Response> {
  const res = await apiRoutes.fetch(req);
  if (res.status !== 404) return res;
  return next(req);
}
