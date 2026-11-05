/**
 * トップページ(`/`)のクライアントエントリ。
 *
 * 埋め込みの固定 timeline(`#zen-timeline-data`)を自動再生する
 * ({@link autoplayTimeline})。
 */
import type { ZenSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";
import type { ZenReactionLayer } from "@kuboon/zenpre/components/reaction_layer.ts";
import { defineComponents } from "./relay_ui.ts";
import { autoplayTimeline, readEmbeddedTimeline } from "./autoplay.ts";

defineComponents();

const entries = readEmbeddedTimeline();
const viewer = document.querySelector<ZenSlideViewer>("zen-slide-viewer");
const layer = document.querySelector<ZenReactionLayer>("zen-reaction-layer");

if (entries && viewer) autoplayTimeline(entries, viewer, layer);

// ---- ランディングのスクロール演出 -------------------------------------------
// `[data-reveal]` を画面に入ったときにふわっと出す。JS が動いたときだけ
// 隠し始める(html.zl-js)ので、JS 無効でも全部見える。
const reveals = document.querySelectorAll<HTMLElement>("[data-reveal]");
if (reveals.length && "IntersectionObserver" in globalThis) {
  document.documentElement.classList.add("zl-js");
  const io = new IntersectionObserver((items) => {
    for (const item of items) {
      if (!item.isIntersecting) continue;
      item.target.classList.add("is-visible");
      io.unobserve(item.target);
    }
  }, { rootMargin: "0px 0px -10% 0px" });
  reveals.forEach((el) => io.observe(el));
}
