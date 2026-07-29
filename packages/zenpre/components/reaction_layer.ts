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
    const el = document.createElement("span");
    el.textContent = emoji;
    const x = 5 + Math.floor(this.#rand() * 90); // 5%〜95%
    el.style.cssText =
      `position:absolute;left:${x}%;bottom:-2rem;font-size:2rem;will-change:transform,opacity;` +
      `animation:zen-reaction-float 2.4s ease-out forwards`;
    this.appendChild(el);
    this.#beep();
    globalThis.setTimeout(() => {
      el.remove();
      this.#active--;
    }, 2400);
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

  #beep(): void {
    if (this.muted || !this.#audio) return;
    const ctx = this.#audio;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 440 + Math.random() * 440;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, ctx.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.25);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  }
}

/** custom element を登録する(重複登録は無視)。 */
export function defineReactionLayer(): void {
  if (!customElements.get("zen-reaction-layer")) {
    customElements.define("zen-reaction-layer", ZenReactionLayer);
  }
}
