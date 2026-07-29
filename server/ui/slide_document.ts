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
  /** 読み込むクライアントスクリプト(default: "/slide.js")。 */
  clientScript?: string;
  /** Talk(relay)にひも付ける場合の設定。 */
  talk?: { talk_id: string; role: "audience" | "presenter" };
};

/** スライド表示用の完全な HTML ドキュメントを返す。 */
export async function renderSlideDocument(
  input: SlideDocInput,
): Promise<string> {
  const theme = input.theme ?? "light";
  const rendered = await renderSlides(input.markdown, {});
  const pagesHtml = rendered.pages
    .map((html, i) =>
      `<section class="zen-page" data-page="${
        i + 1
      }"><div class="zen-content prose prose-sm">${html}</div></section>`
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

  const clientScript = input.clientScript ?? "/slide.js";
  const talkScript = input.talk
    ? `\n<script type="application/json" id="zen-talk-data">${
      JSON.stringify(input.talk).replace(/</g, "\\u003c")
    }</script>`
    : "";
  const reactionLayer = input.talk
    ? "\n<zen-reaction-layer></zen-reaction-layer>"
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
<div class="zen-stage">
<div class="mockup-phone">
<div class="mockup-phone-camera"></div>
<div class="mockup-phone-display">
<zen-slide-viewer${autoplayAttr}><div class="zen-track">${pagesHtml}</div></zen-slide-viewer>${reactionLayer}
</div>
</div>
</div>
<script type="application/json" id="zen-slide-data">${data}</script>${talkScript}
<script type="module" src="${clientScript}"></script>
</body>
</html>`;
}
