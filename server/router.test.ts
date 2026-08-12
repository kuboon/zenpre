import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { makeRouter } from "./router.ts";
import { Slides } from "./repo/slides.ts";
import { Talks } from "./repo/talks.ts";
import { Timelines } from "./repo/timelines.ts";
import { memoryFactory } from "./repo/memory.ts";

function app() {
  return makeRouter({
    slides: new Slides(memoryFactory),
    talks: new Talks(memoryFactory),
    timelines: new Timelines(memoryFactory),
  });
}

Deno.test("GET / is the Player-driven intro deck (dogfooding)", async () => {
  const res = await app().fetch(new Request("http://x/"));
  assertEquals(res.status, 200);
  assertStringIncludes(res.headers.get("content-type") ?? "", "text/html");
  const html = await res.text();
  assertStringIncludes(html, "<zen-slide-viewer");
  // driven by an embedded fixed timeline via the Player (not the autoplay timer)
  assertStringIncludes(html, 'id="zen-timeline-data"');
  assertStringIncludes(html, '"type":"reaction"');
  assertStringIncludes(html, "<zen-reaction-layer>");
  assertStringIncludes(html, "/home.js");
  assert(!html.includes("data-autoplay-ms="));
  // rendered from ZenPre's own features: multiple SSR pages
  assertStringIncludes(html, 'class="zen-page" data-page="1"');
  assertStringIncludes(html, 'class="zen-page" data-page="2"');
  assertStringIncludes(html, "ZenPre");
});

Deno.test("GET / links to the editor (動線)", async () => {
  const res = await app().fetch(new Request("http://x/"));
  const html = await res.text();
  assertStringIncludes(html, '<a class="zen-cta" href="/new"');
});

Deno.test("GET /new is the markdown editor with live preview", async () => {
  const res = await app().fetch(new Request("http://x/new"));
  assertEquals(res.status, 200);
  assertStringIncludes(res.headers.get("content-type") ?? "", "text/html");
  const html = await res.text();
  // textarea (input) + viewer (live preview) + create button
  assertStringIncludes(html, 'id="zen-md"');
  assertStringIncludes(html, "<zen-slide-viewer></zen-slide-viewer>");
  assertStringIncludes(html, 'id="zen-create"');
  assertStringIncludes(html, "/new.js");
  // the preview is client-rendered: no SSR pages baked in
  assert(!html.includes('class="zen-page"'));
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

Deno.test("POST /api/talks requires X-Slide-Key when slide_id given", async () => {
  const router = app();
  const slide = await (await router.fetch(
    new Request("http://x/api/slides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown: "# A" }),
    }),
  )).json() as { slide_id: string; slide_key: string };

  // missing key -> 401
  const noKey = await router.fetch(
    new Request("http://x/api/talks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slide_id: slide.slide_id }),
    }),
  );
  assertEquals(noKey.status, 401);

  // with key -> 201 and returns keys + urls
  const ok = await router.fetch(
    new Request("http://x/api/talks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-slide-key": slide.slide_key,
      },
      body: JSON.stringify({ slide_id: slide.slide_id }),
    }),
  );
  assertEquals(ok.status, 201);
  const body = await ok.json() as {
    talk_id: string;
    event_key: string;
    moderator_key: string;
    audience_url: string;
    presenter_url: string;
  };
  assertEquals(body.talk_id.length, 8);
  assertEquals(body.event_key.length, 26);
  assertEquals(body.audience_url, `/t/${body.talk_id}`);
  assert(body.presenter_url.includes(`#key=${body.event_key}`));
});

Deno.test("POST /api/talks allows relay-only talk (no slide_id)", async () => {
  const res = await app().fetch(
    new Request("http://x/api/talks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  );
  assertEquals(res.status, 201);
  const body = await res.json() as { talk_id: string };
  assertEquals(body.talk_id.length, 8);
});

Deno.test("GET /t/:id 404 when talk has no slide bound", async () => {
  const router = app();
  const talk = await (await router.fetch(
    new Request("http://x/api/talks", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({}),
    }),
  )).json() as { talk_id: string };
  const res = await router.fetch(new Request(`http://x/t/${talk.talk_id}`));
  assertEquals(res.status, 404);
});

Deno.test("GET /t/:id renders audience view with talk data + /talk.js", async () => {
  const router = app();
  const slide = await (await router.fetch(
    new Request("http://x/api/slides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown: "# Live\n\nhi" }),
    }),
  )).json() as { slide_id: string; slide_key: string };
  const talk = await (await router.fetch(
    new Request("http://x/api/talks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-slide-key": slide.slide_key,
      },
      body: JSON.stringify({ slide_id: slide.slide_id }),
    }),
  )).json() as { talk_id: string };

  const res = await router.fetch(new Request(`http://x/t/${talk.talk_id}`));
  assertEquals(res.status, 200);
  const html = await res.text();
  assertStringIncludes(html, "zen-talk-data");
  assertStringIncludes(html, '"role":"audience"');
  assertStringIncludes(html, "/talk.js");
  assertStringIncludes(html, "<zen-reaction-layer>");
});

async function makeTalk(router: ReturnType<typeof app>) {
  const slide = await (await router.fetch(
    new Request("http://x/api/slides", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ markdown: "# A\n\n---\n\n# B" }),
    }),
  )).json() as { slide_id: string; slide_key: string };
  return await (await router.fetch(
    new Request("http://x/api/talks", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-slide-key": slide.slide_key,
      },
      body: JSON.stringify({ slide_id: slide.slide_id }),
    }),
  )).json() as { talk_id: string; event_key: string };
}

Deno.test("PUT /api/talks/:id/timeline requires presenter key; GET merges chunks", async () => {
  const router = app();
  const talk = await makeTalk(router);
  const url = `http://x/api/talks/${talk.talk_id}/timeline`;

  // missing key -> 401
  const noKey = await router.fetch(
    new Request(url, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify([{ t: 0, action: { type: "join" } }]),
    }),
  );
  assertEquals(noKey.status, 401);

  // wrong key -> 403
  const bad = await router.fetch(
    new Request(url, {
      method: "PUT",
      headers: { "content-type": "application/json", "x-event-key": "nope" },
      body: JSON.stringify([{ t: 0, action: { type: "join" } }]),
    }),
  );
  assertEquals(bad.status, 403);

  // append two chunks out of order
  const put = (entries: unknown) =>
    router.fetch(
      new Request(url, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          "x-event-key": talk.event_key,
        },
        body: JSON.stringify(entries),
      }),
    );
  assertEquals(
    (await put([{ t: 2000, action: { type: "focus", page: 2, idx: 0 } }]))
      .status,
    201,
  );
  assertEquals(
    (await put([
      { t: 0, action: { type: "focus", page: 1, idx: 0 } },
      { t: 1000, action: { type: "reaction", emoji: "👏" } },
    ])).status,
    201,
  );

  const res = await router.fetch(new Request(url));
  assertEquals(res.status, 200);
  const body = await res.json() as {
    entries: Array<{ t: number; action: { type: string } }>;
  };
  // merged and sorted by t
  assertEquals(body.entries.map((e) => e.t), [0, 1000, 2000]);
  assertEquals(body.entries[2].action.type, "focus");
});

Deno.test("PUT timeline rejects invalid entries", async () => {
  const router = app();
  const talk = await makeTalk(router);
  const res = await router.fetch(
    new Request(`http://x/api/talks/${talk.talk_id}/timeline`, {
      method: "PUT",
      headers: {
        "content-type": "application/json",
        "x-event-key": talk.event_key,
      },
      body: JSON.stringify([{
        t: -1,
        action: { type: "focus", page: 1, idx: 0 },
      }]),
    }),
  );
  assertEquals(res.status, 400);
});

Deno.test("GET /t/:id/replay renders the replay client", async () => {
  const router = app();
  const talk = await makeTalk(router);
  const res = await router.fetch(
    new Request(`http://x/t/${talk.talk_id}/replay`),
  );
  assertEquals(res.status, 200);
  const html = await res.text();
  assertStringIncludes(html, "/replay.js");
  assertStringIncludes(html, "<zen-slide-viewer");
});
