/**
 * 埋め込み timeline(`#zen-timeline-data`)の自動再生。
 *
 * トップページ(`/`)と、録画した timeline を持つ `/s/:id` で共通に使う。
 * {@link Player} で focus を `<zen-slide-viewer>` に、reaction を
 * `<zen-reaction-layer>` に流し、終端まで行ったら少し待ってループする。
 * 見ている人が操作したら再生をやめて自由に閲覧できるようにする。
 */
import { Player } from "@kuboon/zenpre/player.ts";
import type { Action, TimelineEntry } from "@kuboon/zenpre/schemas.ts";
import type { ZenSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import type { ZenReactionLayer } from "@kuboon/zenpre/components/reaction_layer.ts";

/** ループの前に最後の状態を見せておく時間(ms)。 */
const LOOP_PAUSE_MS = 2000;

/** ページ内の埋め込み timeline を読む(無ければ null)。 */
export function readEmbeddedTimeline(): TimelineEntry[] | null {
  const el = document.getElementById("zen-timeline-data");
  if (!el) return null;
  try {
    const entries = JSON.parse(el.textContent ?? "[]") as TimelineEntry[];
    return entries.length ? entries : null;
  } catch {
    return null;
  }
}

/** timeline をループ再生する。ユーザー操作で止まる。 */
export function autoplayTimeline(
  entries: TimelineEntry[],
  viewer: ZenSlideViewer,
  layer: ZenReactionLayer | null,
): void {
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
        globalThis.setTimeout(() => {
          if (stopped) return;
          player.seek(0);
          player.play();
        }, LOOP_PAUSE_MS);
      }
    },
  });
  player.play();

  const stop = () => {
    stopped = true;
    player.dispose();
  };
  viewer.addEventListener("wheel", stop, { passive: true, once: true });
  viewer.addEventListener("touchstart", stop, { passive: true, once: true });
  viewer.addEventListener("pointerdown", stop, { once: true });
  viewer.addEventListener("keydown", stop, { once: true });
}
