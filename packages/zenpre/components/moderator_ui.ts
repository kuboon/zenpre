/**
 * `<zen-moderator-ui>` — level-0 post(audience 発、未承認)のキューを表示し、
 * 承認 / 破棄を行うフレームワーク非依存の Web Component(light DOM)。
 *
 * - `enqueue({ text, from })` で未承認 post をキューに積む。
 * - 各項目の「承認(→)」で level+1 して配信するよう促し、「破棄(✕)」で捨てる。
 * - キーボード: `→` で先頭を承認、`←` で先頭を破棄。
 * - 発火イベント:
 *   - `zen-approve` — `detail: { text }`。承認。post_id の採番と配信は呼び出し側。
 *   - `zen-discard` — `detail: { text }`。破棄。
 *
 * post_id の採番は capability(keys)に依存させないため呼び出し側で行う。
 *
 * @module
 */
type QueueItem = { id: number; text: string; from: string };

export class ZenModeratorUi extends HTMLElement {
  #queue: QueueItem[] = [];
  #seq = 0;
  #list: HTMLElement | null = null;
  #onKey = (e: KeyboardEvent) => this.#handleKey(e);

  connectedCallback(): void {
    if (this.#list) return;
    this.classList.add("zen-moderator-ui");

    const header = document.createElement("div");
    header.className = "zen-mod-header";
    header.textContent = "承認待ち";
    this.appendChild(header);

    const list = document.createElement("ul");
    list.className = "zen-mod-list";
    this.appendChild(list);
    this.#list = list;

    globalThis.addEventListener("keydown", this.#onKey);
    this.#render();
  }

  disconnectedCallback(): void {
    globalThis.removeEventListener("keydown", this.#onKey);
  }

  /** 未承認 post(level 0)をキューに積む。 */
  enqueue(post: { text: string; from: string }): void {
    this.#queue.push({ id: this.#seq++, text: post.text, from: post.from });
    this.#render();
  }

  /** 承認待ち件数。 */
  get pendingCount(): number {
    return this.#queue.length;
  }

  #approve(item: QueueItem): void {
    this.#remove(item.id);
    this.dispatchEvent(
      new CustomEvent("zen-approve", {
        detail: { text: item.text },
        bubbles: true,
      }),
    );
  }

  #discard(item: QueueItem): void {
    this.#remove(item.id);
    this.dispatchEvent(
      new CustomEvent("zen-discard", {
        detail: { text: item.text },
        bubbles: true,
      }),
    );
  }

  #remove(id: number): void {
    this.#queue = this.#queue.filter((q) => q.id !== id);
    this.#render();
  }

  #handleKey(e: KeyboardEvent): void {
    if (this.#queue.length === 0) return;
    const target = e.target as HTMLElement | null;
    // フォーム入力中は無視(誤操作防止)。
    if (
      target &&
      (target.tagName === "INPUT" || target.tagName === "TEXTAREA")
    ) return;
    if (e.key === "ArrowRight") {
      e.preventDefault();
      this.#approve(this.#queue[0]);
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      this.#discard(this.#queue[0]);
    }
  }

  #render(): void {
    const list = this.#list;
    if (!list) return;
    list.textContent = "";
    for (const item of this.#queue) {
      const li = document.createElement("li");
      li.className = "zen-mod-item";

      const text = document.createElement("span");
      text.className = "zen-mod-text";
      text.textContent = item.text;

      const approve = document.createElement("button");
      approve.type = "button";
      approve.className = "zen-mod-approve";
      approve.textContent = "承認 →";
      approve.setAttribute("aria-label", "approve");
      approve.addEventListener("click", () => this.#approve(item));

      const discard = document.createElement("button");
      discard.type = "button";
      discard.className = "zen-mod-discard";
      discard.textContent = "✕";
      discard.setAttribute("aria-label", "discard");
      discard.addEventListener("click", () => this.#discard(item));

      li.append(text, approve, discard);
      list.appendChild(li);
    }
    this.classList.toggle("zen-mod-empty", this.#queue.length === 0);
  }
}

/** custom element を登録する(重複登録は無視)。 */
export function defineModeratorUi(): void {
  if (!customElements.get("zen-moderator-ui")) {
    customElements.define("zen-moderator-ui", ZenModeratorUi);
  }
}
