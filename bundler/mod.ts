/**
 * ビルドエントリポイント。
 *
 * JS バンドル(Deno.bundle)と Tailwind CSS ビルドを並列で実行し、
 * どちらもリポジトリ直下の `bundled/` に書き出す(server が
 * static-middleware で配信する)。
 */

import { buildCss } from "./css.ts";
import { buildJs } from "./js.ts";

export { buildCss, buildJs };

if (import.meta.main) {
  const [js, css] = await Promise.all([buildJs(), buildCss()]);
  console.log("[bundler] js complete", js);
  console.log("[bundler] css complete", css);
}
