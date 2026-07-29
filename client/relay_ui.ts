/**
 * Talk ページ(audience / presenter)共通のクライアント補助。
 * `<zen-slide-viewer>` / `<zen-reaction-layer>` を登録し、埋め込みの talk 設定を
 * 読み、リアクションバーを組み立てる。
 */
import { defineSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import { defineReactionLayer } from "@kuboon/zenpre/components/reaction_layer.ts";

export type TalkData = { talk_id: string; role: "audience" | "presenter" };

export const REACTION_EMOJIS = ["👏", "❤️", "🎉", "😂", "🤔"];

/** custom element を登録する。 */
export function defineComponents(): void {
  defineSlideViewer();
  defineReactionLayer();
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
