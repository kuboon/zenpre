/**
 * GET /s/:slide_id — スライド単体プレビュー(relay なし)。
 *
 * markdown をサーバ側で {@link renderSlides} してページ HTML を light DOM に
 * SSR するので、JS 無効/curl でもスライド内容が見える。クライアントの
 * `<zen-slide-viewer>`(/slide.js)が既存 DOM を拾ってスワイプ/キーボード
 * ナビゲーションを付与する(progressive enhancement)。
 */
import { renderSlides } from "@kuboon/zenpre/render.ts";
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../routes.ts";
import type { Slides } from "../repo/slides.ts";

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (
      c,
    ) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[
      c
    ]!),
  );

/** author CSS を `<style>` に埋める前の最小サニタイズ(style/script の閉じタグ封じ)。 */
const sanitizeCss = (css: string): string =>
  css.replace(/<\/(style|script)/gi, "<\\/$1");

export function slidePageAction(slides: Slides) {
  return {
    async handler(context) {
      const slide = await slides.get(context.params.slide_id);
      if (!slide) {
        return new Response("slide not found", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }

      const rendered = await renderSlides(slide.markdown);
      const pagesHtml = rendered.pages
        .map((html, i) =>
          `<section class="zen-page" data-page="${i + 1}">${html}</section>`
        )
        .join("");

      // クライアント側 enhancement 用データ(SSR children が無い場合の再構築にも使う)
      const data = JSON.stringify({
        pages: rendered.pages,
        headings: rendered.headings,
        theme: slide.theme,
      }).replace(/</g, "\\u003c");

      const doc = `<!doctype html>
<html lang="ja" data-theme="${escapeHtml(slide.theme)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(slide.title)} — ZenPre</title>
<link rel="stylesheet" href="/style.css">
<style>${sanitizeCss(slide.css)}</style>
</head>
<body>
<zen-slide-viewer><div class="zen-track">${pagesHtml}</div></zen-slide-viewer>
<script type="application/json" id="zen-slide-data">${data}</script>
<script type="module" src="/slide.js"></script>
</body>
</html>`;

      return new Response(doc, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  } satisfies Action<typeof routes.slidePage>;
}
