/**
 * ZenPre server — Remix v3 (fetch-router) on Deno.
 *
 * ルート定義は `./routes.ts`、各ページ/API のコントローラは `./controllers/`。
 * ここは middleware の設定とルート→コントローラの結線のみを行う。
 *
 * 永続化バックエンドは {@link Slides} 経由で注入する({@link makeRouter} の
 * 引数)。本番は Deno KV(main.ts)、テストは memory を渡す。
 */

import { createRouter, type Router } from "@remix-run/fetch-router";
import { staticFiles } from "@remix-run/static-middleware";

import { homeAction } from "./controllers/home.ts";
import { slidePageAction } from "./controllers/slide_page.ts";
import {
  slideGetAction,
  slidesCreateAction,
  slideUpdateAction,
} from "./controllers/api/slides.ts";
import type { Slides } from "./repo/slides.ts";
import { routes } from "./routes.ts";

/** Slides サービスを注入して router を組み立てる。 */
export function makeRouter(slides: Slides): Router {
  const router = createRouter({
    middleware: [
      staticFiles(new URL("../bundled", import.meta.url).pathname),
    ],
  });

  router.get(routes.home, homeAction);
  router.get(routes.slidePage, slidePageAction(slides));
  router.post(routes.api.slidesCreate, slidesCreateAction(slides));
  router.get(routes.api.slideGet, slideGetAction(slides));
  router.patch(routes.api.slideUpdate, slideUpdateAction(slides));

  return router;
}
