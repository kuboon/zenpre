import { assertEquals } from "@std/assert";
import { decodePlayCode, encodePlayCode } from "./play_code.ts";
import type { TimelineEntry } from "./schemas.ts";

const sample: TimelineEntry[] = [
  { t: 0, action: { type: "focus", page: 1, idx: 0 } },
  { t: 1320, action: { type: "focus", page: 2, idx: 0 } },
  { t: 2210, action: { type: "focus", page: 2, idx: 3 } },
  { t: 2750, action: { type: "reaction", emoji: "🎉" } },
  { t: 2760, action: { type: "reaction", emoji: "🦄" } }, // 表に無い絵文字
  { t: 98_765_430, action: { type: "focus", page: 300, idx: 200 } },
];

Deno.test("play code: round-trips focus / reaction", () => {
  const code = encodePlayCode(sample);
  assertEquals(code[0], "1");
  assertEquals(/^[A-Za-z0-9_-]+$/.test(code), true); // URL にそのまま載る
  assertEquals(decodePlayCode(code), sample);
});

Deno.test("play code: sorts, rounds to 10ms, drops other actions", () => {
  const code = encodePlayCode([
    { t: 1234, action: { type: "focus", page: 2, idx: 0 } },
    { t: 3, action: { type: "focus", page: 1, idx: 0 } },
    { t: 500, action: { type: "join" } },
  ]);
  assertEquals(decodePlayCode(code), [
    { t: 0, action: { type: "focus", page: 1, idx: 0 } },
    { t: 1230, action: { type: "focus", page: 2, idx: 0 } },
  ]);
});

Deno.test("play code: is short for a typical recording", () => {
  const entries: TimelineEntry[] = [];
  for (let i = 0; i < 30; i++) {
    entries.push({
      t: i * 1700,
      action: i % 3 === 2
        ? { type: "reaction", emoji: "👏" }
        : { type: "focus", page: 1 + Math.floor(i / 3), idx: i % 3 },
    });
  }
  const code = encodePlayCode(entries);
  assertEquals(code.length < 200, true, `${code.length} chars`);
});

Deno.test("play code: broken input is null, not a throw", () => {
  for (
    const bad of [
      "",
      "1",
      "2AAAA", // 未知の版
      "1!!!", // base64url でない
      "1AP8", // 途中で切れている
      encodePlayCode(sample).slice(0, 8),
      "1" + "A".repeat(9000), // 長すぎる
    ]
  ) {
    assertEquals(decodePlayCode(bad), null, bad);
  }
});
