/**
 * トップページ(`/`)のランディングレイアウト。
 *
 * {@link renderSlideDocument} の `shell` に渡し、紹介デッキを自動再生する
 * phone モックアップ(ステージ)をヒーローの右側に埋め込む。それ以外の
 * セクションは静的 HTML。スクロールに合わせた出現アニメーションは
 * `client/home.ts` が `[data-reveal]` に付ける(JS 無効でも全部見える)。
 */

const MCP_URL = "https://zenpre.heartrails.deno.net/mcp";

/** 流れるテープに並べる言葉。 */
const MARQUEE = [
  "markdown",
  "スマホ全画面",
  "mermaid",
  "zen-html",
  "リアクション",
  "見出しフォーカス",
  "自動再生",
  "X カードで再生",
  "Remote MCP",
  "QR で共有",
];

const FEATURES = [
  {
    icon: "⚡",
    title: "Interactive",
    body:
      "発表者のページ送りと「ここを見て」が客席のスマホへ一瞬で届く。リアクションも質問も、その場で画面に。",
  },
  {
    icon: "🤖",
    title: "AI-native",
    body:
      "AI に markdown を書かせて Remote MCP で公開するだけ。スライドは素のテキストなので、AI もそのまま読める。",
  },
  {
    icon: "📱",
    title: "Mobile-native",
    body:
      "縦長・全画面がネイティブ。左右でページ、上下でページの奥へ。16:9 の紙芝居から卒業。",
  },
];

const STEPS = [
  {
    n: "01",
    title: "書く",
    body: "`---` で区切った markdown。図は mermaid、動きは zen-html。",
    code: "# ZenPre\n\n---\n\n# なぜ?\n\n- スマホで見られる\n- AI が書ける",
  },
  {
    n: "02",
    title: "公開する",
    body: "エディタで作成、または AI が MCP の upload_slide を呼ぶ。",
    code: "upload_slide({ markdown })\n// → /s/xxxxxxxx",
  },
  {
    n: "03",
    title: "発表する",
    body: "URL を配れば客席のスマホがスクリーンに。録画すれば自動再生も。",
    code: "create_talk({ slide_id })\n// → 客席 URL / 発表者 URL",
  },
];

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** `code` を <code> にした本文。 */
const inline = (s: string) => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

/** ステージ(phone モックアップ)を埋め込んだランディングページの body。 */
export function landingShell(stage: string): string {
  const marquee = [...MARQUEE, ...MARQUEE]
    .map((w) => `<span>${esc(w)}</span><span aria-hidden="true">✦</span>`)
    .join("");

  const features = FEATURES.map((f, i) => `
      <article class="zl-card" data-reveal style="--zl-delay:${i * 120}ms">
        <div class="zl-card-icon" aria-hidden="true">${f.icon}</div>
        <h3>${esc(f.title)}</h3>
        <p>${inline(f.body)}</p>
      </article>`).join("");

  const steps = STEPS.map((s, i) => `
      <li class="zl-step" data-reveal style="--zl-delay:${i * 120}ms">
        <span class="zl-step-n">${s.n}</span>
        <h3>${esc(s.title)}</h3>
        <p>${inline(s.body)}</p>
        <pre><code>${esc(s.code)}</code></pre>
      </li>`).join("");

  return `<div class="zl">
  <div class="zl-bg" aria-hidden="true">
    <span class="zl-blob zl-blob-1"></span>
    <span class="zl-blob zl-blob-2"></span>
    <span class="zl-blob zl-blob-3"></span>
    <span class="zl-grid"></span>
  </div>

  <header class="zl-nav">
    <a href="/" class="zl-logo">Zen<span>Pre</span></a>
    <nav>
      <a href="#features">特徴</a>
      <a href="#how">使い方</a>
      <a href="#ai">AI と使う</a>
      <a href="/new" class="zl-btn zl-btn-sm">スライドを作る</a>
    </nav>
  </header>

  <section class="zl-hero">
    <div class="zl-hero-copy">
      <p class="zl-badge"><span class="zl-dot"></span>markdown → スマホで発表</p>
      <h1 class="zl-title">
        <span>Presentation,</span>
        <span class="zl-gradient-text">redefined.</span>
      </h1>
      <p class="zl-lead">
        <code>---</code> で区切った markdown が、そのままスマホ全画面のプレゼンに。
        ページ送りも、客席のリアクションも、リアルタイムに同期。
      </p>
      <div class="zl-actions">
        <a href="/new" class="zl-btn">スライドを作る →</a>
        <a href="#ai" class="zl-btn zl-btn-ghost">AI に作らせる</a>
      </div>
      <ul class="zl-chips" aria-label="主な機能">
        <li>👏 リアクション</li>
        <li>🎯 見出しフォーカス</li>
        <li>⏺️ 録画して自動再生</li>
      </ul>
    </div>
    <div class="zl-hero-stage">
      <div class="zl-halo" aria-hidden="true"></div>
      <div class="zl-floaters" aria-hidden="true">
        <span>🎉</span><span>❤️</span><span>👏</span><span>✨</span><span>🔥</span>
      </div>
      ${stage}
      <p class="zl-stage-note">↑ いま再生中のこれも ZenPre。触ると止まって自由にめくれます。</p>
    </div>
  </section>

  <div class="zl-marquee" aria-hidden="true"><div class="zl-marquee-track">${marquee}</div></div>

  <section id="features" class="zl-section">
    <h2 class="zl-h2" data-reveal>3 つの <span class="zl-gradient-text">native</span></h2>
    <div class="zl-cards">${features}
    </div>
  </section>

  <section id="how" class="zl-section">
    <h2 class="zl-h2" data-reveal>書いて、配って、<span class="zl-gradient-text">盛り上がる</span></h2>
    <ol class="zl-steps">${steps}
    </ol>
  </section>

  <section id="ai" class="zl-section">
    <div class="zl-ai" data-reveal>
      <div>
        <h2 class="zl-h2">AI に<span class="zl-gradient-text">頼むだけ</span></h2>
        <p class="zl-lead">
          Remote MCP をつなげば、AI がスライドを書いて、公開して、発表枠まで作ります。
          OAuth も不要です。
        </p>
        <p class="zl-mcp"><span>MCP</span><code>${MCP_URL}</code></p>
        <p class="zl-small">AI エージェントは最初に <a href="/AGENTS.md">AGENTS.md</a> を読んでください。</p>
      </div>
      <div class="zl-chat" aria-label="AI への頼み方の例">
        <p class="zl-chat-me">来週の勉強会用に、Deno の新機能を 8 枚で。テーマはイベント感強めで!</p>
        <p class="zl-chat-ai">
          スライドを公開しました 🎉<br>
          <code>/s/7fQ2xKpA</code><br>
          自動再生 URL と、発表者 URL も作っておきました。
        </p>
      </div>
    </div>
  </section>

  <section class="zl-section">
    <div class="zl-cta" data-reveal>
      <h2>次のプレゼン、<br class="zl-sp">スマホで始めよう。</h2>
      <p>登録なし。markdown を貼るだけで URL ができます。</p>
      <a href="/new" class="zl-btn zl-btn-light">いますぐ作る →</a>
    </div>
  </section>

  <footer class="zl-footer">
    <span>© ZenPre</span>
    <a href="/AGENTS.md">AI 向けガイド</a>
    <a href="https://github.com/kuboon/zenpre" target="_blank" rel="noopener noreferrer">GitHub</a>
  </footer>
</div>`;
}
