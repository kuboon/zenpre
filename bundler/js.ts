/**
 * クライアント JS/TSX のバンドル(`Deno.bundle`、unstable)。
 *
 * `client/` 以下の各エントリポイントを同名の `.js`(sourcemap 付き)として
 * `bundled/` にコンパイルする。
 *
 * **`codeSplitting` は必須**。無効だと各エントリに共有依存(unified/shiki/
 * beautiful-mermaid)がまるごと重複インライン化され、1 エントリ 6MB × 8 に
 * 膨れる。有効にすると:
 * - 共有コードが 1 つのチャンクになり、全体で ~6MB に収まる
 * - `slide_viewer.load({markdown})` の動的 import が別チャンクになるので、
 *   SSR 済みページ(`/s` `/t` `/`)はレンダラ(~4.7MB)を**取得しない**
 * - shiki の文法も言語ごとのチャンクになり、必要なものだけ読み込まれる
 */

const CLIENT_ENTRIES = [
  "mod.ts",
  "slide.ts",
  "talk.ts",
  "present.ts",
  "moderate.ts",
  "replay.ts",
  "home.ts",
  "new.ts",
] as const;

export async function buildJs(
  { minify = false, write = true }: { minify?: boolean; write?: boolean } = {},
) {
  const entrypoints = CLIENT_ENTRIES.map((p) =>
    import.meta.resolve(`../client/${p}`)
  );
  return await Deno.bundle({
    entrypoints,
    outputDir: new URL("../bundled", import.meta.url).pathname,
    platform: "browser",
    format: "esm", // codeSplitting は esm 前提
    codeSplitting: true,
    sourcemap: "linked",
    minify,
    write,
  });
}
