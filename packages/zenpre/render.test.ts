import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { renderSlides } from "./render.ts";

Deno.test("splits pages on top-level '---' and numbers from 1", async () => {
  const md = "# One\n\ntext a\n\n---\n\n## Two\n\ntext b";
  const { pages, title } = await renderSlides(md);
  assertEquals(pages.length, 2);
  assertEquals(title, "One");
  assertStringIncludes(pages[0], "text a");
  assertStringIncludes(pages[1], "text b");
});

Deno.test("does NOT split on '---' inside a code fence", async () => {
  const md = "# Title\n\n```\nfoo\n---\nbar\n```\n";
  const { pages } = await renderSlides(md);
  assertEquals(pages.length, 1);
  assertStringIncludes(pages[0], "---");
});

Deno.test("numbers headings per page with data-page / data-idx (1-based)", async () => {
  const md = "# A\n\n## A2\n\n---\n\n# B\n\n### B2";
  const { pages, headings } = await renderSlides(md);
  // page 1
  assertStringIncludes(pages[0], 'data-page="1"');
  assertStringIncludes(pages[0], 'data-idx="1"');
  assertStringIncludes(pages[0], 'data-idx="2"');
  // page 2 restarts idx at 1
  assertStringIncludes(pages[1], 'data-page="2"');
  assertStringIncludes(pages[1], 'data-idx="1"');
  assertEquals(headings.length, 4);
  assertEquals(headings[0], { page: 1, idx: 1, depth: 1, text: "A" });
  assertEquals(headings[1], { page: 1, idx: 2, depth: 2, text: "A2" });
  assertEquals(headings[2], { page: 2, idx: 1, depth: 1, text: "B" });
  assertEquals(headings[3], { page: 2, idx: 2, depth: 3, text: "B2" });
});

Deno.test("title falls back to 'Untitled' with no h1", async () => {
  const { title } = await renderSlides("## no h1 here\n\ntext");
  assertEquals(title, "Untitled");
});

Deno.test("ignores YAML frontmatter", async () => {
  const md = "---\ntitle: x\n---\n\n# Real\n\nbody";
  const { pages, title } = await renderSlides(md);
  assertEquals(pages.length, 1);
  assertEquals(title, "Real");
  assert(!pages[0].includes("title: x"));
});

Deno.test("highlights code via shiki (adds shiki markup)", async () => {
  const md = "# Code\n\n```js\nconst x = 1;\n```\n";
  const { pages } = await renderSlides(md);
  // shiki emits a <pre class="shiki ..."> with inline color styles
  assertStringIncludes(pages[0], "shiki");
  assertStringIncludes(pages[0], "style=");
});

Deno.test("renders mermaid blocks to inline SVG", async () => {
  const md = "# Diagram\n\n```mermaid\nflowchart TD\n  A --> B\n```\n";
  const { pages } = await renderSlides(md);
  assertStringIncludes(pages[0], "zen-mermaid");
  assertStringIncludes(pages[0], "<svg");
  // must NOT be left as a highlighted code block
  assert(!pages[0].includes("language-mermaid"));
});

Deno.test("empty leading page (md starting with '---') is dropped", async () => {
  const md = "---\n\n# First\n\nbody";
  // Note: leading '---' after nothing is frontmatter-like; ensure no empty page
  const { pages } = await renderSlides(md);
  assert(pages.length >= 1);
  assertStringIncludes(pages[0], "First");
});
