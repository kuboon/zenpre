import markdownToHtml from "./markdown.ts";
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
