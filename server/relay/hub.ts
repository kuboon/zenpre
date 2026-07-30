/**
 * TalkHub — 1 つの Talk に接続している WebSocket 群への配信ハブ。
 *
 * isolate 間配信は `BroadcastChannel`(deno-pubsub 方式)。同一 isolate 内の
 * ソケットへは直接送り、他 isolate へは channel.postMessage で伝える
 * (BroadcastChannel は同じインスタンスには echo しないので二重配信しない)。
 *
 * チャンネルは 2 本:
 * - `stage` … 全員向け(focus / reaction / vote / level≥1 の post / count)。
 * - `mod`   … level-0 post 専用。presenter / moderator の接続だけが購読する。
 *   これで「audience の post は moderator を通ってから全員へ」を実現する。
 */
import type { Down } from "@kuboon/zenpre/schemas.ts";

export interface Conn {
  readonly id: string;
  send(down: Down): void;
}

/** MCP(list_pending_posts)が取得する未承認 post のスナップショット。 */
export type PendingPost = { text: string; from: string; ts: number };

/** 未承認 post のリングバッファ上限(直近 N 件だけ保持)。 */
const MAX_PENDING = 100;

export class TalkHub {
  readonly talkId: string;
  #stage: BroadcastChannel;
  #mod: BroadcastChannel;
  /** 全接続(stage を受け取る)。 */
  #conns = new Set<Conn>();
  /** presenter / moderator の接続(mod チャンネルも受け取る)。#conns の部分集合。 */
  #modConns = new Set<Conn>();
  /** 直近の未承認 post(MCP の list_pending_posts 用、best-effort・isolate ローカル)。 */
  #pending: PendingPost[] = [];

  constructor(talkId: string) {
    this.talkId = talkId;
    this.#stage = new BroadcastChannel(`talk:${talkId}:stage`);
    this.#stage.onmessage = (e: MessageEvent) => {
      this.#fanout(this.#conns, e.data as Down);
    };
    this.#mod = new BroadcastChannel(`talk:${talkId}:mod`);
    this.#mod.onmessage = (e: MessageEvent) => {
      const down = e.data as Down;
      this.#recordPending(down);
      this.#fanout(this.#modConns, down);
    };
  }

  /** 接続を追加する。`mod` は presenter/moderator(mod チャンネルも購読)。 */
  add(conn: Conn, opts: { mod?: boolean } = {}): void {
    this.#conns.add(conn);
    if (opts.mod) this.#modConns.add(conn);
  }

  /** 接続を外す。ローカルが空になったら channel を閉じて true を返す。 */
  remove(conn: Conn): boolean {
    this.#conns.delete(conn);
    this.#modConns.delete(conn);
    if (this.#conns.size === 0) {
      this.#stage.close();
      this.#mod.close();
      return true;
    }
    return false;
  }

  /** このイベントを全 isolate の全接続へ配信する(stage)。 */
  broadcast(down: Down): void {
    this.#fanout(this.#conns, down);
    this.#stage.postMessage(down);
  }

  /** level-0 post を全 isolate の presenter/moderator 接続だけへ配信する(mod)。 */
  broadcastMod(down: Down): void {
    this.#recordPending(down);
    this.#fanout(this.#modConns, down);
    this.#mod.postMessage(down);
  }

  /** 指定した接続集合へ配信する。 */
  #fanout(conns: Set<Conn>, down: Down): void {
    for (const c of conns) c.send(down);
  }

  /** level-0 post をリングバッファに記録する(直近 {@link MAX_PENDING} 件)。 */
  #recordPending(down: Down): void {
    if (
      down.kind !== "action" || down.action.type !== "post" ||
      "post_id" in down.action
    ) return;
    this.#pending.push({
      text: down.action.text,
      from: down.from,
      ts: down.ts,
    });
    if (this.#pending.length > MAX_PENDING) {
      this.#pending.splice(0, this.#pending.length - MAX_PENDING);
    }
  }

  /** 未承認 post のスナップショット(古い順)。 */
  pendingPosts(): PendingPost[] {
    return [...this.#pending];
  }

  /** 同一 isolate 内の接続数(count は best-effort でこれを使う)。 */
  get localCount(): number {
    return this.#conns.size;
  }
}

/** talk_id ごとに {@link TalkHub} を 1 つだけ持つレジストリ。 */
export class HubRegistry {
  #hubs = new Map<string, TalkHub>();

  get(talkId: string): TalkHub {
    let hub = this.#hubs.get(talkId);
    if (!hub) {
      hub = new TalkHub(talkId);
      this.#hubs.set(talkId, hub);
    }
    return hub;
  }

  /** 既存の hub があれば返す(無ければ作らない)。MCP からの読み取り用。 */
  peek(talkId: string): TalkHub | undefined {
    return this.#hubs.get(talkId);
  }

  /** この isolate が把握している未承認 post(hub が無ければ空)。 */
  pendingPosts(talkId: string): PendingPost[] {
    return this.#hubs.get(talkId)?.pendingPosts() ?? [];
  }

  /**
   * stage(全員)へ配信する。ローカル hub があればそれを使い、無ければ
   * 一時 BroadcastChannel で他 isolate の hub へ届ける(MCP publish_post 用)。
   */
  publishStage(talkId: string, down: Down): void {
    const hub = this.#hubs.get(talkId);
    if (hub) {
      hub.broadcast(down);
      return;
    }
    const ch = new BroadcastChannel(`talk:${talkId}:stage`);
    ch.postMessage(down);
    // postMessage の配送完了を待ってから閉じる(即時 close はメッセージを落とし得る)。
    globalThis.setTimeout(() => ch.close(), 100);
  }

  drop(talkId: string): void {
    this.#hubs.delete(talkId);
  }
}
