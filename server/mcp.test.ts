import { assert, assertEquals } from "@std/assert";
import { createApp } from "./app.ts";
import { Slides } from "./repo/slides.ts";
import { Talks } from "./repo/talks.ts";
import { Timelines } from "./repo/timelines.ts";
import { memoryFactory } from "./repo/memory.ts";

// deno-lint-ignore no-explicit-any
type Json = any;

function app() {
  return createApp({
    slides: new Slides(memoryFactory),
    talks: new Talks(memoryFactory),
    timelines: new Timelines(memoryFactory),
  });
}

async function rpc(
  handler: (req: Request) => Promise<Response>,
  msg: unknown,
): Promise<{ status: number; body: Json }> {
  const res = await handler(
    new Request("http://localhost/mcp", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(msg),
    }),
  );
  const text = await res.text();
  return { status: res.status, body: text ? JSON.parse(text) : null };
}

/** tools/call のショートカット。structuredContent と isError を返す。 */
async function call(
  handler: (req: Request) => Promise<Response>,
  name: string,
  args: unknown,
  id = 1,
): Promise<{ result: Json; isError: boolean }> {
  const { body } = await rpc(handler, {
    jsonrpc: "2.0",
    id,
    method: "tools/call",
    params: { name, arguments: args },
  });
  const r = body.result;
  return { result: r?.structuredContent, isError: !!r?.isError };
}

Deno.test("mcp: initialize negotiates protocol and advertises server", async () => {
  const handler = app();
  const { body } = await rpc(handler, {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: { protocolVersion: "2025-06-18", capabilities: {} },
  });
  assertEquals(body.jsonrpc, "2.0");
  assertEquals(body.result.protocolVersion, "2025-06-18");
  assertEquals(body.result.serverInfo.name, "zenpre");
  assert(body.result.capabilities.tools);
});

Deno.test("mcp: notifications get 202 with no body", async () => {
  const handler = app();
  const { status, body } = await rpc(handler, {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  });
  assertEquals(status, 202);
  assertEquals(body, null);
});

Deno.test("mcp: tools/list exposes all tools with object input schemas", async () => {
  const handler = app();
  const { body } = await rpc(handler, {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/list",
  });
  const names = body.result.tools.map((t: Json) => t.name).sort();
  assertEquals(names, [
    "create_talk",
    "edit_slide",
    "list_pending_posts",
    "publish_post",
    "upload_slide",
  ]);
  for (const t of body.result.tools) {
    assertEquals(t.inputSchema.type, "object");
  }
});

Deno.test("mcp: upload_slide -> create_talk -> URLs (DoD flow)", async () => {
  const handler = app();

  const up = await call(handler, "upload_slide", {
    markdown: "# Hello\n\n---\n\n# World",
    theme: "dracula",
  });
  assert(!up.isError);
  assertEquals(up.result.preview_url, `/s/${up.result.slide_id}`);
  assert(up.result.slide_key.length === 26);

  // create_talk bound to the slide (ownership via slide_key).
  const talk = await call(handler, "create_talk", {
    slide_id: up.result.slide_id,
    slide_key: up.result.slide_key,
  });
  assert(!talk.isError);
  assertEquals(talk.result.audience_url, `/t/${talk.result.talk_id}`);
  assert(talk.result.presenter_url.includes(`#key=${talk.result.talk_key}`));
  assert(
    talk.result.moderator_url.includes(`#key=${talk.result.moderator_key}`),
  );

  // wrong slide_key -> tool error.
  const bad = await call(handler, "create_talk", {
    slide_id: up.result.slide_id,
    slide_key: "x".repeat(26),
  });
  assert(bad.isError);

  // edit_slide with correct key ok, wrong key errors.
  const ok = await call(handler, "edit_slide", {
    slide_id: up.result.slide_id,
    slide_key: up.result.slide_key,
    markdown: "# Edited",
  });
  assert(!ok.isError);
  const editBad = await call(handler, "edit_slide", {
    slide_id: up.result.slide_id,
    slide_key: "y".repeat(26),
    markdown: "# Nope",
  });
  assert(editBad.isError);
});

Deno.test("mcp: relay-only talk (no slide) can be created", async () => {
  const handler = app();
  const talk = await call(handler, "create_talk", {});
  assert(!talk.isError);
  assert(talk.result.talk_id.length === 8);
});

Deno.test("mcp: invalid arguments produce a tool error, not a crash", async () => {
  const handler = app();
  const r = await call(handler, "upload_slide", { markdown: 123 });
  assert(r.isError);
});

// --- moderator tools need a live relay (hub + pending buffer) ---------------

// deno-lint-ignore no-explicit-any
type Msg = any;
class Sock {
  ws: WebSocket;
  #msgs: Msg[] = [];
  #waiters: Array<[(m: Msg) => boolean, (m: Msg) => void, number]> = [];
  constructor(url: string) {
    this.ws = new WebSocket(url);
    this.ws.onmessage = (e) => this.#push(JSON.parse(e.data as string));
  }
  #push(m: Msg): void {
    for (let i = 0; i < this.#waiters.length; i++) {
      const [pred, res, timer] = this.#waiters[i];
      if (pred(m)) {
        clearTimeout(timer);
        this.#waiters.splice(i, 1);
        res(m);
        return;
      }
    }
    this.#msgs.push(m);
  }
  open(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws.readyState === WebSocket.OPEN) return resolve();
      this.ws.onopen = () => resolve();
      this.ws.onerror = () => reject(new Error("ws error"));
    });
  }
  next(pred: (m: Msg) => boolean, timeoutMs = 2000): Promise<Msg> {
    const i = this.#msgs.findIndex(pred);
    if (i >= 0) return Promise.resolve(this.#msgs.splice(i, 1)[0]);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error("timeout waiting for message")),
        timeoutMs,
      );
      this.#waiters.push([pred, resolve, timer]);
    });
  }
  send(a: unknown): void {
    this.ws.send(JSON.stringify(a));
  }
  close(): void {
    this.ws.close();
  }
}

Deno.test("mcp: list_pending_posts + publish_post drive the live relay", async () => {
  const slides = new Slides(memoryFactory);
  const talks = new Talks(memoryFactory);
  const timelines = new Timelines(memoryFactory);
  const handler = createApp({ slides, talks, timelines });
  const server = Deno.serve({ port: 0, onListen() {} }, handler);
  const base = `http://127.0.0.1:${(server.addr as Deno.NetAddr).port}`;

  const talkRes = await call(handler, "create_talk", {}, 1);
  const { talk_id, moderator_key } = talkRes.result;

  const wsUrl = (key?: string) =>
    `${base.replace("http", "ws")}/api/talks/${talk_id}/ws${
      key ? `?key=${key}` : ""
    }`;
  const moderator = new Sock(wsUrl(moderator_key));
  const audience = new Sock(wsUrl());
  await Promise.all([moderator.open(), audience.open()]);
  moderator.send({ type: "join" });
  audience.send({ type: "join" });
  await moderator.next((m) => m.kind === "welcome");
  await audience.next((m) => m.kind === "welcome");

  // audience posts level-0; moderator receives it (=> recorded in ring buffer).
  audience.send({ type: "post", text: "MCP から見える?", level: 0 });
  await moderator.next((m) => m.kind === "action" && m.action.type === "post");

  // list_pending_posts (forbidden without a valid key).
  const forbidden = await call(handler, "list_pending_posts", {
    talk_id,
    moderator_key: "z".repeat(26),
  }, 2);
  assert(forbidden.isError);

  const pending = await call(handler, "list_pending_posts", {
    talk_id,
    moderator_key,
  }, 3);
  assert(!pending.isError);
  assertEquals(pending.result.pending.length, 1);
  assertEquals(pending.result.pending[0].text, "MCP から見える?");

  // publish_post -> audience receives the approved (level>=1) post.
  const pub = await call(handler, "publish_post", {
    talk_id,
    moderator_key,
    text: "承認しました",
  }, 4);
  assert(!pub.isError);
  const got = await audience.next((m) =>
    m.kind === "action" && m.action.type === "post" && m.action.level >= 1
  );
  assertEquals(got.action.text, "承認しました");
  assertEquals(got.action.post_id, pub.result.post_id);

  moderator.close();
  audience.close();
  await new Promise((r) => setTimeout(r, 100));
  await server.shutdown();
});
