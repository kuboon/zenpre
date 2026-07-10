/**
 * シェル + フレームナビゲーションのクライアントランタイム起動。
 *
 * ./mod.ts 経由で `bundled/mod.js` にバンドルされ、すべてのシェルレスポンスが
 * `<script type="module" src="/mod.js">` で読み込む。
 *
 * `run()` は document を走査して `renderToStream` が埋めた clientEntry を
 * hydrate し、`<a rmx-target="content">` のクリックをフレーム差し替えに変える。
 */

import { run } from "@remix-run/ui";

const FRAME_HEADER = "rmx-frame";

const app = run({
  async loadModule(moduleUrl: string, exportName: string) {
    const mod = await import(moduleUrl);
    return mod[exportName];
  },
  async resolveFrame(src: string, signal?: AbortSignal, target?: string) {
    const headers = new Headers({
      accept: "text/html",
      [FRAME_HEADER]: "1",
    });
    if (target) headers.set("rmx-target", target);
    const response = await fetch(src, { headers, signal });
    return response.body ?? (await response.text());
  },
});

await app.ready();

console.log("[hydration] runtime ready");
