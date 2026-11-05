/**
 * `/s/:slide_id` ページのクライアントエントリ。
 * `<zen-slide-viewer>` を登録し、SSR された light DOM を enhancement する。
 * 右下のページ番号(`.zen-page-counter`)をページ送りに追従させる。
 */
import { defineSlideViewer } from "@kuboon/zenpre/components/slide_viewer.ts";

defineSlideViewer();

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
