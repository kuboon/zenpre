/**
 * `<zen-slide-viewer>` — スワイプ/キーボードでめくる縦長フルスクリーンの
 * スライドビューア(フレームワーク非依存の Web Component、light DOM)。
 *
 * 使い方は 2 通り:
 * 1. **SSR + enhancement**: サーバが `.zen-track > .zen-page` を light DOM に
 *    出力しておき、connectedCallback がそれを拾ってナビゲーションを付与する。
 * 2. **クライアント構築**: `viewer.load({ pages })` で描画済みページ HTML から
 *    DOM を組み立てる(SSR children が無い場合の self-host 用)。
 *
 * ページ遷移は横方向 scroll-snap(CSS)。左右キー/画面端タップでも移動する。
 * `apply(action)` は focus/reaction を反映する(reaction は M2 で拡張)。
 *
 * @module
 */
import type { Action } from "../schemas.ts";

/** `viewer.load()` に渡す描画済みスライド。 */
export type SlideData = {
  /** ページごとの HTML(`renderSlides` の結果)。 */
  pages: string[];
  /** daisyUI theme 名(あれば `data-theme` に反映)。 */
  theme?: string;
};

export class ZenSlideViewer extends HTMLElement {
  #track: HTMLElement | null = null;
  #follow = true;

  connectedCallback(): void {
    // 既に SSR された track があればそれを使う。無ければ埋め込みデータから構築。
    this.#track = this.querySelector<HTMLElement>(".zen-track");
    if (!this.#track) {
      const data = this.#readEmbeddedData();
      if (data) this.load(data);
    }
    this.#wire();
  }

  /** 描画済みページから DOM を構築する。 */
  load(data: SlideData): void {
    if (data.theme) {
      document.documentElement.setAttribute("data-theme", data.theme);
    }
    const track = document.createElement("div");
    track.className = "zen-track";
    data.pages.forEach((html, i) => {
      const section = document.createElement("section");
      section.className = "zen-page";
      section.dataset.page = String(i + 1);
      section.innerHTML = html;
      track.appendChild(section);
    });
    this.replaceChildren(track);
    this.#track = track;
    this.#wire();
  }

  /** relay/timeline からの action を反映する。 */
  apply(action: Action): void {
    if (action.type === "focus") {
      this.#follow = true;
      this.focusOn(action.page, action.idx);
    }
    // reaction / post 等は M2 以降で対応。
  }

  /** 指定ページ(1 起点)へ移動し、idx>0 なら該当 heading を軽く強調する。 */
  focusOn(page: number, idx = 0): void {
    const pages = this.#pages();
    const target = pages[page - 1];
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", inline: "start" });
    if (idx > 0) {
      const heading = target.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
      if (heading) {
        heading.scrollIntoView({ behavior: "smooth", block: "center" });
        heading.classList.add("zen-focus");
        globalThis.setTimeout(
          () => heading.classList.remove("zen-focus"),
          1200,
        );
      }
    }
  }

  /** 現在表示中のページ番号(1 起点)。 */
  get currentPage(): number {
    const track = this.#track;
    if (!track) return 1;
    const w = track.clientWidth || 1;
    return Math.round(track.scrollLeft / w) + 1;
  }

  #pages(): HTMLElement[] {
    return Array.from(this.querySelectorAll<HTMLElement>(".zen-page"));
  }

  #go(delta: number): void {
    const next = this.currentPage + delta;
    this.#follow = false;
    this.focusOn(next);
  }

  #wire(): void {
    if (!this.#track) return;
    if (this.dataset.wired === "1") return;
    this.dataset.wired = "1";

    this.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") this.#go(1);
      else if (e.key === "ArrowLeft") this.#go(-1);
    });
    this.tabIndex = 0;

    // 画面左右端タップでのページ送り(縦スクロールを邪魔しない端 12%)。
    this.addEventListener("click", (e) => {
      const x = (e as MouseEvent).clientX;
      const w = globalThis.innerWidth;
      if (x < w * 0.12) this.#go(-1);
      else if (x > w * 0.88) this.#go(1);
    });

    // ユーザーが自分でページを変えたら follow を一時解除(M2 で「追従に戻る」UI)。
    this.#track.addEventListener("scroll", () => {
      this.dispatchEvent(
        new CustomEvent("zen-navigate", {
          detail: { page: this.currentPage, following: this.#follow },
          bubbles: true,
        }),
      );
    }, { passive: true });
  }

  #readEmbeddedData(): SlideData | null {
    const el = document.getElementById("zen-slide-data");
    if (!el) return null;
    try {
      return JSON.parse(el.textContent ?? "") as SlideData;
    } catch {
      return null;
    }
  }
}

/** custom element を登録する(重複登録は無視)。 */
export function defineSlideViewer(): void {
  if (!customElements.get("zen-slide-viewer")) {
    customElements.define("zen-slide-viewer", ZenSlideViewer);
  }
}
