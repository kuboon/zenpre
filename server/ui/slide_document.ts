/**
 * スライド 1 枚を丸ごと表示する HTML ドキュメントの生成。
 *
 * `/s/:slide_id`(KV のスライド)とトップページ(`/` の自動再生プレゼン)の
 * 両方から使う共通レンダラ。markdown を {@link renderSlides} で multipage HTML
 * にして light DOM に SSR し、`<zen-slide-viewer>`(/slide.js)が enhancement
 * する。`autoplay` を渡すとビューアが自動でページ送りする。
 */
import { renderSlides } from "@kuboon/zenpre/render.ts";

const escapeHtml = (s: string): string =>
  s.replace(
    /[&<>"']/g,
    (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]!),
  );

/** author CSS を `<style>` に埋める前の最小サニタイズ(style/script の閉じタグ封じ)。 */
const sanitizeCss = (css: string): string =>
  css.replace(/<\/(style|script)/gi, "<\\/$1");

export type SlideDocInput = {
  title: string;
  markdown: string;
  css?: string;
  theme?: string;
  /** 自動再生する場合の 1 ページあたりの表示時間(ms)。省略で自動再生なし。 */
  autoplayMs?: number;
};

/** スライド表示用の完全な HTML ドキュメントを返す。 */
export async function renderSlideDocument(
  input: SlideDocInput,
): Promise<string> {
  const theme = input.theme ?? "light";
  const rendered = await renderSlides(input.markdown, {});
  const pagesHtml = rendered.pages
    .map((html, i) =>
      `<section class="zen-page" data-page="${i + 1}">${html}</section>`
    )
    .join("");

  const data = JSON.stringify({
    pages: rendered.pages,
    headings: rendered.headings,
    theme,
    autoplayMs: input.autoplayMs,
  }).replace(/</g, "\\u003c");

  const autoplayAttr = input.autoplayMs
    ? ` autoplay data-autoplay-ms="${input.autoplayMs}"`
    : "";

  return `<!doctype html>
<html lang="ja" data-theme="${escapeHtml(theme)}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(input.title)} — ZenPre</title>
<link rel="stylesheet" href="/style.css">
<style>${sanitizeCss(input.css ?? "")}</style>
</head>
<body>
<zen-slide-viewer${autoplayAttr}><div class="zen-track">${pagesHtml}</div></zen-slide-viewer>
<script type="application/json" id="zen-slide-data">${data}</script>
<script type="module" src="/slide.js"></script>
</body>
</html>`;
}
