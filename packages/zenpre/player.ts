/**
 * `Player` — 記録済み timeline を再生し、Action を sink(SlideViewer /
 * PostViewer / ReactionLayer)へ流し込む。
 *
 * - 再生 / 一時停止 / シーク。
 * - シークは「その時刻までの focus を再適用して状態を復元」する
 *   (reaction は一過性なのでスキップ)。
 *
 * @module
 */
import type { Action, TimelineEntry } from "./schemas.ts";

/** 再生された Action の適用先。 */
export interface ActionSink {
  apply(action: Action): void;
}

export type PlayerState = "idle" | "playing" | "paused" | "ended";

export type PlayerOptions = {
  onTick?: (positionMs: number) => void;
  onState?: (state: PlayerState) => void;
};

/**
 * entries のうち posMs 以前で最後の focus を返す(シークの状態復元用)。
 * entries は t 昇順である前提。
 */
export function focusAt(
  entries: TimelineEntry[],
  posMs: number,
): Extract<Action, { type: "focus" }> | null {
  let found: Extract<Action, { type: "focus" }> | null = null;
  for (const e of entries) {
    if (e.t > posMs) break;
    if (e.action.type === "focus") found = e.action;
  }
  return found;
}

export class Player {
  #entries: TimelineEntry[];
  #sink: ActionSink;
  #timers: number[] = [];
  #offset = 0; // 一時停止時点の再生位置(ms)
  #startWall = 0; // 再生を開始した実時刻
  #state: PlayerState = "idle";
  #opts: PlayerOptions;
  #ticker: number | undefined;

  constructor(
    entries: TimelineEntry[],
    sink: ActionSink,
    opts: PlayerOptions = {},
  ) {
    this.#entries = entries.slice().sort((a, b) => a.t - b.t);
    this.#sink = sink;
    this.#opts = opts;
  }

  /** 総再生時間(ms)。 */
  get duration(): number {
    const last = this.#entries[this.#entries.length - 1];
    return last ? last.t : 0;
  }

  get state(): PlayerState {
    return this.#state;
  }

  /** 現在の再生位置(ms)。 */
  get position(): number {
    if (this.#state === "playing") {
      return Math.min(
        this.duration,
        this.#offset + (Date.now() - this.#startWall),
      );
    }
    return this.#offset;
  }

  /** 再生を開始/再開する。 */
  play(): void {
    if (this.#state === "playing") return;
    if (this.#state === "ended" || this.#offset >= this.duration) {
      this.seek(0);
    }
    this.#startWall = Date.now();
    const from = this.#offset;
    for (const e of this.#entries) {
      if (e.t < from) continue;
      const delay = e.t - from;
      const id = globalThis.setTimeout(() => this.#sink.apply(e.action), delay);
      this.#timers.push(id);
    }
    // 終了スケジュール
    const endId = globalThis.setTimeout(
      () => this.#end(),
      this.duration - from,
    );
    this.#timers.push(endId);
    this.#setState("playing");
    this.#startTicker();
  }

  /** 一時停止する。 */
  pause(): void {
    if (this.#state !== "playing") return;
    this.#offset = this.position;
    this.#clearTimers();
    this.#stopTicker();
    this.#setState("paused");
  }

  /**
   * 指定位置(ms)へシークする。再生は止め、その時刻の focus を再適用して
   * 状態を復元する(reaction はスキップ)。
   */
  seek(posMs: number): void {
    this.#clearTimers();
    this.#stopTicker();
    this.#offset = Math.max(0, Math.min(this.duration, posMs));
    const focus = focusAt(this.#entries, this.#offset);
    if (focus) this.#sink.apply(focus);
    this.#setState(this.#offset >= this.duration ? "ended" : "paused");
    this.#opts.onTick?.(this.#offset);
  }

  /** 破棄(タイマー解放)。 */
  dispose(): void {
    this.#clearTimers();
    this.#stopTicker();
  }

  #end(): void {
    this.#offset = this.duration;
    this.#clearTimers();
    this.#stopTicker();
    this.#setState("ended");
    this.#opts.onTick?.(this.#offset);
  }

  #clearTimers(): void {
    for (const id of this.#timers) globalThis.clearTimeout(id);
    this.#timers = [];
  }

  #startTicker(): void {
    this.#stopTicker();
    this.#ticker = globalThis.setInterval(() => {
      this.#opts.onTick?.(this.position);
    }, 100);
  }

  #stopTicker(): void {
    if (this.#ticker !== undefined) {
      globalThis.clearInterval(this.#ticker);
      this.#ticker = undefined;
    }
  }

  #setState(s: PlayerState): void {
    this.#state = s;
    this.#opts.onState?.(s);
  }
}
