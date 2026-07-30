/**
 * アプリ合成 — WebSocket(relay)と HTTP router を 1 つの fetch ハンドラに束ねる。
 *
 * relay の upgrade は router に通す前に処理する(fetch-router を経由すると
 * `Deno.upgradeWebSocket` に渡す Request が変わり得るため)。
 */
import { makeRouter, type RouterDeps } from "./router.ts";
import { HubRegistry, tryHandleWs } from "./relay/relay.ts";
import { handleMcp } from "./mcp.ts";

export type AppDeps = RouterDeps;

/** fetch ハンドラを返す(`Deno.serve` / Deno Deploy から使う)。 */
export function createApp(deps: AppDeps): (req: Request) => Promise<Response> {
  const router = makeRouter(deps);
  // relay(WS)と MCP は fetch-router の外で捌く(body/upgrade の扱いのため)。
  const hubs = new HubRegistry();
  return async (req: Request): Promise<Response> => {
    const ws = await tryHandleWs(req, { talks: deps.talks, hubs });
    if (ws) return ws;
    if (new URL(req.url).pathname === "/mcp") {
      return await handleMcp(req, {
        slides: deps.slides,
        talks: deps.talks,
        hubs,
      });
    }
    return router.fetch(req);
  };
}
