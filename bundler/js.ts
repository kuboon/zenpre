/**
 * クライアント JS/TSX のバンドル(`Deno.bundle`、unstable)。
 *
 * `client/` 以下の各エントリポイントを同名の `.js`(sourcemap 付き)として
 * `bundled/` にコンパイルする。
 */

const CLIENT_ENTRIES = [
  "mod.ts",
  "slide.ts",
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
    sourcemap: "linked",
    minify,
    write,
  });
}
