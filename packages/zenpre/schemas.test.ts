import { assert, assertEquals } from "@std/assert";
import {
  ActionSchema,
  DownSchema,
  SlideSchema,
  TimelineEntrySchema,
  ZenEventSchema,
} from "./schemas.ts";
import { type } from "arktype";

function accepts(schema: { (data: unknown): unknown }, data: unknown) {
  const result = schema(data);
  assert(
    !(result instanceof type.errors),
    `expected accept, got: ${result instanceof type.errors && result.summary}`,
  );
}
function rejects(schema: { (data: unknown): unknown }, data: unknown) {
  const result = schema(data);
  assert(result instanceof type.errors, "expected reject, but accepted");
}

const now = "2026-07-08T12:00:00Z";

Deno.test("SlideSchema accepts a full record", () => {
  accepts(SlideSchema, {
    slide_id: "Ab3xY7kQ",
    title: "My Talk",
    markdown: "# My Talk\n\n---\n\n## p2",
    css: "",
    theme: "light",
    created_at: now,
    updated_at: now,
  });
});

Deno.test("SlideSchema rejects non-ISO timestamps", () => {
  rejects(SlideSchema, {
    slide_id: "Ab3xY7kQ",
    title: "t",
    markdown: "",
    css: "",
    theme: "light",
    created_at: "yesterday",
    updated_at: now,
  });
});

Deno.test("ZenEventSchema allows relay-only events (slide_id: null)", () => {
  accepts(ZenEventSchema, {
    event_id: "Ev3nt1dX",
    slide_id: null,
    begin_at: now,
    end_at: null,
    created_at: now,
  });
});

Deno.test("ActionSchema: focus", () => {
  accepts(ActionSchema, { type: "focus", page: 1, idx: 0 });
  rejects(ActionSchema, { type: "focus", page: 0, idx: 0 }); // page は 1 起点
  rejects(ActionSchema, { type: "focus", page: 1.5, idx: 0 });
  rejects(ActionSchema, { type: "focus", page: 1 }); // idx 欠落
});

Deno.test("ActionSchema: reaction / join", () => {
  accepts(ActionSchema, { type: "reaction", emoji: "🎉" });
  accepts(ActionSchema, { type: "join" });
  rejects(ActionSchema, { type: "reaction" });
});

Deno.test("ActionSchema: audience post は level 0 のみ・post_id なし", () => {
  accepts(ActionSchema, { type: "post", text: "hello", level: 0 });
  // level >= 1 には post_id が必須
  rejects(ActionSchema, { type: "post", text: "hello", level: 1 });
  accepts(ActionSchema, {
    type: "post",
    text: "hello",
    level: 1,
    post_id: "p0stId01",
  });
  rejects(ActionSchema, { type: "post", text: "x".repeat(201), level: 0 });
});

Deno.test("ActionSchema: vote", () => {
  accepts(ActionSchema, { type: "vote", post_id: "p0stId01" });
  rejects(ActionSchema, { type: "vote" });
});

Deno.test("DownSchema: welcome / action / count / error", () => {
  accepts(DownSchema, {
    kind: "welcome",
    audience_id: "a1",
    role: "audience",
    count: 3,
    last_focus: { type: "focus", page: 2, idx: 1 },
  });
  accepts(DownSchema, {
    kind: "welcome",
    audience_id: "a1",
    role: "presenter",
    count: 0,
  });
  accepts(DownSchema, {
    kind: "action",
    action: { type: "reaction", emoji: "👏" },
    from: "a1",
    ts: 1234567890,
  });
  accepts(DownSchema, { kind: "count", count: 12 });
  accepts(DownSchema, { kind: "error", code: "rate_limited" });
  rejects(DownSchema, { kind: "error", code: "unknown_code" });
  rejects(DownSchema, { kind: "welcome", audience_id: "a1", role: "boss" });
});

Deno.test("TimelineEntrySchema", () => {
  accepts(TimelineEntrySchema, {
    t: 0,
    action: { type: "focus", page: 1, idx: 0 },
  });
  rejects(TimelineEntrySchema, {
    t: -1,
    action: { type: "focus", page: 1, idx: 0 },
  });
});

Deno.test("infer された型が使える(コンパイル時チェック)", () => {
  const focus: typeof ActionSchema.infer = { type: "focus", page: 1, idx: 0 };
  assertEquals(focus.type, "focus");
});
