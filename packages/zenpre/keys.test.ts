import { assert, assertEquals, assertNotEquals } from "@std/assert";
import {
  genPublicId,
  genSecretKey,
  hashKey,
  PUBLIC_ID_LENGTH,
  SECRET_KEY_LENGTH,
  verifyKey,
} from "./keys.ts";

const BASE58_RE = /^[1-9A-HJ-NP-Za-km-z]+$/;

Deno.test("genPublicId: 8 文字の base58", () => {
  for (let i = 0; i < 100; i++) {
    const id = genPublicId();
    assertEquals(id.length, PUBLIC_ID_LENGTH);
    assert(BASE58_RE.test(id), `not base58: ${id}`);
  }
});

Deno.test("genSecretKey: 26 文字の base58、毎回異なる", () => {
  const a = genSecretKey();
  const b = genSecretKey();
  assertEquals(a.length, SECRET_KEY_LENGTH);
  assert(BASE58_RE.test(a));
  assertNotEquals(a, b);
});

Deno.test("hashKey: 決定的な sha-256 hex", async () => {
  const h1 = await hashKey("secret");
  const h2 = await hashKey("secret");
  assertEquals(h1, h2);
  assertEquals(h1.length, 64);
  assert(/^[0-9a-f]+$/.test(h1));
  // 既知ベクタ: sha256("secret")
  assertEquals(
    h1,
    "2bb80d537b1da3e38bd30361aa855686bde0eacd7162fef6a25fe97bf527a25b",
  );
});

Deno.test("verifyKey: 正しい key のみ通す", async () => {
  const key = genSecretKey();
  const stored = await hashKey(key);
  assert(await verifyKey(key, stored));
  assert(!(await verifyKey(key + "x", stored)));
  assert(!(await verifyKey(key, stored.slice(1))));
});
