/**
 * `Recorder` — presenter 端末で Action を経過時間つきで記録する。
 *
 * `record()` された Action を `{ t, action }`(t = 記録開始からの経過 ms)で
 * 貯め、未フラッシュ分を `flush()` で `onFlush` に渡す(サーバへ chunk 追記)。
 * 保存方法(HTTP PUT 等)は利用側が `onFlush` で実装する。
 *
 * @module
 */
import type { Action, TimelineEntry } from "./schemas.ts";

export type RecorderOptions = {
  /** 未保存の chunk を渡すコールバック(サーバへ追記する等)。 */
  onFlush?: (chunk: TimelineEntry[]) => void | Promise<void>;
};

export class Recorder {
  #all: TimelineEntry[] = [];
  #pending: TimelineEntry[] = [];
  #t0: number | null = null;
  #onFlush?: RecorderOptions["onFlush"];

  constructor(opts: RecorderOptions = {}) {
    this.#onFlush = opts.onFlush;
  }

  /** 記録開始時刻を 0 に設定する(未呼び出しなら最初の record で自動開始)。 */
  start(now: number = Date.now()): void {
    this.#t0 = now;
  }

  /** 記録中かどうか。 */
  get started(): boolean {
    return this.#t0 !== null;
  }

  /** Action を記録する。 */
  record(action: Action, now: number = Date.now()): void {
    if (this.#t0 === null) this.start(now);
    const entry: TimelineEntry = { t: Math.max(0, now - this.#t0!), action };
    this.#all.push(entry);
    this.#pending.push(entry);
  }

  /** これまでの全記録(コピー)。 */
  get entries(): TimelineEntry[] {
    return this.#all.slice();
  }

  /** 未フラッシュの件数。 */
  get pendingCount(): number {
    return this.#pending.length;
  }

  /** 未フラッシュ分を onFlush に渡す。失敗時は pending に戻す。 */
  async flush(): Promise<void> {
    if (this.#pending.length === 0) return;
    const chunk = this.#pending;
    this.#pending = [];
    try {
      await this.#onFlush?.(chunk);
    } catch (e) {
      // 送信失敗:次回に再送するため戻す。
      this.#pending = chunk.concat(this.#pending);
      throw e;
    }
  }
}
