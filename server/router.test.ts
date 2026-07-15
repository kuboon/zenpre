import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { makeRouter } from "./router.ts";
import { Slides } from "./repo/slides.ts";
import { memoryFactory } from "./repo/memory.ts";

function app() {
  return makeRouter(new Slides(memoryFactory));
}

const FRAME_HEADERS = { "rmx-frame": "1", accept: "text/html" };

Deno.test("GET / returns shell HTML with frame-target nav", async () => {
  const res = await app().fetch(new Request("http://x/"));
  assertEquals(res.status, 200);
  assertStringIncludes(res.headers.get("content-type") ?? "", "text/html");
  const html = await res.text();
  assertStringIncludes(html, "<!DOCTYPE html>");
  assertStringIncludes(html, 'rmx-target="content"');
  assertStringIncludes(html, "ZenPre");
});

Deno.test("GET / with rmx-frame returns landing fragment", async () => {
  const res = await app().fetch(
    new Request("http://x/", { headers: FRAME_HEADERS }),
  );
  assertEquals(res.status, 200);
  const html = await res.text();
  assert(html.trimStart().startsWith("<main"), `got: ${html.slice(0, 80)}`);
  assert(!html.includes("<!DOCTYPE html>"));
});

Deno.test("POST /api/slides creates and returns id + key", async () => {
  const router = app();
  const res = await router.fetch(
    new Request("http://x/api/slides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown: "# Hello\n\nworld" }),
    }),
  );
  assertEquals(res.status, 201);
  assertEquals(res.headers.get("access-control-allow-origin"), "*");
  const body = await res.json() as {
    slide_id: string;
    slide_key: string;
    preview_url: string;
  };
  assert(body.slide_id.length === 8, "slide_id is 8 chars");
  assert(body.slide_key.length === 26, "slide_key is 26 chars");
  assertEquals(body.preview_url, `/s/${body.slide_id}`);
});

Deno.test("POST /api/slides rejects invalid body", async () => {
  const res = await app().fetch(
    new Request("http://x/api/slides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ nope: 1 }),
    }),
  );
  assertEquals(res.status, 400);
});

Deno.test("GET /api/slides/:id returns the stored slide", async () => {
  const router = app();
  const created = await (await router.fetch(
    new Request("http://x/api/slides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown: "# Title\n\nbody", theme: "dark" }),
    }),
  )).json() as { slide_id: string };

  const res = await router.fetch(
    new Request(`http://x/api/slides/${created.slide_id}`),
  );
  assertEquals(res.status, 200);
  const slide = await res.json() as {
    title: string;
    theme: string;
    markdown: string;
  };
  assertEquals(slide.title, "Title");
  assertEquals(slide.theme, "dark");
  assertStringIncludes(slide.markdown, "body");
});

Deno.test("GET /api/slides/:id 404 for unknown", async () => {
  const res = await app().fetch(new Request("http://x/api/slides/nope0000"));
  assertEquals(res.status, 404);
});

Deno.test("PATCH /api/slides/:id enforces X-Slide-Key", async () => {
  const router = app();
  const created = await (await router.fetch(
    new Request("http://x/api/slides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown: "# A" }),
    }),
  )).json() as { slide_id: string; slide_key: string };

  // wrong key -> 403
  const bad = await router.fetch(
    new Request(`http://x/api/slides/${created.slide_id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json", "x-slide-key": "wrong" },
      body: JSON.stringify({ markdown: "# B" }),
    }),
  );
  assertEquals(bad.status, 403);

  // missing key -> 401
  const missing = await router.fetch(
    new Request(`http://x/api/slides/${created.slide_id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown: "# B" }),
    }),
  );
  assertEquals(missing.status, 401);

  // right key -> 200 and updates title
  const ok = await router.fetch(
    new Request(`http://x/api/slides/${created.slide_id}`, {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
        "x-slide-key": created.slide_key,
      },
      body: JSON.stringify({ markdown: "# Renamed\n\nx" }),
    }),
  );
  assertEquals(ok.status, 200);
  const slide = await (await router.fetch(
    new Request(`http://x/api/slides/${created.slide_id}`),
  )).json() as { title: string };
  assertEquals(slide.title, "Renamed");
});

Deno.test("GET /s/:id server-renders the slide pages", async () => {
  const router = app();
  const created = await (await router.fetch(
    new Request("http://x/api/slides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        markdown: "# Page One\n\nhi\n\n---\n\n## Page Two",
      }),
    }),
  )).json() as { slide_id: string };

  const res = await router.fetch(
    new Request(`http://x/s/${created.slide_id}`),
  );
  assertEquals(res.status, 200);
  assertStringIncludes(res.headers.get("content-type") ?? "", "text/html");
  const html = await res.text();
  assertStringIncludes(html, "<zen-slide-viewer>");
  assertStringIncludes(html, 'class="zen-page" data-page="1"');
  assertStringIncludes(html, 'class="zen-page" data-page="2"');
  assertStringIncludes(html, "Page One");
  assertStringIncludes(html, "Page Two");
  assertStringIncludes(html, "/slide.js");
});

Deno.test("GET /s/:id 404 for unknown slide", async () => {
  const res = await app().fetch(new Request("http://x/s/nope0000"));
  assertEquals(res.status, 404);
});
