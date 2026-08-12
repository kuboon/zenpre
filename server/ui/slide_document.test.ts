import { assert, assertStringIncludes } from "@std/assert";
import { renderSlideDocument } from "./slide_document.ts";

const doc = (cta?: { href: string; label: string }) =>
  renderSlideDocument({ title: "t", markdown: "# Hi", cta });

Deno.test("CTA: 同一サイト内リンクだけを出力する", async () => {
  assertStringIncludes(
    await doc({ href: "/new", label: "作る" }),
    '<a class="zen-cta" href="/new">作る</a>',
  );
  // フラグメント・クエリも内部遷移として許可
  assertStringIncludes(
    await doc({ href: "#top", label: "上へ" }),
    'href="#top"',
  );
});

Deno.test("CTA: 危険なスキーム/外部 URL は落とす", async () => {
  for (
    const href of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "https://evil.example/",
      "//evil.example/", // スキーム相対
    ]
  ) {
    const html = await doc({ href, label: "x" });
    assert(!html.includes("zen-cta"), `CTA should be dropped for: ${href}`);
  }
});
