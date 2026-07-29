/**
 * `RelayClient` — Talk の relay(WebSocket)に接続するクライアント。
 *
 * - 接続先 server は設定可能(本体サイトは同一 origin、セルフホストは
 *   `https://zenpre.deno.dev` を指定)。
 * - 指数バックオフで自動再接続し、接続/再接続のたびに `join` を送る。
 * - 受信 envelope({@link Down})を型付きコールバックに配る。
 *
 * @module
 */
import type { Action, Down } from "./schemas.ts";

/** {@link RelayClient} のイベントハンドラ。 */
export type RelayHandlers = {
  onWelcome?: (welcome: Extract<Down, { kind: "welcome" }>) => void;
  onAction?: (msg: Extract<Down, { kind: "action" }>) => void;
  onCount?: (count: number) => void;
  onError?: (err: Extract<Down, { kind: "error" }>) => void;
  onOpen?: () => void;
  onClose?: () => void;
};

/** {@link RelayClient} の接続設定。 */
export type RelayOptions = {
  /** talk_id。 */
  talkId: string;
  /** 接続先 server の origin(default: `location.origin`)。 */
  server?: string;
  /** presenter/moderator の capability key(audience は省略)。 */
  key?: string;
  handlers?: RelayHandlers;
};

const MAX_BACKOFF_MS = 15000;

export class RelayClient {
  #opts: RelayOptions;
  #ws: WebSocket | null = null;
  #backoff = 500;
  #closed = false;

  constructor(opts: RelayOptions) {
    this.#opts = opts;
  }

  /** WebSocket URL を組み立てる(http(s)→ws(s))。 */
  get url(): string {
    const origin = this.#opts.server ?? globalThis.location.origin;
    const u = new URL(`/api/talks/${this.#opts.talkId}/ws`, origin);
    u.protocol = u.protocol === "https:" ? "wss:" : "ws:";
    if (this.#opts.key) u.searchParams.set("key", this.#opts.key);
    return u.toString();
  }

  /** 接続を開始する(以後は自動再接続する)。 */
  connect(): void {
    this.#closed = false;
    this.#open();
  }

  #open(): void {
    const ws = new WebSocket(this.url);
    this.#ws = ws;
    const h = this.#opts.handlers ?? {};

    ws.onopen = () => {
      this.#backoff = 500;
      this.send({ type: "join" });
      h.onOpen?.();
    };
    ws.onmessage = (e: MessageEvent) => {
      let down: Down;
      try {
        down = JSON.parse(e.data as string) as Down;
      } catch {
        return;
      }
      switch (down.kind) {
        case "welcome":
          h.onWelcome?.(down);
          break;
        case "action":
          h.onAction?.(down);
          break;
        case "count":
          h.onCount?.(down.count);
          break;
        case "error":
          h.onError?.(down);
          break;
      }
    };
    ws.onclose = () => {
      h.onClose?.();
      if (!this.#closed) this.#scheduleReconnect();
    };
    ws.onerror = () => ws.close();
  }

  #scheduleReconnect(): void {
    const wait = this.#backoff;
    this.#backoff = Math.min(this.#backoff * 2, MAX_BACKOFF_MS);
    globalThis.setTimeout(() => {
      if (!this.#closed) this.#open();
    }, wait);
  }

  /** action を送信する(未接続時は破棄)。 */
  send(action: Action): void {
    if (this.#ws && this.#ws.readyState === WebSocket.OPEN) {
      this.#ws.send(JSON.stringify(action));
    }
  }

  /** 接続を閉じ、自動再接続も止める。 */
  close(): void {
    this.#closed = true;
    this.#ws?.close();
    this.#ws = null;
  }
}
