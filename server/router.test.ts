import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import router from "./router.ts";

const FRAME_HEADERS = { "rmx-frame": "1", accept: "text/html" };

Deno.test("GET / returns shell HTML with frame-target nav", async () => {
  const res = await router.fetch(new Request("http://x/"));
  assertEquals(res.status, 200);
  assertStringIncludes(res.headers.get("content-type") ?? "", "text/html");
  const html = await res.text();
  assertStringIncludes(html, "<!DOCTYPE html>");
  assertStringIncludes(html, 'rmx-target="content"');
  assertStringIncludes(html, "ZenPre");
});

Deno.test("GET / with rmx-frame returns landing fragment", async () => {
  const res = await router.fetch(
    new Request("http://x/", { headers: FRAME_HEADERS }),
  );
  assertEquals(res.status, 200);
  const html = await res.text();
  assert(html.trimStart().startsWith("<main"), `got: ${html.slice(0, 80)}`);
  assert(!html.includes("<!DOCTYPE html>"));
});

Deno.test("GET /nonexistent returns 404", async () => {
  const res = await router.fetch(new Request("http://x/nonexistent"));
  assertEquals(res.status, 404);
  await res.body?.cancel();
});
