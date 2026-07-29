/**
 * `/t/:talk_id` audience ビューのクライアントエントリ。
 * relay に接続し、presenter の focus に追従、reaction を表示/送信する。
 */
import { RelayClient } from "@kuboon/zenpre/relay_client.ts";
import type { ZenSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import type { ZenReactionLayer } from "@kuboon/zenpre/components/reaction_layer.ts";
import { defineComponents, reactionBar, readTalkData } from "./relay_ui.ts";

defineComponents();

const data = readTalkData();
const viewer = document.querySelector<ZenSlideViewer>("zen-slide-viewer");
const layer = document.querySelector<ZenReactionLayer>("zen-reaction-layer");

if (data && viewer) {
  const relay = new RelayClient({
    talkId: data.talk_id,
    handlers: {
      onWelcome: (w) => {
        if (w.last_focus) viewer.apply(w.last_focus);
      },
      onAction: ({ action }) => {
        if (action.type === "focus") viewer.apply(action);
        else if (action.type === "reaction") layer?.emit(action.emoji);
      },
    },
  });
  relay.connect();

  // 自分のリアクションも relay 経由(サーバが全員へ配信=自分にも届く)。
  reactionBar((emoji) => relay.send({ type: "reaction", emoji }));
}
