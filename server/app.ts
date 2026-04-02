import { onAirResource, slideResource } from "./resources.ts";
import { createRouterForResource } from "./createRouter.ts";
import { app as verifyApp } from "./sign/hono.ts";

import { Hono } from "@hono/hono";

const slideApp = createRouterForResource(slideResource);
const onAirApp = createRouterForResource(onAirResource);

const app = new Hono()
  .route("/api/slide", slideApp)
  .route("/api/on-air", onAirApp)
  .route("/api", verifyApp);

export default app;
export type AppType = typeof app;
