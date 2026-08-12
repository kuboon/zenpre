/**
 * markdown → スライド(multipage HTML)変換。
 *
 * unified(remark → rehype)の 1 パイプラインで parse・変換を行い、
 * ページ分割は最終 hast の root 直下 `<hr>`(mdast の thematicBreak = `---`)
 * で実施する。文字列 split をしないため、コードフェンス内の `---` を誤って
 * ページ境界と扱う問題が構造的に起きない。
 *
 * - コードハイライト: `@shikijs/rehype`(内部で unified/hast を使うので
 *   AST 走査が最小)。
 * - 図: ` ```mermaid ` ブロックは beautiful-mermaid の同期 `renderMermaidSVG`
 *   でその場で SVG 化(DOM 不要)。
 *
 * ブラウザ(SlideViewer)・サーバ(SSR)・静的ビルドのどこでも同一結果に
 * なるよう、DOM 非依存で実装する。
 *
 * @module
 */
import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkFrontmatter from "remark-frontmatter";
import remarkRehype from "remark-rehype";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import { createHighlighterCore, type HighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { toHtml } from "hast-util-to-html";
import { visit } from "unist-util-visit";
import { renderMermaidSVG } from "beautiful-mermaid";
import { sandboxedHtmlFrame } from "./sandbox.ts";
import type { Element, Root, RootContent } from "hast";

/** ページ内の heading 参照(focus のターゲットに使う)。 */
export type HeadingRef = {
  /** ページ番号(1 起点)。 */
  page: number;
  /** ページ内 heading 番号(1 起点。0 はページ先頭を意味し heading には使わない)。 */
  idx: number;
  /** h1–h6 の見出しレベル。 */
  depth: number;
  /** 見出しテキスト。 */
  text: string;
};

/** {@link renderSlides} の結果。 */
export type RenderedSlide = {
  /** 先頭ページ最初の h1 テキスト。無ければ "Untitled"。 */
  title: string;
  /** ページごとの HTML(配列 index + 1 がページ番号)。 */
  pages: string[];
  /** 全ページの heading 一覧。 */
  headings: HeadingRef[];
};

/**
 * コードハイライトで使える shiki テーマ。全 130 テーマを同梱するとクライアント
 * バンドルが肥大するため、明るい/暗いの 2 つだけを載せる。
 */
export const SHIKI_THEMES = ["github-light", "github-dark"] as const;

/**
 * コードハイライトで使える言語。shiki は 692 言語を同梱できるが、それを
 * バンドルすると 1 エントリ 14MB になるため、プレゼンでよく使うものに絞る。
 * ここに無い言語はハイライトなし(プレーン)で描画する(エラーにはしない)。
 */
export const SHIKI_LANGUAGES = [
  "typescript",
  "javascript",
  "tsx",
  "jsx",
  "json",
  "yaml",
  "toml",
  "html",
  "css",
  "markdown",
  "shellscript",
  "python",
  "go",
  "rust",
  "sql",
  "diff",
] as const;

/** {@link renderSlides} のオプション。 */
export type RenderOptions = {
  /**
   * コードハイライトのテーマ名(default: `"github-light"`)。
   * {@link SHIKI_THEMES} 以外を渡した場合は既定にフォールバックする。
   */
  theme?: string;
};

/**
 * 実際に読み込む文法/テーマ。**指定子はリテラルで書く**こと。テンプレート
 * 文字列にするとバンドラが解決できず、未解決の bare specifier が残って
 * ブラウザ実行時に落ちる({@link SHIKI_LANGUAGES} と対応させる)。
 */
const THEME_IMPORTS = [
  import("shiki/themes/github-light.mjs"),
  import("shiki/themes/github-dark.mjs"),
];
const LANG_IMPORTS = [
  import("shiki/langs/typescript.mjs"),
  import("shiki/langs/javascript.mjs"),
  import("shiki/langs/tsx.mjs"),
  import("shiki/langs/jsx.mjs"),
  import("shiki/langs/json.mjs"),
  import("shiki/langs/yaml.mjs"),
  import("shiki/langs/toml.mjs"),
  import("shiki/langs/html.mjs"),
  import("shiki/langs/css.mjs"),
  import("shiki/langs/markdown.mjs"),
  import("shiki/langs/shellscript.mjs"),
  import("shiki/langs/python.mjs"),
  import("shiki/langs/go.mjs"),
  import("shiki/langs/rust.mjs"),
  import("shiki/langs/sql.mjs"),
  import("shiki/langs/diff.mjs"),
];

/** 生成コストが高いので 1 度だけ作って使い回す。 */
let highlighterPromise: Promise<HighlighterCore> | undefined;

/**
 * 実際に読み込まれている文法名(テスト用)。{@link SHIKI_LANGUAGES} と
 * {@link LANG_IMPORTS} のずれを検知する。
 */
export async function loadedShikiLanguages(): Promise<string[]> {
  return (await getHighlighter()).getLoadedLanguages();
}

/** 絞り込んだ言語/テーマだけを載せた shiki highlighter を返す。 */
function getHighlighter(): Promise<HighlighterCore> {
  highlighterPromise ??= createHighlighterCore({
    themes: THEME_IMPORTS,
    langs: LANG_IMPORTS,
    // oniguruma(wasm)ではなく JS の RegExp エンジンを使い、wasm を載せない。
    engine: createJavaScriptRegexEngine({ forgiving: true }),
  });
  return highlighterPromise;
}

/** hast 要素配下のテキストを連結して返す。 */
function textOf(node: Element): string {
  let out = "";
  visit(node, "text", (t) => {
    out += t.value;
  });
  return out;
}

/**
 * 生成物から外部 URL の `@import`(webfont 等)を取り除く。
 *
 * beautiful-mermaid は SVG の `<style>` に Google Fonts の `@import` を埋める。
 * そのままだと閲覧者のブラウザが第三者へリクエストしてしまい、スライド由来の
 * 外向き通信を禁じる CSP(server/app.ts)にも弾かれてコンソールが汚れる。
 * 図はローカルフォントにフォールバックさせ、出力を自己完結させる。
 */
function stripRemoteImports(svg: string): string {
  // `@import url(...)` と `@import "..."` の両形式、`//` 始まりのスキーム相対、
  // 末尾のメディアクエリ(`… screen;`)まで含めて落とす。
  return svg.replace(
    /@import\s+(?:url\(\s*['"]?(?:https?:)?\/\/[^)]*\)|['"](?:https?:)?\/\/[^'"]*['"])[^;]*;?/gi,
    "",
  );
}

/**
 * ` ```mermaid ` コードブロック(hast の `<pre><code class="language-mermaid">`)
 * を beautiful-mermaid の SVG に置換する rehype プラグイン。
 * shiki より前に適用して、mermaid が未知言語として shiki に渡らないようにする。
 */
function rehypeMermaid() {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || index === undefined || !parent) return;
      const code = node.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "code",
      );
      if (!code) return;
      const classes = code.properties?.className;
      if (!Array.isArray(classes) || !classes.includes("language-mermaid")) {
        return;
      }
      let svg: string;
      try {
        svg = stripRemoteImports(renderMermaidSVG(textOf(code)));
      } catch {
        return; // レンダリング失敗時は元のコードブロックを残す
      }
      const replacement = {
        type: "element",
        tagName: "div",
        properties: { className: ["zen-mermaid"] },
        children: [{ type: "raw", value: svg }],
      } as unknown as Element;
      parent.children[index] = replacement;
    });
  };
}

/**
 * ` ```zen-html ` コードブロックを、全通信を遮断したサンドボックス `<iframe>`
 * に置換する rehype プラグイン(mermaid と同型)。author の生 HTML はこの
 * フェンス経由でのみ出力に到達し、必ず {@link sandboxedHtmlFrame} で隔離される。
 * shiki より前に適用して、`zen-html` が未知言語として shiki に渡らないようにする。
 *
 * 素の ` ```html ` は対象外(従来どおり shiki のソースハイライトのまま)。
 */
function rehypeHtmlSandbox() {
  return (tree: Root) => {
    visit(tree, "element", (node, index, parent) => {
      if (node.tagName !== "pre" || index === undefined || !parent) return;
      const code = node.children.find(
        (c): c is Element => c.type === "element" && c.tagName === "code",
      );
      if (!code) return;
      const classes = code.properties?.className;
      if (!Array.isArray(classes) || !classes.includes("language-zen-html")) {
        return;
      }
      const replacement = {
        type: "element",
        tagName: "div",
        properties: { className: ["zen-html-page"] },
        children: [{ type: "raw", value: sandboxedHtmlFrame(textOf(code)) }],
      } as unknown as Element;
      parent.children[index] = replacement;
    });
  };
}

/**
 * markdown をスライド(ページごとの HTML)にレンダリングする。
 *
 * @param markdown 入力 markdown(`---` 単独行でページ分割)。
 * @param opts レンダリングオプション。
 */
export async function renderSlides(
  markdown: string,
  opts: RenderOptions = {},
): Promise<RenderedSlide> {
  const processor = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkFrontmatter, ["yaml"])
    .use(remarkRehype)
    .use(rehypeMermaid)
    .use(rehypeHtmlSandbox)
    .use(rehypeShikiFromHighlighter, await getHighlighter(), {
      theme: SHIKI_THEMES.includes(opts.theme as typeof SHIKI_THEMES[number])
        ? opts.theme!
        : "github-light",
      // 同梱していない言語はエラーにせずプレーン表示にフォールバックする。
      fallbackLanguage: "text",
    });

  const tree = (await processor.run(processor.parse(markdown))) as Root;

  // root 直下の <hr> でページ分割。element を 1 つも含まないページは捨てる。
  const rawPages: RootContent[][] = [[]];
  for (const child of tree.children) {
    if (child.type === "element" && child.tagName === "hr") {
      rawPages.push([]);
    } else {
      rawPages[rawPages.length - 1].push(child);
    }
  }
  const pageNodes = rawPages.filter((nodes) =>
    nodes.some((n) => n.type === "element")
  );

  const headings: HeadingRef[] = [];
  const pages: string[] = [];
  let title = "";

  pageNodes.forEach((nodes, pi) => {
    const page = pi + 1;
    let idx = 0;
    const root: Root = { type: "root", children: nodes };
    visit(root, "element", (node) => {
      if (!/^h[1-6]$/.test(node.tagName)) return;
      idx += 1;
      const depth = Number(node.tagName[1]);
      const text = textOf(node);
      node.properties = {
        ...node.properties,
        "data-page": page,
        "data-idx": idx,
      };
      headings.push({ page, idx, depth, text });
      if (depth === 1 && title === "") title = text;
    });
    pages.push(toHtml(root, { allowDangerousHtml: true }));
  });

  return { title: title || "Untitled", pages, headings };
}
