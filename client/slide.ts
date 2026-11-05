/**
 * `/s/:slide_id` ページのクライアントエントリ。
 * `<zen-slide-viewer>` を登録し、SSR された light DOM を enhancement する。
 *
 * - 右下のページ番号(`.zen-page-counter`)をページ送りに追従させる。
 * - エディタで録画した timeline が埋め込まれていれば自動再生する。
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
