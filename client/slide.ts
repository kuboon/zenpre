/**
 * `/s/:slide_id` ページのクライアントエントリ。
 * `<zen-slide-viewer>` を登録し、SSR された light DOM を enhancement する。
 */
import { defineSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";

defineSlideViewer();
