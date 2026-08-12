/**
 * GET /new — markdown を書いてスライドを作るエディタ。
 *
 * ページ自体は静的(KV 不要)。ライブプレビューはクライアントで
 * `viewer.load({ markdown })`、作成は `POST /api/slides` を叩く。
 */
import type { Action } from "@remix-run/fetch-router";
import type { routes } from "../routes.ts";
import { renderEditorDocument } from "../ui/editor_document.ts";

export const newPageAction = {
  handler() {
    return new Response(renderEditorDocument(), {
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  },
} satisfies Action<typeof routes.newPage>;
