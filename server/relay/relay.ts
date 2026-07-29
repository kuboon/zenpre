/**
 * Relay — `GET /api/talks/:talk_id/ws` の WebSocket ハンドラ。
 *
 * クエリ `?key=` があれば presenter/moderator として認証、無ければ audience。
 * メッセージは {@link ActionSchema} で検証し、ロールと rate limit を確認して
 * `stage` チャンネルへ配信する。
 *
 * M2 の対応 action: join / focus(presenter のみ)/ reaction。
 * post / vote は M3(mod チャンネル)で対応する。
 */
import { type } from "arktype";
import { ActionSchema, type Down } from "@kuboon/zenpre/schemas.ts";
import { genPublicId } from "@kuboon/zenpre/keys.ts";
import type { Talks } from "../repo/talks.ts";
import { type Conn, HubRegistry } from "./hub.ts";
import { TokenBucket } from "./rate_limit.ts";

export type RelayDeps = {
  talks: Talks;
  hubs: HubRegistry;
};

const WS_PATH = /^\/api\/talks\/([^/]+)\/ws$/;

/**
 * ws ルートなら WebSocket にアップグレードして Response を返す。そうでなければ
 * null(呼び出し側は router にフォールバックする)。
 */
export async function tryHandleWs(
  req: Request,
  deps: RelayDeps,
): Promise<Response | null> {
  const url = new URL(req.url);
  const m = WS_PATH.exec(url.pathname);
  if (!m) return null;
  if (req.method !== "GET") return null;
  if (req.headers.get("upgrade")?.toLowerCase() !== "websocket") {
    return new Response("expected websocket", { status: 426 });
  }

  const talkId = m[1];
  const talk = await deps.talks.get(talkId);
  if (!talk) return new Response("talk not found", { status: 404 });

  // ロール判定(key があれば presenter/moderator、無ければ audience)。
  const key = url.searchParams.get("key");
  let role: "presenter" | "moderator" | "audience" = "audience";
  if (key) {
    const keyed = await deps.talks.roleOf(talkId, key);
    if (!keyed) return new Response("forbidden", { status: 403 });
    role = keyed;
  }

  const { socket, response } = Deno.upgradeWebSocket(req);
  const hub = deps.hubs.get(talkId);
  const audienceId = role === "presenter"
    ? "presenter"
    : role === "moderator"
    ? "mod"
    : genPublicId();

  const conn: Conn = {
    id: audienceId,
    send(down: Down) {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(down));
      }
    },
  };

  // rate buckets(接続単位)。
  const now0 = Date.now();
  const reactionBucket = new TokenBucket(5, 5, now0); // 5/秒
  const focusBucket = new TokenBucket(10, 10, now0); // 10/秒

  const sendSelf = (down: Down) => conn.send(down);

  socket.onopen = () => {
    hub.add(conn);
    hub.broadcast({ kind: "count", count: hub.localCount });
  };

  socket.onmessage = async (e: MessageEvent) => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(typeof e.data === "string" ? e.data : "");
    } catch {
      return sendSelf({ kind: "error", code: "invalid", detail: "bad json" });
    }
    const action = ActionSchema(parsed);
    if (action instanceof type.errors) {
      return sendSelf({
        kind: "error",
        code: "invalid",
        detail: action.summary,
      });
    }

    switch (action.type) {
      case "join": {
        const last_focus = await deps.talks.getLastFocus(talkId);
        sendSelf({
          kind: "welcome",
          audience_id: audienceId,
          role,
          count: hub.localCount,
          ...(last_focus && last_focus.type === "focus" ? { last_focus } : {}),
        });
        return;
      }
      case "focus": {
        if (role !== "presenter") {
          return sendSelf({ kind: "error", code: "forbidden" });
        }
        if (!focusBucket.take(Date.now())) {
          return sendSelf({ kind: "error", code: "rate_limited" });
        }
        await deps.talks.saveLastFocus(talkId, action);
        hub.broadcast({
          kind: "action",
          action,
          from: audienceId,
          ts: Date.now(),
        });
        return;
      }
      case "reaction": {
        if (!reactionBucket.take(Date.now())) {
          return sendSelf({ kind: "error", code: "rate_limited" });
        }
        hub.broadcast({
          kind: "action",
          action,
          from: audienceId,
          ts: Date.now(),
        });
        return;
      }
      // post / vote は M3 で対応(M2 では黙って無視)。
      default:
        return;
    }
  };

  const cleanup = () => {
    const emptied = hub.remove(conn);
    if (emptied) deps.hubs.drop(talkId);
    else hub.broadcast({ kind: "count", count: hub.localCount });
  };
  socket.onclose = cleanup;
  socket.onerror = cleanup;

  return response;
}

export { HubRegistry };
