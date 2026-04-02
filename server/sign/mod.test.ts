import { assert, assertEquals } from "@std/assert";
import { sign, verify } from "./mod.ts";

Deno.test("sign/verify: 署名した文字列を検証できる", async () => {
  const payload = "hello-signature";

  const signature = await sign(payload);

  assert(signature.length > 0);
  assert(/^[A-Za-z0-9_-]+$/.test(signature));
  console.log("Signature:", signature);
  assertEquals(await verify(payload, signature), true);
});

Deno.test("sign/verify: データ改ざんで検証に失敗する", async () => {
  const payload = "hello-signature";
  const signature = await sign(payload);

  assertEquals(await verify(`${payload}-tampered`, signature), false);
});

Deno.test("sign/verify: 署名改ざんで検証に失敗する", async () => {
  const payload = "hello-signature";
  const signature = await sign(payload);
  const last = signature.at(-1) === "A" ? "B" : "A";
  const tamperedSignature = `${signature.slice(0, -1)}${last}`;

  assertEquals(await verify(payload, tamperedSignature), false);
});
