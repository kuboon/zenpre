/**
 * トップページ(`/`)のクライアントエントリ。
 *
 * 埋め込みの固定 timeline(`#zen-timeline-data`)を {@link Player} で再生し、
 * focus(ページ送り)を `<zen-slide-viewer>` に、reaction を
 * `<zen-reaction-layer>` に流す。終端まで行くと少し待ってループする。
 * ユーザーが操作したら再生を止めて自由に閲覧できるようにする。
 */
import { Player } from "@kuboon/zenpre/player.ts";
import type { Action, TimelineEntry } from "@kuboon/zenpre/schemas.ts";
import type { ZenSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import type { ZenReactionLayer } from "@kuboon/zenpre/components/reaction_layer.ts";
import { defineComponents } from "./relay_ui.ts";

defineComponents();

const el = document.getElementById("zen-timeline-data");
const viewer = document.querySelector<ZenSlideViewer>("zen-slide-viewer");
const layer = document.querySelector<ZenReactionLayer>("zen-reaction-layer");

if (el && viewer) {
  const entries = JSON.parse(el.textContent ?? "[]") as TimelineEntry[];
  const sink = {
    apply(action: Action) {
      if (action.type === "reaction") layer?.emit(action.emoji);
      else viewer.apply(action);
    },
  };

  let stopped = false;
  const player = new Player(entries, sink, {
    onState: (s) => {
      if (s === "ended" && !stopped) {
        // 少し余韻を置いてからループ。
        globalThis.setTimeout(() => {
          if (stopped) return;
          player.seek(0);
          player.play();
        }, 2000);
      }
    },
  });
  player.play();

  // ユーザーが操作したら自動再生を止めて閲覧を優先。
  const stop = () => {
    stopped = true;
    player.dispose();
  };
  viewer.addEventListener("wheel", stop, { passive: true, once: true });
  viewer.addEventListener("touchstart", stop, { passive: true, once: true });
  viewer.addEventListener("pointerdown", stop, { once: true });
  viewer.addEventListener("keydown", stop, { once: true });
}
