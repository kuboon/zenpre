/**
 * `<zen-slide-viewer>` — スワイプ/キーボードでめくる縦長フルスクリーンの
 * スライドビューア(フレームワーク非依存の Web Component、light DOM)。
 *
 * 使い方は 3 通り:
 * 1. **SSR + enhancement**: サーバが `.zen-track > .zen-page` を light DOM に
 *    出力しておき、connectedCallback がそれを拾ってナビゲーションを付与する。
 * 2. **クライアント構築(描画済み)**: `viewer.load({ pages })` で描画済みページ
 *    HTML から DOM を組み立てる。
 * 3. **クライアント構築(markdown)**: `viewer.load({ markdown, css?, theme? })`。
 *    内部で `renderSlides()` を動的 import して描画する(セルフホスト用)。
 *
 * ページ遷移は横方向 scroll-snap(CSS)。左右キー/画面端タップでも移動する。
 * `autoplay`(属性 or `load({ autoplayMs })`)で自動再生し、ユーザー操作で停止。
 * `apply(action)` は focus を反映する。`connect()` で relay に接続すると
 * presenter の focus 追従・reaction 表示・post 集計まで面倒を見る(セルフホスト用)。
 *
 * @module
 */
import type { Action } from "../schemas.ts";

/** `viewer.load()` に渡すスライド(`pages` 描画済み or `markdown` 生)。 */
export type SlideData = {
  /** ページごとの HTML(`renderSlides` の結果)。`markdown` と排他。 */
  pages?: string[];
  /** 生 markdown。渡すと `renderSlides()` で描画する(`pages` があればそちら優先)。 */
  markdown?: string;
  /** 追加 CSS(markdown 経路で `<style>` として差し込む)。 */
  css?: string;
  /** daisyUI theme 名(あれば `data-theme` に反映)。 */
  theme?: string;
  /**
   * コードハイライト(shiki)のテーマ名。省略時は shiki の既定。
   * daisyUI の {@link SlideData.theme} とは**別物**なので混同しないこと
   * (`synthwave` 等は shiki のテーマではなく、渡すと例外になる)。
   */
  codeTheme?: string;
  /** 自動再生する場合の 1 ページあたりの表示時間(ms)。 */
  autoplayMs?: number;
};

/** {@link ZenSlideViewer.connect} のオプション。 */
export type TalkConnectOptions = {
  /** talk_id。 */
  talkId: string;
  /** 接続先 relay の origin(default: 同一 origin。セルフホストは zenpre.heartrails.deno.net 等)。 */
  server?: string;
  /** presenter/moderator の capability key(audience は省略)。 */
  key?: string;
};

/** {@link ZenSlideViewer.connect} が返すハンドル。 */
export type TalkConnection = {
  sendReaction(emoji: string): void;
  sendPost(text: string): void;
  sendVote(postId: string): void;
  disconnect(): void;
};

/** connect() が関知する近傍コンポーネント(あれば連携する)。 */
type ReactionLayerEl = HTMLElement & { emit(emoji: string): void };
type PostViewerEl = HTMLElement & {
  myId: string;
  applyPost(p: { post_id: string; text: string; level: number }): void;
  applyVote(postId: string, from: string): void;
};
type RelayLike = {
  connect(): void;
  send(action: Action): void;
  close(): void;
};

/** focus した見出しを置く位置(ページの高さに対する割合、上から)。 */
const HEADING_OFFSET = 0.08;
/** 「いま読んでいる見出し」とみなす基準線(ページの高さに対する割合、上から)。 */
const CURRENT_LINE = 0.25;

export class ZenSlideViewer extends HTMLElement {
  #track: HTMLElement | null = null;
  #follow = true;
  #autoplayMs = 0;
  #autoTimer: number | undefined;

  connectedCallback(): void {
    // 既に SSR された track があればそれを使う。無ければ埋め込みデータから構築。
    this.#track = this.querySelector<HTMLElement>(".zen-track");
    const attrMs = Number(this.dataset.autoplayMs ?? "");
    if (attrMs > 0) this.#autoplayMs = attrMs;
    if (!this.#track) {
      const data = this.#readEmbeddedData();
      if (data) this.load(data);
    }
    this.#wire();
    this.#startAutoplayIfNeeded();
  }

  disconnectedCallback(): void {
    this.#stopAutoplay();
  }

  /**
   * スライドを構築する。`pages`(描画済み)があればそれを、無ければ `markdown` を
   * `renderSlides()`(動的 import)で描画して使う。markdown 経路は非同期。
   */
  load(data: SlideData): void | Promise<void> {
    if (data.theme) {
      document.documentElement.setAttribute("data-theme", data.theme);
    }
    if (data.autoplayMs && data.autoplayMs > 0) {
      this.#autoplayMs = data.autoplayMs;
    }
    if (data.pages) {
      this.#build(data.pages, data.css);
      return;
    }
    if (data.markdown !== undefined) {
      // renderSlides は unified/shiki/mermaid を伴うので必要時だけ動的 import。
      // shiki には codeTheme のみ渡す(daisyUI の theme を渡すと shiki が
      // 未知テーマとして throw する)。SSR の renderSlideDocument と同じ挙動。
      return import("../render.ts").then(({ renderSlides }) =>
        renderSlides(
          data.markdown as string,
          data.codeTheme ? { theme: data.codeTheme } : {},
        )
      ).then((r) => this.#build(r.pages, data.css));
    }
  }

  /**
   * 描画済みページ HTML から track を組み立てる。作り直し(エディタの
   * ライブプレビュー等)では、見ていたページと縦スクロール位置を引き継ぐ。
   */
  #build(pages: string[], css?: string): void {
    const prevPage = this.#track ? this.currentPage : 0;
    const prevTop = this.#pages()[prevPage - 1]?.scrollTop ?? 0;
    const track = document.createElement("div");
    track.className = "zen-track";
    pages.forEach((html, i) => {
      const section = document.createElement("section");
      section.className = "zen-page";
      section.dataset.page = String(i + 1);
      section.innerHTML =
        `<div class="zen-content prose prose-sm">${html}</div>`;
      track.appendChild(section);
    });
    this.replaceChildren(track);
    if (css) {
      const style = document.createElement("style");
      style.textContent = css;
      this.prepend(style);
    }
    this.#track = track;
    if (prevPage > 1 || prevTop > 0) {
      const page = Math.min(prevPage, pages.length);
      track.scrollLeft = (page - 1) * track.clientWidth;
      const el = this.#pages()[page - 1];
      if (el) el.scrollTop = prevTop;
    }
    this.dataset.wired = "";
    this.#wire();
    this.#startAutoplayIfNeeded();
  }

  /**
   * relay に接続して presenter の focus に追従する(セルフホスト向け)。
   * ページ内に `<zen-reaction-layer>` / `<zen-post-viewer>` があれば、
   * reaction 表示・post 集計・投稿フォームの送信も自動で結線する。
   * RelayClient は必要時だけ動的 import する。
   */
  connect(opts: TalkConnectOptions): TalkConnection {
    const layer = document.querySelector<ReactionLayerEl>("zen-reaction-layer");
    const postViewer = document.querySelector<PostViewerEl>("zen-post-viewer");
    let relay: RelayLike | null = null;

    const send = (action: Action) => relay?.send(action);

    // post viewer の投稿/投票フォームを送信に結線。
    postViewer?.addEventListener("zen-post", (e) => {
      const { text } = (e as CustomEvent<{ text: string }>).detail;
      send({ type: "post", text, level: 0 });
    });
    postViewer?.addEventListener("zen-vote", (e) => {
      const { post_id } = (e as CustomEvent<{ post_id: string }>).detail;
      send({ type: "vote", post_id });
    });

    import("../relay_client.ts").then(({ RelayClient }) => {
      relay = new RelayClient({
        talkId: opts.talkId,
        server: opts.server,
        key: opts.key,
        handlers: {
          onWelcome: (w) => {
            if (postViewer) postViewer.myId = w.audience_id;
            if (w.last_focus) this.apply(w.last_focus);
          },
          onAction: ({ action, from }) => {
            if (action.type === "focus") this.apply(action);
            else if (action.type === "reaction") layer?.emit(action.emoji);
            else if (action.type === "post") {
              if ("post_id" in action) postViewer?.applyPost(action);
            } else if (action.type === "vote") {
              postViewer?.applyVote(action.post_id, from);
            }
          },
        },
      });
      relay.connect();
    });

    return {
      sendReaction: (emoji) => send({ type: "reaction", emoji }),
      sendPost: (text) => send({ type: "post", text, level: 0 }),
      sendVote: (postId) => send({ type: "vote", post_id: postId }),
      disconnect: () => relay?.close(),
    };
  }

  /** relay/timeline からの action を反映する。 */
  apply(action: Action): void {
    if (action.type === "focus") {
      this.#follow = true;
      this.focusOn(action.page, action.idx);
    }
    // reaction / post 等は M2 以降で対応。
  }

  /**
   * 指定ページ(1 起点)へ移動し、idx>0 なら該当 heading を画面の上の方へ
   * スクロールして軽く強調する。
   *
   * - `instant`: アニメーションせずに移動する(URL からの復元など)。
   * - `top`: idx=0 のとき、ページを先頭まで戻す(既定はページ内の位置を保つ)。
   *
   * スクロールはビューア内(横 = track、縦 = ページ)だけで行う。
   * `scrollIntoView` は window まで動かすので、ビューアを長いページの一部に
   * 埋め込んだとき(ランディングの phone モック等)に読者のスクロール位置を
   * 奪ってしまう。
   */
  focusOn(
    page: number,
    idx = 0,
    opts: { instant?: boolean; top?: boolean } = {},
  ): void {
    const pages = this.#pages();
    const target = pages[page - 1];
    const track = this.#track;
    if (!target || !track) return;
    const behavior: ScrollBehavior = opts.instant ? "instant" : "smooth";
    const left = track.scrollLeft +
      (target.getBoundingClientRect().left -
        track.getBoundingClientRect().left);
    track.scrollTo({ left, behavior });
    if (idx === 0) {
      if (opts.top) target.scrollTo({ top: 0, behavior });
      return;
    }
    const heading = target.querySelector<HTMLElement>(`[data-idx="${idx}"]`);
    if (!heading) return;
    const top = target.scrollTop + this.#relTop(target, heading) -
      target.clientHeight * HEADING_OFFSET;
    target.scrollTo({ top: Math.max(0, top), behavior });
    heading.classList.add("zen-focus");
    globalThis.setTimeout(() => heading.classList.remove("zen-focus"), 1200);
  }

  /**
   * いま見ている位置(ページと、そのページで読んでいる見出し)。見出しは
   * 画面上部の基準線より上にある最後のもの(ページの末尾まで来ていれば、
   * 見えている最後のもの)。ページ先頭にいるときは idx 0。
   */
  get currentFocus(): { page: number; idx: number } {
    const page = this.currentPage;
    const el = this.#pages()[page - 1];
    if (!el || el.scrollTop <= 2) return { page, idx: 0 };
    const h = this.#headings(el)[this.#currentHeading(el)];
    return { page, idx: h ? Number(h.dataset.idx) : 0 };
  }

  /** ページが末尾までスクロールされているか。 */
  #atBottom(page: HTMLElement): boolean {
    return page.scrollTop + page.clientHeight >= page.scrollHeight - 2;
  }

  /** いま読んでいる見出しの添字(#headings の中の位置、無ければ -1)。 */
  #currentHeading(page: HTMLElement): number {
    const line = this.#atBottom(page)
      ? page.clientHeight - 1 // 末尾では見えている最後の見出し
      : page.clientHeight * CURRENT_LINE + 1;
    let cur = -1;
    this.#headings(page).forEach((h, i) => {
      if (this.#relTop(page, h) <= line) cur = i;
    });
    return cur;
  }

  /** ページ内の見出し(data-idx 順)。 */
  #headings(page: HTMLElement): HTMLElement[] {
    return Array.from(page.querySelectorAll<HTMLElement>("[data-idx]"));
  }

  /** ページの表示枠の上端から見た要素の位置(px)。 */
  #relTop(page: HTMLElement, el: HTMLElement): number {
    return el.getBoundingClientRect().top - page.getBoundingClientRect().top;
  }

  /** ユーザー操作で focus を変え、`zen-focus` を出す(presenter が配信する)。 */
  #userFocus(page: number, idx: number): void {
    this.#stopAutoplay();
    this.#follow = false;
    this.focusOn(page, idx, { top: true });
    this.dispatchEvent(
      new CustomEvent("zen-focus", { detail: { page, idx }, bubbles: true }),
    );
  }

  /**
   * ↓: 次の見出し(focus したときに置かれる位置より下にある最初の見出し)へ。
   *    ページの末尾まで来ていれば次のページへ。
   * ↑: 前の見出し(その位置より上にある最後の見出し。途中まで読んでいれば
   *    今の見出しの頭)へ。無ければページ先頭、先頭なら前のページへ。
   */
  #jumpHeading(dir: 1 | -1): void {
    const page = this.currentPage;
    const el = this.#pages()[page - 1];
    if (!el) return;
    const spot = el.clientHeight * HEADING_OFFSET;
    const headings = this.#headings(el);
    if (dir === 1) {
      const next = this.#atBottom(el)
        ? undefined
        : headings.find((h) => this.#relTop(el, h) > spot + 2);
      if (next) this.#userFocus(page, Number(next.dataset.idx));
      else if (page < this.#pages().length) this.#userFocus(page + 1, 0);
      return;
    }
    const prev = headings.findLast((h) => this.#relTop(el, h) < spot - 2);
    if (prev && el.scrollTop > 2) {
      this.#userFocus(page, Number(prev.dataset.idx));
    } else if (el.scrollTop > 2) this.#userFocus(page, 0);
    else if (page > 1) this.#userFocus(page - 1, 0);
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
    this.#stopAutoplay(); // ユーザー操作で自動再生を止める
    const next = this.currentPage + delta;
    this.#follow = false;
    this.focusOn(next);
  }

  /**
   * PageUp/PageDown/Space/Home/End で今のページを縦スクロールする
   * (↑ ↓ は見出しジャンプ)。フォーカスはビューア自身に
   * あり、スクロールするのは中のページなので、ブラウザ標準のキー操作では
   * 動かない。処理したら true。
   */
  #scrollByKey(e: KeyboardEvent): boolean {
    if (e.altKey || e.ctrlKey || e.metaKey) return false;
    const page = this.#pages()[this.currentPage - 1];
    if (!page) return false;
    const screen = page.clientHeight * 0.85;
    let top: number;
    switch (e.key) {
      case "PageDown":
        top = page.scrollTop + screen;
        break;
      case "PageUp":
        top = page.scrollTop - screen;
        break;
      case " ":
        top = page.scrollTop + (e.shiftKey ? -screen : screen);
        break;
      case "Home":
        top = 0;
        break;
      case "End":
        top = page.scrollHeight;
        break;
      default:
        return false;
    }
    this.#stopAutoplay();
    page.scrollTo({ top, behavior: "smooth" });
    return true;
  }

  // ---- autoplay ---------------------------------------------------------

  #startAutoplayIfNeeded(): void {
    this.#stopAutoplay();
    if (this.#autoplayMs > 0 && this.#pages().length > 1) {
      this.#autoTimer = globalThis.setInterval(
        () => this.#autoAdvance(),
        this.#autoplayMs,
      );
    }
  }

  #autoAdvance(): void {
    const n = this.#pages().length;
    const next = this.currentPage >= n ? 1 : this.currentPage + 1;
    this.focusOn(next); // #stopAutoplay を呼ばずにスクロールのみ
  }

  #stopAutoplay(): void {
    if (this.#autoTimer !== undefined) {
      globalThis.clearInterval(this.#autoTimer);
      this.#autoTimer = undefined;
    }
  }

  #wire(): void {
    if (!this.#track) return;
    if (this.dataset.wired === "1") return;
    this.dataset.wired = "1";

    this.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight") this.#go(1);
      else if (e.key === "ArrowLeft") this.#go(-1);
      else if (
        (e.key === "ArrowDown" || e.key === "ArrowUp") &&
        !(e.altKey || e.ctrlKey || e.metaKey || e.shiftKey)
      ) {
        e.preventDefault();
        this.#jumpHeading(e.key === "ArrowDown" ? 1 : -1);
      } else if (this.#scrollByKey(e)) e.preventDefault();
    });
    this.tabIndex = 0;

    // 画面左右端タップでのページ送り(縦スクロールを邪魔しない端 12%)。
    this.addEventListener("click", (e) => {
      const x = (e as MouseEvent).clientX;
      const w = globalThis.innerWidth;
      if (x < w * 0.12) this.#go(-1);
      else if (x > w * 0.88) this.#go(1);
    });

    // 明示的なユーザー入力(スワイプ/ホイール)でも自動再生を止める。
    const stop = () => this.#stopAutoplay();
    this.addEventListener("wheel", stop, { passive: true });
    this.addEventListener("touchstart", stop, { passive: true });
    this.addEventListener("pointerdown", stop, { passive: true });

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
