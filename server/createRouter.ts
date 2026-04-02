import type { KvRepo } from "#/server/kv/types.ts";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "@hono/hono";
import type { Type } from "arktype";

export interface Resource<T extends Type> {
  schema: T;
  repo: KvRepo<T["infer"]>;
}

export function createRouterForResource<T extends Type>(resource: Resource<T>) {
  const { schema, repo } = resource;
  return new Hono()
    .get("/", async (c) => {
      const ret = [];
      for await (const entry of repo.list()) {
        const { key } = entry;
        ret.push({ id: key[0] });
      }
      return c.json(ret);
    })
    .get("/:id", async (c) => {
      const { id } = c.req.param();
      const entry = await repo.entry([id]).get();
      if (!entry) {
        return c.notFound();
      }
      return c.json(entry);
    })
    .post("/", sValidator("json", schema), async (c) => {
      const data = c.req.valid("json");
      const id = await repo.list().create(data);
      return c.json({ id });
    });
}
