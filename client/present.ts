/**
 * `/t/:talk_id/present` presenter Controller のクライアントエントリ。
 * `event_key` は URL fragment(`#key=…`)から読み、ページ送りを focus として
 * 配信する。reaction は受信して表示する。
 */
import { RelayClient } from "@kuboon/zenpre/relay_client.ts";
import { Recorder } from "@kuboon/zenpre/recorder.ts";
import type { Action } from "@kuboon/zenpre/schemas.ts";
import type { ZenSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import type { ZenReactionLayer } from "@kuboon/zenpre/components/reaction_layer.ts";
import {
  applyPostAction,
  defineComponents,
  reactionBar,
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
const storeKey = `zen-talk-key:${data?.talk_id ?? ""}`;
if (hashKey) {
  try {
    localStorage.setItem(storeKey, hashKey);
  } catch { /* ignore */ }
  history.replaceState(null, "", location.pathname + location.search);
}
const key = hashKey ?? localStorage.getItem(storeKey) ?? undefined;

if (data && viewer) {
  const talkId = data.talk_id;

  // Recorder: 自分が pub した action と受信した action を記録し、
  // 30 秒ごと & 離脱時に PUT /api/talks/:id/timeline で追記する。
  const recorder = new Recorder({
    onFlush: async (chunk) => {
      if (!key) return;
      await fetch(`/api/talks/${talkId}/timeline`, {
        method: "PUT",
        headers: { "content-type": "application/json", "x-event-key": key },
        body: JSON.stringify(chunk),
      });
    },
  });
  recorder.start();

  const relay = new RelayClient({
    talkId,
    key,
    handlers: {
      onWelcome: (w) => {
        if (posts.postViewer) posts.postViewer.myId = w.audience_id;
      },
      onAction: ({ action, from }) => {
        if (action.type === "reaction") {
          layer?.emit(action.emoji);
          // 他者の reaction だけここで記録(自分の分は publish 時に記録済み)。
          if (from !== "presenter") recorder.record(action);
        } else {
          // level-0 post は moderator UI のキューへ、level≥1/vote は post viewer へ。
          applyPostAction(action, from, posts);
        }
        // focus は presenter 自身が操作しているので viewer には適用しない。
      },
    },
  });
  relay.connect();

  // 投稿(承認)/投票の送信を結線。承認は moderator UI 経由で level-1 を送る。
  wirePostSending((action) => relay.send(action), posts);

  // 自分が pub する action(focus / 自分の reaction)は送信時に記録する。
  const publish = (action: Action) => {
    relay.send(action);
    recorder.record(action);
  };

  // ページ送りを focus として配信(idx 0 = ページ先頭)。
  let lastPage = 0;
  viewer.addEventListener("zen-navigate", (e) => {
    const page = (e as CustomEvent<{ page: number }>).detail.page;
    if (page !== lastPage) {
      lastPage = page;
      publish({ type: "focus", page, idx: 0 });
    }
  });

  reactionBar((emoji) => publish({ type: "reaction", emoji }));

  // 定期フラッシュ + 離脱時フラッシュ。
  globalThis.setInterval(() => void recorder.flush(), 30_000);
  globalThis.addEventListener("pagehide", () => void recorder.flush());
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void recorder.flush();
  });
}
