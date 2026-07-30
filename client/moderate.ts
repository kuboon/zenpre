/**
 * `/t/:talk_id/moderate` moderator ビューのクライアントエントリ。
 *
 * `moderator_key` を URL fragment(`#key=…`)から読み(query に載せず
 * localStorage に退避)、relay に moderator ロールで接続する。
 * presenter の focus に追従しつつ、mod チャンネルに流れてくる level-0 post を
 * ModeratorUi のキューに溜め、承認すると level-1 post として全員へ配信する。
 */
import { RelayClient } from "@kuboon/zenpre/relay_client.ts";
import type { ZenSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import type { ZenReactionLayer } from "@kuboon/zenpre/components/reaction_layer.ts";
import {
  applyPostAction,
  defineComponents,
  readPostEls,
  readTalkData,
  wirePostSending,
} from "./relay_ui.ts";

defineComponents();

const data = readTalkData();
const viewer = document.querySelector<ZenSlideViewer>("zen-slide-viewer");
const layer = document.querySelector<ZenReactionLayer>("zen-reaction-layer");
const posts = readPostEls();

// fragment の key はサーバに送られない。localStorage に退避して URL からは消す。
const hashKey = new URLSearchParams(location.hash.slice(1)).get("key");
const storeKey = `zen-mod-key:${data?.talk_id ?? ""}`;
if (hashKey) {
  try {
    localStorage.setItem(storeKey, hashKey);
  } catch { /* ignore */ }
  history.replaceState(null, "", location.pathname + location.search);
}
const key = hashKey ?? localStorage.getItem(storeKey) ?? undefined;

if (data && viewer) {
  const relay = new RelayClient({
    talkId: data.talk_id,
    key,
    handlers: {
      onWelcome: (w) => {
        if (posts.postViewer) posts.postViewer.myId = w.audience_id;
        if (w.last_focus) viewer.apply(w.last_focus);
      },
      onAction: ({ action, from }) => {
        if (action.type === "focus") viewer.apply(action);
        else if (action.type === "reaction") layer?.emit(action.emoji);
        else applyPostAction(action, from, posts);
      },
    },
  });
  relay.connect();

  // 承認(level-1 post)/投票の送信を結線。
  wirePostSending((action) => relay.send(action), posts);
}
