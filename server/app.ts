/**
 * アプリ合成 — WebSocket(relay)と HTTP router を 1 つの fetch ハンドラに束ねる。
 *
 * relay の upgrade は router に通す前に処理する(fetch-router を経由すると
 * `Deno.upgradeWebSocket` に渡す Request が変わり得るため)。
 */
import { makeRouter, type RouterDeps } from "./router.ts";
import { HubRegistry, tryHandleWs } from "./relay/relay.ts";

export type AppDeps = RouterDeps;

/** fetch ハンドラを返す(`Deno.serve` / Deno Deploy から使う)。 */
export function createApp(deps: AppDeps): (req: Request) => Promise<Response> {
  const router = makeRouter(deps);
  const hubs = new HubRegistry();
  return async (req: Request): Promise<Response> => {
    const ws = await tryHandleWs(req, { talks: deps.talks, hubs });
    if (ws) return ws;
    return router.fetch(req);
  };
}
