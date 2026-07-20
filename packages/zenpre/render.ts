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
import rehypeShiki from "@shikijs/rehype";
import { toHtml } from "hast-util-to-html";
import { visit } from "unist-util-visit";
import { renderMermaidSVG } from "beautiful-mermaid";
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

/** {@link renderSlides} のオプション。 */
export type RenderOptions = {
  /** コードハイライトの shiki テーマ名(default: "github-light")。 */
  theme?: string;
};

/** hast 要素配下のテキストを連結して返す。 */
function textOf(node: Element): string {
  let out = "";
  visit(node, "text", (t) => {
    out += t.value;
  });
  return out;
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
        svg = renderMermaidSVG(textOf(code));
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
    .use(rehypeShiki, { theme: opts.theme ?? "github-light" });

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
