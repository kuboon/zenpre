/**
 * トップページ(`/`)で自動再生する ZenPre の紹介プレゼン。
 *
 * ZenPre 自身の機能(`---` 区切り・見出し採番・shiki・mermaid・daisyUI theme・
 * サンドボックス HTML スライド)だけで書かれた dogfooding のスライド。KV を
 * 使わず静的に配信し、固定の {@link INTRO_TIMELINE} を `Player`(M4)で再生する
 * (focus と reaction)。実装済み機能を一通り紹介する。
 */
import type { TimelineEntry } from "@kuboon/zenpre/schemas.ts";

export const INTRO_THEME = "synthwave";

/**
 * トップページで Player に流す固定 timeline。presenter が全 11 ページを送りつつ
 * リアクションを飛ばす様子を再現する(ループ再生)。焦点は各ページ先頭
 * (idx 0)。t はミリ秒。
 */
export const INTRO_TIMELINE: TimelineEntry[] = [
  { t: 0, action: { type: "focus", page: 1, idx: 0 } },
  { t: 1600, action: { type: "reaction", emoji: "👋" } },
  { t: 3000, action: { type: "focus", page: 2, idx: 0 } },
  { t: 5000, action: { type: "focus", page: 3, idx: 0 } },
  { t: 6800, action: { type: "reaction", emoji: "👏" } },
  { t: 7500, action: { type: "focus", page: 4, idx: 0 } },
  { t: 9500, action: { type: "reaction", emoji: "🤯" } },
  { t: 10000, action: { type: "focus", page: 5, idx: 0 } },
  { t: 12000, action: { type: "reaction", emoji: "🎨" } },
  { t: 12500, action: { type: "focus", page: 6, idx: 0 } },
  { t: 14500, action: { type: "reaction", emoji: "👀" } },
  { t: 15000, action: { type: "focus", page: 7, idx: 0 } },
  { t: 17000, action: { type: "reaction", emoji: "❤️" } },
  { t: 17300, action: { type: "reaction", emoji: "🙌" } },
  { t: 18000, action: { type: "focus", page: 8, idx: 0 } },
  { t: 20000, action: { type: "focus", page: 9, idx: 0 } },
  { t: 21500, action: { type: "reaction", emoji: "🔒" } },
  { t: 22000, action: { type: "focus", page: 10, idx: 0 } },
  { t: 25000, action: { type: "reaction", emoji: "✨" } },
  { t: 26000, action: { type: "focus", page: 11, idx: 0 } },
  { t: 27500, action: { type: "reaction", emoji: "🎉" } },
  { t: 28500, action: { type: "reaction", emoji: "❤️" } },
];

export const INTRO_MARKDOWN = `# ZenPre

**\`---\` 区切りの markdown を、そのままプレゼンに。**

スマホ縦画面フルスクリーンがネイティブ。リアルタイム同期つき。

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
import { renderSlides } from "@kuboon/zenpre/render.ts";

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

## リアルタイム同期

発表者のページ送りが、その場で**全員の画面に追従**します。

- presenter の focus を relay(WebSocket）で配信
- 途中参加・再接続でも現在ページに追いつく
- 在室数もゆるく共有

---

## リアクション・投稿・投票

- 絵文字リアクションが風船のように昇る 🎈
- 質問を**投稿**でき、**モデレーター承認後**にだけ全員へ
- 承認された投稿は**投票数**でソート

audience は鍵不要。presenter / moderator は capability key で参加。

---

## 記録して、あとで再生

発表中の focus・reaction・投稿は timeline に記録され、
\`/t/:id/replay\` でシークバー付きで**再生**できます。

その場にいなくても、プレゼンを追体験できます。

---

## HTML スライドも“安全に”

\`zen-html\` ブロックで、JS / CSS アニメ入りの HTML をスライドに。

untrusted な HTML は **sandbox iframe + 厳格 CSP** に隔離:

- 通信は**全遮断**（fetch / WebSocket / リモート画像も不可）
- 描画は**スライド枠内だけ**（UI 偽装は不能）
- でも **JS / CSS アニメはローカルで動く** →

---

\`\`\`zen-html
<div class="stage">
  <div class="orb"></div>
  <p class="cap">この画面は <b>sandbox iframe</b> の中。<br>
  通信は遮断。JS/CSS アニメだけが動く 🔒</p>
</div>
<style>
  .stage{height:100%;display:grid;place-items:center;gap:1.2rem;
    background:radial-gradient(circle at 50% 32%, #2d1b69, #1a103c);
    color:#f8f8ff;font-family:system-ui,sans-serif;text-align:center;padding:1rem}
  .orb{width:96px;height:96px;border-radius:50%;
    background:conic-gradient(from 0deg,#f637ec,#37c3f6,#f6d137,#f637ec);
    box-shadow:0 0 44px #f637ecaa;animation:float 2.8s ease-in-out infinite}
  .cap{font-size:.95rem;line-height:1.7;margin:0;opacity:.96}
  .cap b{color:#f637ec}
  @keyframes float{
    0%{transform:translateY(0) rotate(0)}
    50%{transform:translateY(-18px) rotate(180deg)}
    100%{transform:translateY(0) rotate(360deg)}}
</style>
\`\`\`

---

## 使い方いろいろ・これから

- **セルフホスト**: 静的サイトに \`@kuboon/zenpre\` を esm.sh で読み込み、
  relay だけ借りる（\`viewer.connect()\`）
- **Remote MCP**: Claude 等から slide / talk を作成（\`/mcp\`）
- PWA（ホーム画面に追加）にも対応

作り方・進捗は
[GitHub: kuboon/zenpre](https://github.com/kuboon/zenpre) で。
`;
