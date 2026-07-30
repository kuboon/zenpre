/**
 * `<zen-reaction-layer>` — 画面下部からフワッと浮かんで消える絵文字リアクション。
 *
 * `layer.emit(emoji)` で 1 つ飛ばす。同時表示は 30 個で間引く。初回のユーザー
 * 操作で `AudioContext` を resume し、絵文字ごとに短い合成音を鳴らす
 * (ミュートは `muted` プロパティ)。
 *
 * @module
 */
const MAX_ACTIVE = 30;
/** 上昇にかける時間(全リアクション共通・一定)。 */
const RISE_MS = 3000;

export class ZenReactionLayer extends HTMLElement {
  #active = 0;
  #audio: AudioContext | null = null;
  muted = false;

  connectedCallback(): void {
    this.style.position = "fixed";
    this.style.inset = "0";
    this.style.pointerEvents = "none";
    this.style.overflow = "hidden";
    this.style.zIndex = "50";
    // 初回ユーザー操作で AudioContext を用意(自動再生ポリシー対策)。
    const unlock = () => this.#ensureAudio();
    globalThis.addEventListener("pointerdown", unlock, { once: true });
    globalThis.addEventListener("keydown", unlock, { once: true });
  }

  /** 絵文字を 1 つ飛ばす。 */
  emit(emoji: string): void {
    if (this.#active >= MAX_ACTIVE) return;
    this.#active++;
    const x = 5 + Math.floor(this.#rand() * 90); // 5%〜95%

    // 縦(上昇)と横(揺れ)を別要素に分けて独立させる:
    // - 外側 = 一定速度でまっすぐ上昇(全リアクション共通)。
    // - 内側 = 左右の揺れ。振れ幅と周期・位相だけを個体差でばらす。
    const rise = document.createElement("span");
    rise.style.cssText =
      `position:absolute;left:${x}%;bottom:-2rem;will-change:transform,opacity;` +
      `animation:zen-reaction-rise ${RISE_MS}ms linear forwards`;

    const amp = 16 + Math.floor(this.#rand() * 24); // 16〜40px(横の振れ幅)
    const period = 0.9 + this.#rand() * 0.8; // 0.9〜1.7s(片道)
    const phase = -(this.#rand() * period * 2); // 位相をずらして同期させない
    const inner = document.createElement("span");
    inner.textContent = emoji;
    inner.style.cssText = `display:block;font-size:2rem;--zen-amp:${amp}px;` +
      `animation:zen-reaction-sway ${period.toFixed(2)}s ${
        phase.toFixed(2)
      }s ease-in-out infinite alternate`;

    rise.appendChild(inner);
    this.appendChild(rise);
    this.#beep(emoji);
    globalThis.setTimeout(() => {
      rise.remove();
      this.#active--;
    }, RISE_MS);
  }

  #rand(): number {
    // Math.random は使えるが、依存を減らすため軽い擬似乱数でも十分。
    return Math.random();
  }

  #ensureAudio(): void {
    if (this.#audio) return;
    const Ctor = globalThis.AudioContext ??
      (globalThis as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (Ctor) this.#audio = new Ctor();
  }

  #beep(emoji?: string): void {
    if (this.muted || !this.#audio) return;
    const ctx = this.#audio;
    const { type, freq } = this.#tone(emoji);
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  }

  /** 絵文字ごとに音色/音程を変える(同じ絵文字は同じ音、未知はランダム)。 */
  #tone(emoji?: string): { type: OscillatorType; freq: number } {
    // ペンタトニック音階(C5〜)で耳当たりよく。
    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5];
    const table: Record<string, { type: OscillatorType; note: number }> = {
      "👏": { type: "square", note: 0 },
      "❤️": { type: "sine", note: 2 },
      "🎉": { type: "triangle", note: 5 },
      "😂": { type: "sawtooth", note: 3 },
      "🤔": { type: "sine", note: 1 },
    };
    const hit = emoji ? table[emoji] : undefined;
    if (hit) return { type: hit.type, freq: scale[hit.note] };
    // 未知の絵文字はコードポイントから決めて「同じ絵文字は同じ音」に。
    const cp = emoji ? (emoji.codePointAt(0) ?? 0) : 0;
    const note = cp ? scale[cp % scale.length] : 440 + Math.random() * 440;
    return { type: "sine", freq: note };
  }
}

/** custom element を登録する(重複登録は無視)。 */
export function defineReactionLayer(): void {
  if (!customElements.get("zen-reaction-layer")) {
    customElements.define("zen-reaction-layer", ZenReactionLayer);
  }
}
