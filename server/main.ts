/**
 * Deno Deploy / ローカル用エントリポイント(`deno serve -P ./main.ts`)。
 *
 * 本番の永続化は Deno KV。`./repo/deno_kv.ts` は import 時に `Deno.openKv()`
 * を呼ぶため、ここでのみ読み込む。
 */
import { makeRouter } from "./router.ts";
import { Slides } from "./repo/slides.ts";
import { denoKvFactory } from "./repo/deno_kv.ts";

const router = makeRouter(new Slides(denoKvFactory));

export default {
  fetch(req: Request): Response | Promise<Response> {
    return router.fetch(req);
  },
};
