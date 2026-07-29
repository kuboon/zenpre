/**
 * 接続単位の token bucket レートリミッタ(isolate 内メモリ)。
 * スパム抑止が目的なので isolate を跨ぐ厳密さは持たない。
 */
export class TokenBucket {
  #tokens: number;
  #last: number;

  constructor(
    private readonly capacity: number,
    private readonly refillPerSec: number,
    now: number,
  ) {
    this.#tokens = capacity;
    this.#last = now;
  }

  /** トークンを 1 つ消費できれば true。時間経過で補充する。 */
  take(now: number): boolean {
    const elapsed = (now - this.#last) / 1000;
    this.#last = now;
    this.#tokens = Math.min(
      this.capacity,
      this.#tokens + elapsed * this.refillPerSec,
    );
    if (this.#tokens >= 1) {
      this.#tokens -= 1;
      return true;
    }
    return false;
  }
}
