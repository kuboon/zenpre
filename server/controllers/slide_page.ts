/**
 * GET /s/:slide_id — スライド単体プレビュー(relay なし)。
 *
 * markdown をサーバ側で {@link renderSlideDocument} して light DOM に SSR する
 * ので、JS 無効/curl でもスライド内容が見える。クライアントの
 * `<zen-slide-viewer>`(/slide.js)が既存 DOM を拾ってスワイプ/キーボード
 * ナビゲーションを付与する(progressive enhancement)。
 */
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../routes.ts";
import type { Slides } from "../repo/slides.ts";
import { renderSlideDocument } from "../ui/slide_document.ts";

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

      const doc = await renderSlideDocument({
        title: slide.title,
        markdown: slide.markdown,
        css: slide.css,
        theme: slide.theme,
      });

      return new Response(doc, {
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    },
  } satisfies Action<typeof routes.slidePage>;
}
