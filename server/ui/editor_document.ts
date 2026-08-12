/**
 * `/new` — markdown エディタ(textarea + ライブプレビュー + 作成)の HTML。
 *
 * スライド本体のページ({@link renderSlideDocument})とは別レイアウトなので
 * 専用のドキュメントを組み立てる。プレビューは `<zen-slide-viewer>` に
 * `load({ markdown })` させるだけ(SSR しない)= 実際の閲覧画面と同じ描画経路。
 */
import { escapeHtml } from "@kuboon/zenpre/sandbox.ts";

/** テーマ選択に出す daisyUI テーマ(assets/style.css の `@plugin daisyui` と対応)。 */
export const EDITOR_THEMES = [
  "light",
  "dark",
  "cupcake",
  "synthwave",
  "retro",
  "dracula",
  "business",
  "nord",
  "lofi",
] as const;

/** エディタに最初から入れておくサンプル markdown。 */
export const SAMPLE_MARKDOWN = `# タイトル

**\`---\` でページが分かれます。**

書いたそばから右のプレビューに反映されます。

---

## 箇条書き

- 左右スワイプ / 矢印キーでページ移動
- 上下スクロールでページ内を移動

---

## コードも図も

\`\`\`ts
const hello = "world";
\`\`\`

\`\`\`mermaid
flowchart LR
  A[markdown] --> B[slide]
\`\`\`
`;

/** `/new` の完全な HTML ドキュメントを返す。 */
export function renderEditorDocument(): string {
  const themeOptions = EDITOR_THEMES
    .map((t) =>
      `<option value="${t}"${t === "light" ? " selected" : ""}>${t}</option>`
    )
    .join("");

  return `<!doctype html>
<html lang="ja" data-theme="light">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>新しいスライド — ZenPre</title>
<link rel="stylesheet" href="/style.css">
</head>
<body>
<div class="zen-editor">
  <section class="zen-editor-pane">
    <header class="zen-editor-bar">
      <a href="/" class="zen-editor-home" aria-label="ZenPre トップへ">← ZenPre</a>
      <label class="zen-editor-theme">
        テーマ
        <select id="zen-theme" class="select select-xs">${themeOptions}</select>
      </label>
      <button type="button" id="zen-create" class="btn btn-primary btn-sm">
        スライドを作成
      </button>
    </header>
    <textarea id="zen-md" class="zen-editor-input" spellcheck="false"
      aria-label="markdown">${escapeHtml(SAMPLE_MARKDOWN)}</textarea>
    <output id="zen-result" class="zen-editor-result" hidden></output>
  </section>
  <section class="zen-editor-preview" id="zen-preview" data-theme="light">
    <div class="zen-preview-frame">
      <zen-slide-viewer></zen-slide-viewer>
    </div>
  </section>
</div>
<script type="module" src="/new.js"></script>
</body>
</html>`;
}
