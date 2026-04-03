/* eslint-env browser */
import { renderMermaidSVG, THEMES } from "beautiful-mermaid";
import rehypeShiki from "@shikijs/rehype";
import rehypeStringify from "rehype-stringify";
import remarkParse from "remark-parse";
import remarkRehype from "remark-rehype";
import { unified } from "unified";

const THEME_NAME = "github-light";

interface Node {
  type: string;
  children?: Node[];
  value?: string;
}
interface HastElement extends Node {
  type: "element";
  tagName: string;
  properties?: {
    className?: string | string[];
  };
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

function visit<T extends Node>(
  node: T,
  visitor: (node: T, parent: T, index: number) => void,
  parent?: T,
  index = 0,
) {
  visitor(node, parent || node, index);
  if (node.children) {
    for (const [index, child] of node.children.entries()) {
      visit(child as T, visitor, node, index);
    }
  }
}

export async function markdownToHtml(
  markdown: string,
): Promise<string> {
  const mermaidTheme = THEMES[THEME_NAME] ?? { bg: "#ffffff", fg: "#24292f" };

  const file = await unified()
    // deno-lint-ignore no-explicit-any
    .use(remarkParse as any)
    .use(remarkRehype)
    .use(() => {
      return (tree: HastElement) => {
        visit(
          tree,
          (node, parent, index) => {
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
    // deno-lint-ignore no-explicit-any
    .use(rehypeShiki as any)
    // deno-lint-ignore no-explicit-any
    .use(rehypeStringify as any, { allowDangerousHtml: true })
    .process(markdown);

  return String(file);
}
