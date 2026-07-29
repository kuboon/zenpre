/**
 * TalkHub — 1 つの Talk に接続している WebSocket 群への配信ハブ。
 *
 * isolate 間配信は `BroadcastChannel`(deno-pubsub 方式)。同一 isolate 内の
 * ソケットへは直接送り、他 isolate へは channel.postMessage で伝える
 * (BroadcastChannel は同じインスタンスには echo しないので二重配信しない)。
 *
 * M2 は全員向けの `stage` チャンネルのみ。level-0 post 専用の `mod`
 * チャンネルは M3 で追加する。
 */
import type { Down } from "@kuboon/zenpre/schemas.ts";

export interface Conn {
  readonly id: string;
  send(down: Down): void;
}

export class TalkHub {
  readonly talkId: string;
  #stage: BroadcastChannel;
  #conns = new Set<Conn>();

  constructor(talkId: string) {
    this.talkId = talkId;
    this.#stage = new BroadcastChannel(`talk:${talkId}:stage`);
    this.#stage.onmessage = (e: MessageEvent) => {
      this.#fanoutLocal(e.data as Down);
    };
  }

  add(conn: Conn): void {
    this.#conns.add(conn);
  }

  /** 接続を外す。ローカルが空になったら channel を閉じて true を返す。 */
  remove(conn: Conn): boolean {
    this.#conns.delete(conn);
    if (this.#conns.size === 0) {
      this.#stage.close();
      return true;
    }
    return false;
  }

  /** このイベントを全 isolate の全接続へ配信する。 */
  broadcast(down: Down): void {
    this.#fanoutLocal(down);
    this.#stage.postMessage(down);
  }

  /** 同一 isolate 内の接続だけへ配信する。 */
  #fanoutLocal(down: Down): void {
    for (const c of this.#conns) c.send(down);
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

  drop(talkId: string): void {
    this.#hubs.delete(talkId);
  }
}
