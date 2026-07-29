/**
 * Deno Deploy / ローカル用エントリポイント(`deno serve -P ./main.ts`)。
 *
 * 本番の永続化は Deno KV。`./repo/deno_kv.ts` は import 時に `Deno.openKv()`
 * を呼ぶため、ここでのみ読み込む。
 */
import { createApp } from "./app.ts";
import { Slides } from "./repo/slides.ts";
import { Talks } from "./repo/talks.ts";
import { denoKvFactory } from "./repo/deno_kv.ts";

const fetch = createApp({
  slides: new Slides(denoKvFactory),
  talks: new Talks(denoKvFactory),
});

export default { fetch };
