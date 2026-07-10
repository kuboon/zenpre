/**
 * ZenPre server — Remix v3 (fetch-router) on Deno.
 *
 * ルート定義は `./routes.ts`、各ページのコントローラは `./controllers/`。
 * ここは middleware の設定とルート→コントローラの結線のみを行う。
 * `deno serve` / Deno Deploy から使えるよう router を default export する。
 */

import { createRouter } from "@remix-run/fetch-router";
import { staticFiles } from "@remix-run/static-middleware";

import { homeAction } from "./controllers/home.tsx";
import { routes } from "./routes.ts";

const router = createRouter({
  middleware: [
    staticFiles(new URL("../bundled", import.meta.url).pathname),
  ],
});

router.get(routes.home, homeAction);

export default router;
