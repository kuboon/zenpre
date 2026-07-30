import { assert, assertEquals } from "@std/assert";
import { createApp } from "../app.ts";
import { Slides } from "../repo/slides.ts";
import { Talks } from "../repo/talks.ts";
import { Timelines } from "../repo/timelines.ts";
import { memoryFactory } from "../repo/memory.ts";

// deno-lint-ignore no-explicit-any
type Msg = any;

/** WebSocket をメッセージキュー付きでラップするテストヘルパ。 */
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

  send(action: unknown): void {
    this.ws.send(JSON.stringify(action));
  }

  close(): void {
    this.ws.close();
  }
}

async function setup() {
  const slides = new Slides(memoryFactory);
  const talks = new Talks(memoryFactory);
  const timelines = new Timelines(memoryFactory);
  const handler = createApp({ slides, talks, timelines });
  const server = Deno.serve({ port: 0, onListen() {} }, handler);
  const base = `http://127.0.0.1:${(server.addr as Deno.NetAddr).port}`;

  const slide = await (await handler(
    new Request(`${base}/api/slides`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown: "# One\n\n---\n\n# Two" }),
    }),
  )).json() as { slide_id: string; slide_key: string };

  const talk = await (await handler(
    new Request(`${base}/api/talks`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-slide-key": slide.slide_key,
      },
      body: JSON.stringify({ slide_id: slide.slide_id }),
    }),
  )).json() as { talk_id: string; event_key: string; moderator_key: string };

  const wsBase = base.replace("http", "ws");
  const wsUrl = (key?: string) =>
    `${wsBase}/api/talks/${talk.talk_id}/ws${key ? `?key=${key}` : ""}`;

  return { server, slides, talks, talk, slide, wsUrl };
}

Deno.test("relay: roles, focus follow, reaction, forbidden, last_focus", async () => {
  const { server, talk, wsUrl } = await setup();

  const presenter = new Sock(wsUrl(talk.event_key));
  const audience = new Sock(wsUrl());
  await Promise.all([presenter.open(), audience.open()]);

  // join -> welcome with role
  presenter.send({ type: "join" });
  audience.send({ type: "join" });
  const pw = await presenter.next((m) => m.kind === "welcome");
  const aw = await audience.next((m) => m.kind === "welcome");
  assertEquals(pw.role, "presenter");
  assertEquals(pw.audience_id, "presenter");
  assertEquals(aw.role, "audience");
  assertEquals(aw.audience_id.length, 8);

  // presenter focus -> audience receives it
  presenter.send({ type: "focus", page: 2, idx: 0 });
  const af = await audience.next((m) =>
    m.kind === "action" && m.action.type === "focus"
  );
  assertEquals(af.action.page, 2);
  assertEquals(af.from, "presenter");

  // audience focus -> forbidden (not broadcast)
  audience.send({ type: "focus", page: 1, idx: 0 });
  const forbidden = await audience.next((m) =>
    m.kind === "error" && m.code === "forbidden"
  );
  assert(forbidden);

  // audience reaction -> presenter receives it
  audience.send({ type: "reaction", emoji: "👏" });
  const react = await presenter.next((m) =>
    m.kind === "action" && m.action.type === "reaction"
  );
  assertEquals(react.action.emoji, "👏");

  // late joiner gets last_focus in welcome
  const late = new Sock(wsUrl());
  await late.open();
  late.send({ type: "join" });
  const lw = await late.next((m) => m.kind === "welcome");
  assertEquals(lw.last_focus?.type, "focus");
  assertEquals(lw.last_focus?.page, 2);

  presenter.close();
  audience.close();
  late.close();
  await new Promise((r) => setTimeout(r, 100));
  await server.shutdown();
});

Deno.test("relay: post moderation, vote aggregation, forbidden, too long", async () => {
  const { server, talk, wsUrl } = await setup();

  const presenter = new Sock(wsUrl(talk.event_key));
  const moderator = new Sock(wsUrl(talk.moderator_key));
  const audienceA = new Sock(wsUrl());
  const audienceB = new Sock(wsUrl());
  await Promise.all([
    presenter.open(),
    moderator.open(),
    audienceA.open(),
    audienceB.open(),
  ]);

  for (const s of [presenter, moderator, audienceA, audienceB]) {
    s.send({ type: "join" });
  }
  const aw = await audienceA.next((m) => m.kind === "welcome");
  const mw = await moderator.next((m) => m.kind === "welcome");
  assertEquals(mw.role, "moderator");
  assert(mw.audience_id.startsWith("mod:"));
  const audienceAId = aw.audience_id as string;

  // audience level-0 post -> presenter & moderator receive it, other audience does NOT.
  audienceA.send({ type: "post", text: "hello?", level: 0 });
  const pPost = await presenter.next((m) =>
    m.kind === "action" && m.action.type === "post"
  );
  assertEquals(pPost.action.level, 0);
  assertEquals(pPost.action.text, "hello?");
  assertEquals(pPost.from, audienceAId);
  const mPost = await moderator.next((m) =>
    m.kind === "action" && m.action.type === "post"
  );
  assertEquals(mPost.action.level, 0);

  // moderator approves -> level-1 post reaches EVERYONE (incl. both audiences).
  moderator.send({
    type: "post",
    text: "hello?",
    level: 1,
    post_id: "post0001",
  });
  const bPost = await audienceB.next((m) =>
    m.kind === "action" && m.action.type === "post"
  );
  // B's first post action must be the approved (level>=1) one, never the level-0.
  assertEquals(bPost.action.level, 1);
  assertEquals(bPost.action.post_id, "post0001");
  const aPost = await audienceA.next((m) =>
    m.kind === "action" && m.action.type === "post" && m.action.level === 1
  );
  assertEquals(aPost.action.post_id, "post0001");

  // vote -> broadcast to everyone (clients aggregate locally).
  audienceB.send({ type: "vote", post_id: "post0001" });
  const aVote = await audienceA.next((m) =>
    m.kind === "action" && m.action.type === "vote"
  );
  assertEquals(aVote.action.post_id, "post0001");

  // audience cannot publish level>=1 posts -> forbidden.
  audienceB.send({
    type: "post",
    text: "sneaky",
    level: 1,
    post_id: "x0000001",
  });
  const forbidden = await audienceB.next((m) =>
    m.kind === "error" && m.code === "forbidden"
  );
  assert(forbidden);

  // over the grapheme limit -> invalid (checked before rate limit).
  audienceB.send({ type: "post", text: "あ".repeat(51), level: 0 });
  const invalid = await audienceB.next((m) =>
    m.kind === "error" && m.code === "invalid"
  );
  assert(invalid);

  presenter.close();
  moderator.close();
  audienceA.close();
  audienceB.close();
  await new Promise((r) => setTimeout(r, 100));
  await server.shutdown();
});

Deno.test("relay: 404 for unknown talk, 403 for wrong key", async () => {
  const { server, talk, wsUrl } = await setup();
  const base = wsUrl().replace(/\/api\/talks\/.*/, "");

  // unknown talk id -> the upgrade handler returns 404 (no websocket)
  const res404 = await fetch(
    `${base.replace("ws", "http")}/api/talks/nope0000/ws`,
    { headers: { upgrade: "websocket" } },
  ).catch(() => null);
  // fetch without proper ws handshake may 404/426; assert not a hang
  assert(res404 === null || res404.status === 404 || res404.status === 426);
  await res404?.body?.cancel();

  // wrong key -> 403
  const bad = new WebSocket(`${wsUrl("wrongkey")}`);
  const closed = await new Promise<boolean>((resolve) => {
    bad.onerror = () => resolve(true);
    bad.onclose = () => resolve(true);
    bad.onopen = () => resolve(false);
  });
  assert(closed, "wrong key should not open");
  try {
    bad.close();
  } catch { /* already closed */ }
  void talk;
  await server.shutdown();
});
