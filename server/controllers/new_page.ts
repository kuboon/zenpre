/**
 * markdown エディタのページ。
 *
 * - `GET /new`          — 新規作成(静的・KV 不要)
 * - `GET /s/:id/edit`   — 既存スライドの編集(markdown を読み込んで開く)
 *
 * ライブプレビューはクライアントで `viewer.load({ markdown })`。保存は
 * `POST /api/slides`(新規)/ `PATCH /api/slides/:id`(更新、`X-Slide-Key`)。
 * 編集ページ自体は公開(閲覧と同じ)で、更新できるかは鍵の有無で決まる。
 */
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../routes.ts";
import type { Slides } from "../repo/slides.ts";
import { renderEditorDocument } from "../ui/editor_document.ts";

const html = (body: string) =>
  new Response(body, {
    headers: { "content-type": "text/html; charset=utf-8" },
  });

export const newPageAction = {
  handler() {
    return html(renderEditorDocument());
  },
} satisfies Action<typeof routes.newPage>;

export function slideEditAction(slides: Slides) {
  return {
    async handler(context) {
      const slide = await slides.get(context.params.slide_id);
      if (!slide) {
        return new Response("slide not found", {
          status: 404,
          headers: { "content-type": "text/plain; charset=utf-8" },
        });
      }
      return html(renderEditorDocument(slide));
    },
  } satisfies Action<typeof routes.slideEdit>;
}
