/**
 * Talk ページ(audience / presenter)共通のクライアント補助。
 * `<zen-slide-viewer>` / `<zen-reaction-layer>` を登録し、埋め込みの talk 設定を
 * 読み、リアクションバーを組み立てる。
 */
import { defineSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import { defineReactionLayer } from "@kuboon/zenpre/components/reaction_layer.ts";
import { definePostViewer } from "@kuboon/zenpre/components/post_viewer.ts";
import { defineModeratorUi } from "@kuboon/zenpre/components/moderator_ui.ts";
import { genPublicId } from "@kuboon/zenpre/keys.ts";
import type { Action } from "@kuboon/zenpre/schemas.ts";
import type { ZenPostViewer } from "@kuboon/zenpre/components/post_viewer.ts";
import type { ZenModeratorUi } from "@kuboon/zenpre/components/moderator_ui.ts";

export type TalkData = {
  talk_id: string;
  role: "audience" | "presenter" | "moderator";
};

export const REACTION_EMOJIS = ["👏", "❤️", "🎉", "😂", "🤔"];

/** custom element を登録する。 */
export function defineComponents(): void {
  defineSlideViewer();
  defineReactionLayer();
  definePostViewer();
  defineModeratorUi();
}

/** SSR が埋めた `#zen-talk-data` を読む。 */
export function readTalkData(): TalkData | null {
  const el = document.getElementById("zen-talk-data");
  if (!el) return null;
  try {
    return JSON.parse(el.textContent ?? "") as TalkData;
  } catch {
    return null;
  }
}

/** post 関連コンポーネント(DOM に無ければ null)。 */
export type PostEls = {
  postViewer: ZenPostViewer | null;
  moderatorUi: ZenModeratorUi | null;
};

/** ページ内の post/moderator コンポーネントを拾う。 */
export function readPostEls(): PostEls {
  return {
    postViewer: document.querySelector<ZenPostViewer>("zen-post-viewer"),
    moderatorUi: document.querySelector<ZenModeratorUi>("zen-moderator-ui"),
  };
}

/**
 * 受信した post/vote action をコンポーネントへ反映する。
 * - level-0 post → moderator UI のキューへ(presenter/moderator のみ受信)。
 * - level≥1 post → post viewer へ。
 * - vote → post viewer で `(post_id, from)` 集計。
 * 反映したら true(呼び出し側で focus/reaction と分岐する用)。
 */
export function applyPostAction(
  action: Action,
  from: string,
  els: PostEls,
): boolean {
  if (action.type === "post") {
    if ("post_id" in action) els.postViewer?.applyPost(action);
    else els.moderatorUi?.enqueue({ text: action.text, from });
    return true;
  }
  if (action.type === "vote") {
    els.postViewer?.applyVote(action.post_id, from);
    return true;
  }
  return false;
}

/**
 * DOM 側の投稿/承認/投票イベントを送信関数に結線する。
 * - post viewer `zen-post`   → level-0 post を送る。
 * - post viewer `zen-vote`   → vote を送る。
 * - moderator UI `zen-approve` → post_id を採番して level-1 post を送る。
 */
export function wirePostSending(
  send: (action: Action) => void,
  els: PostEls,
): void {
  els.postViewer?.addEventListener("zen-post", (e) => {
    const { text } = (e as CustomEvent<{ text: string }>).detail;
    send({ type: "post", text, level: 0 });
  });
  els.postViewer?.addEventListener("zen-vote", (e) => {
    const { post_id } = (e as CustomEvent<{ post_id: string }>).detail;
    send({ type: "vote", post_id });
  });
  els.moderatorUi?.addEventListener("zen-approve", (e) => {
    const { text } = (e as CustomEvent<{ text: string }>).detail;
    send({ type: "post", text, level: 1, post_id: genPublicId() });
  });
}

/** 画面下部にリアクションバーを追加する。 */
export function reactionBar(onEmit: (emoji: string) => void): void {
  const bar = document.createElement("div");
  bar.className = "zen-reaction-bar";
  for (const emoji of REACTION_EMOJIS) {
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = emoji;
    b.setAttribute("aria-label", `reaction ${emoji}`);
    b.addEventListener("click", () => onEmit(emoji));
    bar.appendChild(b);
  }
  document.body.appendChild(bar);
}
