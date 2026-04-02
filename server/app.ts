import { slideResource } from "#/server/resources.ts";
import { createRouterForResource } from "#/server/createRouter.ts";
import { Hono } from "@hono/hono";

const slideApp = createRouterForResource(slideResource);

const app = new Hono()
  .route("/api/slide", slideApp);

export default app;
export type AppType = typeof app;
