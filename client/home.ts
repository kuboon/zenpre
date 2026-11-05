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
