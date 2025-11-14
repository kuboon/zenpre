import { Hono } from "@hono/hono";
import { topicsRouter } from "./routes/api/topics.ts";

// Create the main API application
const apiRoutes = new Hono().basePath("/api")
  .route("/topics", topicsRouter);

// Export the app type for RPC client
export type AppType = typeof apiRoutes;

// Export the Hono app for use as middleware
export async function myServer(
  req: Request,
  next: (req: Request) => Promise<Response>,
): Promise<Response> {
  const res = await apiRoutes.fetch(req);
  if (res.status !== 404) return res;
  return next(req);
}
