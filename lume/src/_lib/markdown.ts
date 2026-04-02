/* eslint-env browser */
import { renderMermaidSVG, THEMES } from "beautiful-mermaid";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { unified } from "https://esm.sh/unified@11?bundle";
import { visit } from "unist-util-visit";

const THEME_NAME = "github-light";

let highlighterPromise: ReturnType<typeof createHighlighterCore> | undefined;

function getHighlighter() {
  if (!highlighterPromise) {
    highlighterPromise = createHighlighterCore({
      themes: [
        import("shiki/themes").then((m) => m.bundledThemes[THEME_NAME]()),
      ],
      langs: [
        import("shiki/langs").then((m) => m.bundledLanguages["typescript"]()),
        import("shiki/langs").then((m) => m.bundledLanguages["javascript"]()),
        import("shiki/langs").then((m) => m.bundledLanguages["tsx"]()),
        import("shiki/langs").then((m) => m.bundledLanguages["jsx"]()),
        import("shiki/langs").then((m) => m.bundledLanguages["json"]()),
        import("shiki/langs").then((m) => m.bundledLanguages["bash"]()),
        import("shiki/langs").then((m) => m.bundledLanguages["html"]()),
        import("shiki/langs").then((m) => m.bundledLanguages["css"]()),
        import("shiki/langs").then((m) => m.bundledLanguages["markdown"]()),
      ],
      engine: createJavaScriptRegexEngine(),
    });
  }
  return highlighterPromise;
}

type HastElement = {
  type: "element";
  tagName: string;
  properties?: {
    className?: string | string[];
  };
  children?: Array<{ type: string; value?: string }>;
};

function getCodeInfo(
  node: HastElement,
): { lang: string; code: string } | undefined {
  const codeNode = node.children?.find((child) => child.type === "element") as
    | HastElement
    | undefined;

  if (!codeNode || codeNode.tagName !== "code") {
    return undefined;
  }

  const className = codeNode.properties?.className;
  const classList = Array.isArray(className)
    ? className
    : typeof className === "string"
    ? [className]
    : [];

  const langClass = classList.find((name) => name.startsWith("language-"));
  const lang = langClass?.replace("language-", "") ?? "text";
  const code = (codeNode.children ?? [])
    .map((child) => child.value ?? "")
    .join("");

  return { lang, code };
}

export default async function markdownToHtml(
  markdown: string,
): Promise<string> {
  const highlighter = await getHighlighter();
  const mermaidTheme = THEMES[THEME_NAME] ?? { bg: "#ffffff", fg: "#24292f" };

  const file = await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(() => {
      return (tree) => {
        visit(
          tree,
          "element",
          (node: HastElement, index, parent: HastElement) => {
            if (!parent || typeof index !== "number") return;
            if (node.tagName !== "pre") return;

            const info = getCodeInfo(node);
            if (!info) return;

            if (info.lang === "mermaid") {
              try {
                const svg = renderMermaidSVG(info.code, {
                  ...mermaidTheme,
                  transparent: true,
                });
                parent.children![index] = {
                  type: "raw",
                  value: `<figure class="beautiful-mermaid">${svg}</figure>`,
                };
              } catch {
                // If rendering fails, keep the original pre/code block.
              }
              return;
            }
          },
        );
      };
    })
    .use(rehypeShikiFromHighlighter, highlighter as any, {
      theme: THEME_NAME,
      defaultLanguage: "text",
      fallbackLanguage: "text",
    })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(markdown);

  return String(file);
}
