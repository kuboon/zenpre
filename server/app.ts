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

/**
 * HTML ページに付与する host CSP。author `css` の `url()`/`@import` beacon や
 * markdown のリモート画像など、**untrusted なスライド内容からの外向き通信を
 * 遮断**する(同一オリジンと `data:`/`blob:` のみ許可)。
 *
 * - `connect-src 'self'` は同一オリジンの relay(wss)を許可する。
 * - `script-src` に `'unsafe-inline'` を含むのは、HTML スライドの `srcdoc`
 *   iframe が **埋め込み元(このページ)の CSP を継承**するため。継承した
 *   script-src が inline を禁じると iframe 内の author JS が動かない。host 側は
 *   author の `<script>` 注入経路が無い(markdown 内の生 HTML は破棄され、
 *   untrusted 内容は iframe に隔離される)ので inline 許可でも XSS 面は増えない。
 *   `'unsafe-eval'` は arktype 等のバリデータ生成のため。
 * - **通信遮断は維持される**: iframe 自身の meta-CSP(`connect-src 'none'` /
 *   `img-src data:`)と host の `connect-src 'self'` / `img-src 'self' data:` が
 *   両方適用(積集合)され、外向き通信は塞がれる。author `css` の
 *   `url()`/`@import` beacon も host の img/font/connect 制限で無効化される。
 */
const SITE_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "media-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join("; ");

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
    const res = await router.fetch(req);
    // HTML ページにだけ CSP を付ける(静的アセット/JSON は対象外)。
    if (res.headers.get("content-type")?.includes("text/html")) {
      res.headers.set("content-security-policy", SITE_CSP);
    }
    return res;
  };
}
