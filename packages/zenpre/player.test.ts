import { assert, assertEquals } from "@std/assert";
import { Recorder } from "./recorder.ts";
import { focusAt, Player } from "./player.ts";
import type { Action, TimelineEntry } from "./schemas.ts";

Deno.test("Recorder: records t relative to start and flushes pending chunks", async () => {
  const flushed: TimelineEntry[][] = [];
  const rec = new Recorder({ onFlush: (c) => void flushed.push(c) });
  rec.start(1000);
  rec.record({ type: "focus", page: 1, idx: 0 }, 1000);
  rec.record({ type: "focus", page: 2, idx: 0 }, 2500);
  assertEquals(rec.entries.map((e) => e.t), [0, 1500]);
  assertEquals(rec.pendingCount, 2);

  await rec.flush();
  assertEquals(flushed.length, 1);
  assertEquals(flushed[0].length, 2);
  assertEquals(rec.pendingCount, 0);

  // 追記後の flush は差分のみ
  rec.record({ type: "reaction", emoji: "👏" }, 3000);
  await rec.flush();
  assertEquals(flushed.length, 2);
  assertEquals(flushed[1].length, 1);
});

Deno.test("Recorder: failed flush keeps pending for retry", async () => {
  let calls = 0;
  const rec = new Recorder({
    onFlush: () => {
      calls++;
      if (calls === 1) throw new Error("network");
    },
  });
  rec.record({ type: "focus", page: 1, idx: 0 }, 0);
  await rec.flush().catch(() => {});
  assertEquals(rec.pendingCount, 1); // 戻っている
  await rec.flush();
  assertEquals(rec.pendingCount, 0);
});

Deno.test("focusAt: last focus at or before position, skipping reactions", () => {
  const entries: TimelineEntry[] = [
    { t: 0, action: { type: "focus", page: 1, idx: 0 } },
    { t: 500, action: { type: "reaction", emoji: "👏" } },
    { t: 1000, action: { type: "focus", page: 2, idx: 1 } },
    { t: 2000, action: { type: "focus", page: 3, idx: 0 } },
  ];
  assertEquals(focusAt(entries, 0)?.page, 1);
  assertEquals(focusAt(entries, 999)?.page, 1);
  assertEquals(focusAt(entries, 1000)?.page, 2);
  assertEquals(focusAt(entries, 1500)?.page, 2);
  assertEquals(focusAt(entries, 5000)?.page, 3);
  assertEquals(focusAt([], 100), null);
});

Deno.test("Player: seek reconstructs focus state and reports position", () => {
  const applied: Action[] = [];
  const entries: TimelineEntry[] = [
    { t: 0, action: { type: "focus", page: 1, idx: 0 } },
    { t: 1000, action: { type: "reaction", emoji: "🎉" } },
    { t: 2000, action: { type: "focus", page: 2, idx: 0 } },
  ];
  const player = new Player(entries, { apply: (a) => applied.push(a) });
  assertEquals(player.duration, 2000);

  player.seek(2500);
  // reaction はスキップ、直近 focus(page 2)だけ再適用
  assertEquals(applied.length, 1);
  assertEquals(applied[0].type, "focus");
  assertEquals((applied[0] as { page: number }).page, 2);
  assertEquals(player.state, "ended");
  assertEquals(player.position, 2000);

  player.seek(500);
  assertEquals((applied[1] as { page: number }).page, 1);
  assertEquals(player.state, "paused");

  player.dispose();
});

Deno.test("Player: plays entries in order via timers", async () => {
  const applied: Action[] = [];
  const entries: TimelineEntry[] = [
    { t: 0, action: { type: "focus", page: 1, idx: 0 } },
    { t: 40, action: { type: "reaction", emoji: "👏" } },
    { t: 80, action: { type: "focus", page: 2, idx: 0 } },
  ];
  const player = new Player(entries, { apply: (a) => applied.push(a) });
  player.play();
  await new Promise((r) => setTimeout(r, 200));
  assertEquals(applied.length, 3);
  assertEquals(applied[0].type, "focus");
  assertEquals(applied[1].type, "reaction");
  assertEquals(applied[2].type, "focus");
  assert(player.state === "ended");
  player.dispose();
});
