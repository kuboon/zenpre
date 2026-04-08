import { markdownToHtml, slideshowToHtml } from "./markdown.ts";
import { assertEquals } from "@std/assert";

const normalizeHtml = (html: string) =>
  html
    .replace(/>\s+</g, "><")
    .replace(/\s+/g, " ")
    .trim();

Deno.test("markdownToHtml should convert markdown to HTML", async () => {
  const markdown = "# Hello World\nThis is a test.";
  const actualHtml = await markdownToHtml(markdown);
  assertEquals(
    normalizeHtml(actualHtml),
    normalizeHtml("<h1>Hello World</h1><p>This is a test.</p>"),
  );
});

Deno.test("mermaid support", async () => {
  const markdown = "```mermaid\ngraph TD\nA-->B\n```";
  const actualHtml = await markdownToHtml(markdown);

  // Mermaid rendering output can vary between versions, so we only check core shape.
  assertEquals(actualHtml.includes("beautiful-mermaid"), true);
  assertEquals(actualHtml.includes("<svg"), true);
});

Deno.test("shiki support", async () => {
  const markdown = "```ts\nconst answer = 42;\n```";
  const actualHtml = await markdownToHtml(markdown);

  // Rehype Shiki output shape can differ by version, so test only stable markers.
  assertEquals(actualHtml.includes('class="shiki'), true);
  assertEquals(actualHtml.includes("const"), true);
  assertEquals(actualHtml.includes("answer"), true);
});

Deno.test("slideshowToHtml splits pages by ---", async () => {
  const markdown = "# Slide 1\nContent\n---\n# Slide 2\nMore";
  const html = await slideshowToHtml(markdown);

  assertEquals(html.includes('data-page="1"'), true);
  assertEquals(html.includes('data-page="2"'), true);
  assertEquals(html.includes("Slide 1"), true);
  assertEquals(html.includes("Slide 2"), true);
});

Deno.test("slideshowToHtml adds data-anchor to headings", async () => {
  const markdown = "# First\n## Second\n---\n# Third";
  const html = await slideshowToHtml(markdown);

  // Page 1 headings should get data-anchor="0" and data-anchor="1"
  assertEquals(html.includes('data-anchor="0"'), true);
  assertEquals(html.includes('data-anchor="1"'), true);
  // Page 2 heading resets anchor index to 0
  const page2 = html.split('data-page="2"')[1];
  assertEquals(page2?.includes('data-anchor="0"'), true);
});

Deno.test("slideshowToHtml wraps single page without separator", async () => {
  const markdown = "# Hello";
  const html = await slideshowToHtml(markdown);

  assertEquals(html.includes('data-page="1"'), true);
  assertEquals(html.includes('data-page="2"'), false);
});
