/**
 * トップページ(`/`)で自動再生する ZenPre の紹介プレゼン。
 *
 * ZenPre 自身の機能(`---` 区切り・見出し採番・shiki・mermaid・daisyUI theme)
 * だけで書かれた dogfooding のスライド。KV を使わず静的に配信し、固定の
 * {@link INTRO_TIMELINE} を `Player`(M4)で再生する(focus と reaction)。
 */
import type { TimelineEntry } from "@kuboon/zenpre/schemas.ts";

export const INTRO_THEME = "synthwave";

/**
 * トップページで Player に流す固定 timeline。presenter が 6 ページを送りつつ
 * リアクションを飛ばす様子を再現する(ループ再生)。焦点は各ページ先頭
 * (idx 0)。t はミリ秒。
 */
export const INTRO_TIMELINE: TimelineEntry[] = [
  { t: 0, action: { type: "focus", page: 1, idx: 0 } },
  { t: 1800, action: { type: "reaction", emoji: "👋" } },
  { t: 4000, action: { type: "focus", page: 2, idx: 0 } },
  { t: 6200, action: { type: "reaction", emoji: "👏" } },
  { t: 8000, action: { type: "focus", page: 3, idx: 0 } },
  { t: 10500, action: { type: "reaction", emoji: "🎉" } },
  { t: 12000, action: { type: "focus", page: 4, idx: 0 } },
  { t: 14000, action: { type: "reaction", emoji: "🤔" } },
  { t: 16000, action: { type: "focus", page: 5, idx: 0 } },
  { t: 19000, action: { type: "focus", page: 6, idx: 0 } },
  { t: 20500, action: { type: "reaction", emoji: "❤️" } },
  { t: 22000, action: { type: "reaction", emoji: "🎉" } },
];

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
