import { assert, assertEquals } from "@std/assert";
import { BlacklistModerator } from "./blacklist.ts";

Deno.test("BlacklistModerator: blocks substring matches, case-insensitive", () => {
  const mod = new BlacklistModerator(["Spam", "宣伝"]);
  assert(mod.isBlocked("this is SPAM!"));
  assert(mod.isBlocked("お得な宣伝です"));
  assert(!mod.isBlocked("普通のコメント"));
});

Deno.test("BlacklistModerator: moderate() promotes clean posts to level 1", () => {
  let n = 0;
  const genId = () => `id${n++}`;
  const mod = new BlacklistModerator(["spam"]);

  const ok = mod.moderate("  hello world  ", genId);
  assertEquals(ok, {
    type: "post",
    text: "hello world",
    level: 1,
    post_id: "id0",
  });

  // blocked text -> null, no id consumed
  assertEquals(mod.moderate("buy spam now", genId), null);
  // empty / whitespace-only -> null
  assertEquals(mod.moderate("   ", genId), null);

  // next clean post gets the next id (id1, since blocked ones don't consume)
  const ok2 = mod.moderate("second", genId);
  assertEquals(ok2?.post_id, "id1");
});

Deno.test("BlacklistModerator: empty blacklist blocks nothing", () => {
  const mod = new BlacklistModerator();
  assert(!mod.isBlocked("anything at all"));
  assertEquals(mod.moderate("hi", () => "x")?.text, "hi");
});
