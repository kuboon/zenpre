import { Hono } from "@hono/hono";

import { type } from "arktype";
import { sValidator } from "@hono/standard-validator";

const schema = type({
  name: "string",
  age: "number",
});

const postApp = new Hono()
  .get("/", (c) => {
    return c.json([
      { id: "abc123", name: "Post 1", age: 30 },
      { id: "def456", name: "Post 2", age: 25 },
    ]);
  })
  .get("/:id", (c) => {
    return c.json(
      { id: "abc123", name: "Post 1", age: 30 },
    );
  })
  .post("/", sValidator("json", schema), (c) => {
    const data = c.req.valid("json");
    return c.json({
      success: true,
      message: `${data.name} is ${data.age}`,
    });
  });

const app = new Hono()
  .route("/api/posts", postApp);

export default app;
export type AppType = typeof app;
