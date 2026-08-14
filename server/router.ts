/**
 * ZenPre server — Remix v3 (fetch-router) on Deno.
 *
 * ルート定義は `./routes.ts`、各ページ/API のコントローラは `./controllers/`。
 * ここは HTTP ルートの結線のみ。WebSocket(relay)は router の外(`./app.ts`)で
 * アップグレードする。永続化は {@link Slides}/{@link Talks} 経由で注入する。
 */

import { createRouter, type Router } from "@remix-run/fetch-router";
import { staticFiles } from "@remix-run/static-middleware";

import { homeAction } from "./controllers/home.ts";
import { newPageAction, slideEditAction } from "./controllers/new_page.ts";
import { slidePageAction } from "./controllers/slide_page.ts";
import {
  slideGetAction,
  slidesCreateAction,
  slideUpdateAction,
} from "./controllers/api/slides.ts";
import {
  talkModerateAction,
  talkPageAction,
  talkPresentAction,
  talkReplayAction,
} from "./controllers/talk_page.ts";
import { talkGetAction, talksCreateAction } from "./controllers/api/talks.ts";
import {
  timelineGetAction,
  timelinePutAction,
} from "./controllers/api/timeline.ts";
import type { Slides } from "./repo/slides.ts";
import type { Talks } from "./repo/talks.ts";
import type { Timelines } from "./repo/timelines.ts";
import { routes } from "./routes.ts";

export type RouterDeps = { slides: Slides; talks: Talks; timelines: Timelines };

/** Slides/Talks を注入して HTTP router を組み立てる。 */
export function makeRouter(deps: RouterDeps): Router {
  const { slides, talks, timelines } = deps;
  const router = createRouter({
    middleware: [
      staticFiles(new URL("../bundled", import.meta.url).pathname),
    ],
  });

  router.get(routes.home, homeAction);
  router.get(routes.newPage, newPageAction);
  router.get(routes.slideEdit, slideEditAction(slides));
  router.get(routes.slidePage, slidePageAction(slides));
  router.get(routes.talkPage, talkPageAction(talks, slides));
  router.get(routes.talkPresent, talkPresentAction(talks, slides));
  router.get(routes.talkModerate, talkModerateAction(talks, slides));
  router.get(routes.talkReplay, talkReplayAction(talks, slides));

  router.post(routes.api.slidesCreate, slidesCreateAction(slides));
  router.get(routes.api.slideGet, slideGetAction(slides));
  router.patch(routes.api.slideUpdate, slideUpdateAction(slides));
  router.post(routes.api.talksCreate, talksCreateAction(talks, slides));
  router.get(routes.api.talkGet, talkGetAction(talks));
  router.put(routes.api.timelinePut, timelinePutAction(talks, timelines));
  router.get(routes.api.timelineGet, timelineGetAction(talks, timelines));

  return router;
}
