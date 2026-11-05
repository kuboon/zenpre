/**
 * GET /s/:slide_id — スライド単体プレビュー(relay なし)。
 *
 * markdown をサーバ側で {@link renderSlideDocument} して light DOM に SSR する
 * ので、JS 無効/curl でもスライド内容が見える。クライアントの
 * `<zen-slide-viewer>`(/slide.js)が既存 DOM を拾ってスワイプ/キーボード
 * ナビゲーションを付与する(progressive enhancement)。
 *
 * X(Twitter)の Player Card にも対応する。このページ自身が `twitter:player`
 * になり、ポスト内の 480×480 の iframe でそのままめくれる。iframe 埋め込みを
 * 許すため `X-Frame-Options` / `frame-ancestors` は付けない。
 */
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../routes.ts";
import type { Slides } from "../repo/slides.ts";
import { renderSlideDocument } from "../ui/slide_document.ts";

/**
 * カードに載せる絶対 URL のオリジン。X は HTTPS しか受け付けないので、
 * TLS 終端の後ろ(`x-forwarded-proto: https`)や localhost 以外では https にする。
 */
export function publicOrigin(request: Request): string {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]
    ?.trim();
  const local = /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(
    url.hostname,
  );
  if (proto === "https" || (!local && url.protocol === "http:")) {
    url.protocol = "https:";
  }
  return url.origin;
}

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

      const origin = publicOrigin(context.request);
      // X が付け足すクエリ(?autoplay=1 等)はカードの URL に含めない。
      const pageUrl = `${origin}/s/${encodeURIComponent(slide.slide_id)}`;
      const doc = await renderSlideDocument({
        title: slide.title,
        markdown: slide.markdown,
        css: slide.css,
        theme: slide.theme,
        pageCounter: true,
        card: { url: pageUrl, image: `${origin}/card.png` },
      });

      return new Response(doc, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  } satisfies Action<typeof routes.slidePage>;
}
