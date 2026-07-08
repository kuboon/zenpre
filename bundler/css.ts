/**
 * Tailwind CSS ビルド(`@kuboon/tailwindcss-deno`)。
 *
 * `assets/style.css`(`tailwindcss/index.css` を @import する)を
 * `bundled/style.css` にコンパイルする。class 候補は `server/`・`client/`・
 * `packages/zenpre/` のツリーからスキャンする。
 */

import { compile, optimize } from "@kuboon/tailwindcss-deno";
import { Scanner } from "@tailwindcss/oxide";

const REPO_ROOT = new URL("..", import.meta.url).pathname;
const INPUT = new URL("../assets/style.css", import.meta.url).pathname;
const OUTPUT = new URL("../bundled/style.css", import.meta.url).pathname;

export async function buildCss(
  { minify = false }: { minify?: boolean } = {},
) {
  const scanner = new Scanner({
    sources: [
      { base: `${REPO_ROOT}server`, pattern: "**/*", negated: false },
      { base: `${REPO_ROOT}client`, pattern: "**/*", negated: false },
      { base: `${REPO_ROOT}packages/zenpre`, pattern: "**/*", negated: false },
    ],
  });
  const candidates = scanner.scan();

  const input = await Deno.readTextFile(INPUT);
  const compiler = await compile(input, {
    base: REPO_ROOT,
    from: INPUT,
    onDependency: () => {},
    customCssResolver: (id) => {
      // `tailwindcss/index.css` はパッケージの `exports` に出ていないため
      // @deno/loader では解決できない。この bundler の import map を反映する
      // import.meta.resolve でフォールバックする。
      if (id === "tailwindcss/index.css") {
        const pathname = new URL(import.meta.resolve(id)).pathname;
        console.log(`[css] resolved ${id} to ${pathname}`);
        return Promise.resolve(pathname);
      }
      return Promise.resolve(undefined);
    },
  });

  const built = compiler.build(candidates);
  const { code } = optimize(built, { minify, file: OUTPUT });

  await Deno.mkdir(new URL("../bundled", import.meta.url), { recursive: true });
  await Deno.writeTextFile(OUTPUT, code);
  return { output: OUTPUT, bytes: code.length };
}
