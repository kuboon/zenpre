/**
 * Relay — `GET /api/talks/:talk_id/ws` の WebSocket ハンドラ。
 *
 * クエリ `?key=` があれば presenter/moderator として認証、無ければ audience。
 * メッセージは {@link ActionSchema} で検証し、ロールと rate limit を確認して
 * `stage` / `mod` チャンネルへ配信する。
 *
 * 対応 action: join / focus(presenter のみ)/ reaction / post / vote。
 * - level-0 post は `mod` チャンネル(presenter/moderator のみ受信)。
 * - level≥1 post(presenter/moderator が承認)と vote は `stage`(全員)。
 */
import { type } from "arktype";
import {
  ActionSchema,
  type Down,
  POST_TEXT_MAX_GRAPHEMES,
} from "@kuboon/zenpre/schemas.ts";
import { genPublicId } from "@kuboon/zenpre/keys.ts";
import type { Talks } from "../repo/talks.ts";
import { type Conn, HubRegistry } from "./hub.ts";
import { TokenBucket } from "./rate_limit.ts";

export type RelayDeps = {
  talks: Talks;
  hubs: HubRegistry;
};

const WS_PATH = /^\/api\/talks\/([^/]+)\/ws$/;

/** grapheme 数を数える(絵文字等の多バイト文字を 1 と数える)。 */
function graphemeLength(s: string): number {
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    let n = 0;
    for (
      const _ of new Seg(undefined, { granularity: "grapheme" }).segment(s)
    ) {
      n++;
    }
    return n;
  }
  return [...s].length;
}

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
  const isMod = role !== "audience";
  const audienceId = role === "presenter"
    ? "presenter"
    : role === "moderator"
    ? `mod:${genPublicId()}`
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
  const postBucket = new TokenBucket(1, 0.1, now0); // 1 通 / 10 秒
  const voteBucket = new TokenBucket(1, 1, now0); // 1/秒

  const sendSelf = (down: Down) => conn.send(down);

  socket.onopen = () => {
    hub.add(conn, { mod: isMod });
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
      case "post": {
        if (graphemeLength(action.text) > POST_TEXT_MAX_GRAPHEMES) {
          return sendSelf({
            kind: "error",
            code: "invalid",
            detail: `text exceeds ${POST_TEXT_MAX_GRAPHEMES} graphemes`,
          });
        }
        if ("post_id" in action) {
          // level≥1 = presenter/moderator による承認・再配信 → stage(全員)。
          if (role === "audience") {
            return sendSelf({ kind: "error", code: "forbidden" });
          }
          hub.broadcast({
            kind: "action",
            action,
            from: audienceId,
            ts: Date.now(),
          });
          return;
        }
        // level 0 = audience 発 → mod チャンネル(presenter/moderator のみ)。
        if (!postBucket.take(Date.now())) {
          return sendSelf({ kind: "error", code: "rate_limited" });
        }
        hub.broadcastMod({
          kind: "action",
          action,
          from: audienceId,
          ts: Date.now(),
        });
        return;
      }
      case "vote": {
        if (!voteBucket.take(Date.now())) {
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
