/**
 * `@kuboon/zenpre/components.ts` — 全 Web Component をまとめて登録する
 * 副作用 import 用エントリ。セルフホスト(§14)ではこの 1 行で
 * `<zen-slide-viewer>` / `<zen-reaction-layer>` / `<zen-post-viewer>` /
 * `<zen-moderator-ui>` が使えるようになる。
 *
 * ```js
 * import { defineComponents } from "@kuboon/zenpre/components.ts";
 * defineComponents();
 * ```
 *
 * @module
 */
import { defineSlideViewer } from "./components/slide_viewer.ts";
import { defineReactionLayer } from "./components/reaction_layer.ts";
import { definePostViewer } from "./components/post_viewer.ts";
import { defineModeratorUi } from "./components/moderator_ui.ts";

export {
  defineModeratorUi,
  definePostViewer,
  defineReactionLayer,
  defineSlideViewer,
};
export type {
  SlideData,
  TalkConnection,
  TalkConnectOptions,
  ZenSlideViewer,
} from "./components/slide_viewer.ts";

/** 全 custom element を登録する(重複登録は無視)。 */
export function defineComponents(): void {
  defineSlideViewer();
  defineReactionLayer();
  definePostViewer();
  defineModeratorUi();
}
