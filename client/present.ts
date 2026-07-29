/**
 * `/t/:talk_id/present` presenter Controller のクライアントエントリ。
 * `event_key` は URL fragment(`#key=…`)から読み、ページ送りを focus として
 * 配信する。reaction は受信して表示する。
 */
import { RelayClient } from "@kuboon/zenpre/relay_client.ts";
import type { ZenSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import type { ZenReactionLayer } from "@kuboon/zenpre/components/reaction_layer.ts";
import { defineComponents, reactionBar, readTalkData } from "./relay_ui.ts";

defineComponents();

const data = readTalkData();
const viewer = document.querySelector<ZenSlideViewer>("zen-slide-viewer");
const layer = document.querySelector<ZenReactionLayer>("zen-reaction-layer");

// fragment の key はサーバに送られない。localStorage に退避して URL からは消す。
const hashKey = new URLSearchParams(location.hash.slice(1)).get("key");
const storeKey = `zen-talk-key:${data?.talk_id ?? ""}`;
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
      onAction: ({ action }) => {
        if (action.type === "reaction") layer?.emit(action.emoji);
      },
    },
  });
  relay.connect();

  // ページ送りを focus として配信(idx 0 = ページ先頭)。
  let lastPage = 0;
  viewer.addEventListener("zen-navigate", (e) => {
    const page = (e as CustomEvent<{ page: number }>).detail.page;
    if (page !== lastPage) {
      lastPage = page;
      relay.send({ type: "focus", page, idx: 0 });
    }
  });

  reactionBar((emoji) => relay.send({ type: "reaction", emoji }));
}
