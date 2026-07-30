/**
 * `<zen-post-viewer>` — 承認済み post(level≥1)を一覧表示し、投票を受け付ける
 * フレームワーク非依存の Web Component(light DOM)。
 *
 * - `applyPost({ post_id, text, level })` で承認済み post を追加/更新する。
 * - `applyVote(post_id, from)` で投票を `(post_id, from)` で重複排除しつつ集計する
 *   (サーバは集計しない。真実は各画面の表示 = クライアント集計)。
 * - 表示順は **level 降順 → 票数降順**。
 * - `data-role="audience"` のとき下部に投稿フォーム(50 grapheme 上限)を出す。
 * - 発火イベント:
 *   - `zen-post`  — 投稿フォーム送信。`detail: { text }`。
 *   - `zen-vote`  — 投票ボタン。`detail: { post_id }`。
 *
 * 自分の `audience_id` を `myId` に設定すると、自分が投票済みの post の
 * 投票ボタンを disabled にできる。
 *
 * @module
 */
import { POST_TEXT_MAX_GRAPHEMES } from "../schemas.ts";

/** grapheme 数を数える(絵文字等の多バイト文字を 1 と数える)。 */
function graphemeLength(s: string): number {
  const Seg = (Intl as { Segmenter?: typeof Intl.Segmenter }).Segmenter;
  if (Seg) {
    let n = 0;
    for (
      const _ of new Seg(undefined, { granularity: "grapheme" }).segment(s)
    ) {
      n++;
    }
    return n;
  }
  return [...s].length;
}

type PostState = { text: string; level: number; votes: Set<string> };

export class ZenPostViewer extends HTMLElement {
  #posts = new Map<string, PostState>();
  #myId = "";
  #list: HTMLElement | null = null;

  /** 自分の audience_id。自分の投票済み post のボタンを無効化するのに使う。 */
  set myId(id: string) {
    this.#myId = id;
    this.#render();
  }
  get myId(): string {
    return this.#myId;
  }

  connectedCallback(): void {
    if (this.#list) return; // 二重初期化を避ける
    this.classList.add("zen-post-viewer");

    const list = document.createElement("ul");
    list.className = "zen-post-list";
    this.appendChild(list);
    this.#list = list;

    if (this.dataset.role === "audience") {
      this.#buildForm();
    }
    this.#render();
  }

  #buildForm(): void {
    const form = document.createElement("form");
    form.className = "zen-post-form";

    const input = document.createElement("textarea");
    input.rows = 1;
    input.placeholder = "質問・コメント(50字まで)";
    input.setAttribute("aria-label", "post");

    const counter = document.createElement("span");
    counter.className = "zen-post-counter";

    const send = document.createElement("button");
    send.type = "submit";
    send.textContent = "送信";

    const updateCounter = () => {
      const n = graphemeLength(input.value.trim());
      counter.textContent = `${n}/${POST_TEXT_MAX_GRAPHEMES}`;
      const over = n > POST_TEXT_MAX_GRAPHEMES;
      counter.classList.toggle("zen-post-over", over);
      send.disabled = n === 0 || over;
    };
    input.addEventListener("input", updateCounter);
    updateCounter();

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const text = input.value.trim();
      if (!text || graphemeLength(text) > POST_TEXT_MAX_GRAPHEMES) return;
      this.dispatchEvent(
        new CustomEvent("zen-post", { detail: { text }, bubbles: true }),
      );
      input.value = "";
      updateCounter();
    });

    form.append(input, counter, send);
    this.appendChild(form);
  }

  /** 承認済み post(level≥1)を追加/更新する。 */
  applyPost(post: { post_id: string; text: string; level: number }): void {
    const existing = this.#posts.get(post.post_id);
    if (existing) {
      existing.text = post.text;
      existing.level = post.level;
    } else {
      this.#posts.set(post.post_id, {
        text: post.text,
        level: post.level,
        votes: new Set(),
      });
    }
    this.#render();
  }

  /** 投票を `(post_id, from)` で重複排除して集計する。 */
  applyVote(post_id: string, from: string): void {
    const post = this.#posts.get(post_id);
    if (!post) return; // 未知の post への vote は無視(post が先に届く想定)
    post.votes.add(from);
    this.#render();
  }

  #render(): void {
    const list = this.#list;
    if (!list) return;
    const entries = [...this.#posts.entries()].sort((a, b) => {
      if (b[1].level !== a[1].level) return b[1].level - a[1].level;
      return b[1].votes.size - a[1].votes.size;
    });

    list.textContent = "";
    for (const [post_id, post] of entries) {
      const li = document.createElement("li");
      li.className = "zen-post-item";
      li.dataset.postId = post_id;

      const text = document.createElement("span");
      text.className = "zen-post-text";
      text.textContent = post.text;

      const vote = document.createElement("button");
      vote.type = "button";
      vote.className = "zen-post-vote";
      vote.textContent = `▲ ${post.votes.size}`;
      const voted = this.#myId !== "" && post.votes.has(this.#myId);
      vote.disabled = voted;
      vote.setAttribute("aria-pressed", String(voted));
      vote.addEventListener("click", () => {
        vote.disabled = true;
        this.dispatchEvent(
          new CustomEvent("zen-vote", { detail: { post_id }, bubbles: true }),
        );
      });

      li.append(vote, text);
      list.appendChild(li);
    }
  }
}

/** custom element を登録する(重複登録は無視)。 */
export function definePostViewer(): void {
  if (!customElements.get("zen-post-viewer")) {
    customElements.define("zen-post-viewer", ZenPostViewer);
  }
}
