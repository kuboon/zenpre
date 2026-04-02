import type { KvRepo } from "#/server/kv/types.ts";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "@hono/hono";
import type { Type } from "arktype";
import { sign, verify } from "./sign/mod.ts";

export interface Resource<T extends Type<object>> {
  schema: T;
  repo: KvRepo<T["infer"]>;
}

export function createRouterForResource<T extends Type<object>>(
  resource: Resource<T>,
) {
  const { schema, repo } = resource;
  const schemaWithSign = schema.merge({ sign: "string?" });
  return new Hono()
    .get("/", async (c) => {
      const ret = [];
      for await (const entry of repo) {
        const { key } = entry;
        ret.push({ id: key });
      }
      return c.json(ret);
    })
    .post("/", sValidator("json", schema), async (c) => {
      const data = c.req.valid("json");
      const id = await repo.genKey();
      const result = await repo.entry(id).update(() => data);
      if (!result.ok) {
        return c.json({ error: "Failed to create entry" }, { status: 500 });
      }
      return c.json({ id, sign: await sign(id) });
    })
    .get("/:id", async (c) => {
      const { id } = c.req.param();
      const entry = await repo.entry(id).get();
      if (!entry) {
        return c.notFound();
      }
      return c.json(entry);
    })
    .patch("/:id", sValidator("json", schemaWithSign), async (c) => {
      const { id } = c.req.param();
      const data = c.req.valid("json");
      const sign = data.sign;
      if (sign && await verify(id, sign)) {
        await repo.entry(id).update(() => data);
        return c.body(null, 204);
      }
      return Response.json({ error: "Invalid signature" }, { status: 403 });
    });
}
