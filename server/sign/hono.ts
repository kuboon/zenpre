import { verify } from "./mod.ts";
import { type } from "arktype";
import { sValidator } from "@hono/standard-validator";
import { Hono } from "@hono/hono";

const schema = type({ data: "string", sign: "string" });

export const app = new Hono().post(
  "/verify",
  sValidator("json", schema),
  async (c) => {
    const json = c.req.valid("json");
    const { data, sign } = json;
    if (await verify(data, sign)) {
      return c.text("Valid signature");
    }
    return c.text("Invalid signature", { status: 400 });
  },
);
