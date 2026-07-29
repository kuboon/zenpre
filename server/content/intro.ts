/**
 * トップページ(`/`)で自動再生する ZenPre の紹介プレゼン。
 *
 * ZenPre 自身の機能(`---` 区切り・見出し採番・shiki・mermaid・daisyUI theme)
 * だけで書かれた dogfooding のスライド。KV を使わず静的に配信する。
 */

export const INTRO_THEME = "synthwave";

/** 1 ページあたりの自動送り間隔(ms)。 */
export const INTRO_AUTOPLAY_MS = 5000;

export const INTRO_MARKDOWN = `# ZenPre

**\`---\` 区切りの markdown を、そのままプレゼンに。**

AI 時代のプレゼンツール。スマホ縦画面フルスクリーンがネイティブ。

_（このページ自体が ZenPre で作った自動再生スライドです）_

---

## そのまま書くだけ

普通の markdown を書くと、\`---\` でページが分かれます。

- 左右スワイプ / 矢印キー でページ移動
- 上下スクロールでページ内を移動
- 見出しごとに番号が振られ、後で「ここに注目」を送れる

---

## コードは自動ハイライト

\`\`\`ts
import { renderSlides } from "@kuboon/zenpre";

const slide = await renderSlides(md);
slide.pages; // ページごとの HTML
\`\`\`

shiki が markdown のコードブロックをそのまま色付けします。

---

## 図も markdown で

\`\`\`mermaid
flowchart LR
  MD[markdown] --> R[renderSlides]
  R --> V[zen-slide-viewer]
  V --> A[audience]
\`\`\`

mermaid ブロックはインライン SVG になります。

---

## テーマは daisyUI

\`theme\` を変えるだけで配色が切り替わります
（このスライドは \`synthwave\`）。

light / dark / cupcake / dracula / nord / lofi …

---

## これから

- リアルタイム同期(presenter の操作を全員へ）
- リアクション・投稿・投票
- 記録して後から再生

作り方・進捗は
[GitHub: kuboon/zenpre](https://github.com/kuboon/zenpre) で。
`;
