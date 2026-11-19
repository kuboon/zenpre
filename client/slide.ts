/**
 * `/s/:slide_id` ページのクライアントエントリ。
 * `<zen-slide-viewer>` を登録し、SSR された light DOM を enhancement する。
 *
 * - 右下のページ番号(`.zen-page-counter`)をページ送りに追従させる。
 * - 見ているページと見出しを URL の `#` に反映し(`#3` = 3 ページ目、
 *   `#3.2` = 3 ページ目の 2 番目の見出し)、リロードしても同じ位置から開く。
 * - `?play=` の timeline が埋め込まれていれば自動再生する(このときは `#` を
 *   復元しない)。
 */
import { defineSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import type { ZenSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import {
  defineReactionLayer,
  type ZenReactionLayer,
} from "@kuboon/zenpre/components/reaction_layer.ts";
import { autoplayTimeline, readEmbeddedTimeline } from "./autoplay.ts";

defineSlideViewer();
defineReactionLayer();

const counter = document.querySelector<HTMLElement>(".zen-page-counter");
if (counter) {
  const total = Number(counter.dataset.total) || 1;
  const show = (page: number) => {
    const text = `${Math.min(Math.max(page, 1), total)} / ${total}`;
    if (counter.textContent !== text) counter.textContent = text;
  };
  document.addEventListener("zen-navigate", (e) => {
    show((e as CustomEvent<{ page: number }>).detail.page);
  });
}

const entries = readEmbeddedTimeline();
const viewer = document.querySelector<ZenSlideViewer>("zen-slide-viewer");
const layer = document.querySelector<ZenReactionLayer>("zen-reaction-layer");
if (entries && viewer) autoplayTimeline(entries, viewer, layer);

// ---- 位置を URL の # に保つ ------------------------------------------------

/** `#3` / `#3.2` を読む。 */
function parseHash(hash: string): { page: number; idx: number } | null {
  const m = /^#(\d+)(?:\.(\d+))?$/.exec(hash);
  if (!m) return null;
  const page = Number(m[1]);
  return page >= 1 ? { page, idx: Number(m[2] ?? 0) } : null;
}

if (viewer) {
  const restore = () => {
    const at = parseHash(location.hash);
    if (at) viewer.focusOn(at.page, at.idx, { instant: true, top: true });
  };
  if (!entries) restore();
  globalThis.addEventListener("hashchange", restore);

  // ページ送り・見出しジャンプ・縦スクロールのたびに(少し待って)書き戻す。
  let timer: number | undefined;
  const sync = () => {
    globalThis.clearTimeout(timer);
    timer = globalThis.setTimeout(() => {
      const { page, idx } = viewer.currentFocus;
      const hash = page === 1 && idx === 0
        ? ""
        : idx > 0
        ? `#${page}.${idx}`
        : `#${page}`;
      if (hash !== location.hash) {
        history.replaceState(
          history.state,
          "",
          location.pathname + location.search + hash,
        );
      }
    }, 250);
  };
  viewer.addEventListener("zen-navigate", sync);
  viewer.addEventListener("zen-focus", sync);
  // ページの縦スクロールは bubble しないので capture で拾う。
  viewer.addEventListener("scroll", sync, { capture: true, passive: true });
}
