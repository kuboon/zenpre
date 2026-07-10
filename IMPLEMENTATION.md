# ZenPre 詳細実装計画

[PLAN.md](./PLAN.md) を要件定義として、**ゼロから作り直す**ための実装計画。
既存の実装(lume/ 以下・server/ 以下)は M0
で全て削除し、本計画の構成に置き換える。

## 1. ゴール / 非ゴール

**ゴール**

- `---` 区切りの markdown
  をそのままプレゼンにする。スマホ縦持ちフル画面がネイティブ。
  左右スワイプでページ遷移、上下スクロールでページ内移動。
- presenter の操作(focus)・audience の reaction / post / vote が
  同じトークを見ている全ブラウザにリアルタイム反映される。
- presenter の操作を timeline として記録し、後から再生できる。
- LLM から remote MCP でスライド作成・トーク作成ができる。
- フロントエンド機能の大半を **JSR パッケージ `@kuboon/zenpre`** として公開し、
  ユーザが自分の GitHub Pages に組み込んで **server
  のリレー機能だけを利用する**セルフホスト構成を可能にする。

**非ゴール(v1 では作らない)**

- ユーザーアカウント・ログイン(すべて capability key 方式で認可する)
- スライドの WYSIWYG エディタ(markdown は MCP または API で入稿)
- 動画配信(音声・映像は扱わない。画面同期のみ)

## 2. 技術スタック

| 領域               | 採用                                                               | 備考                                                                                                                            |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| ランタイム         | Deno(package.json なし、`deno.json` のみ)                          | Deno Deploy にデプロイ                                                                                                          |
| ライブラリ配布     | JSR `@kuboon/zenpre`                                               | フロント機能の大半(render / components / relay client / recorder / player)を提供                                                |
| Web フレームワーク | Remix v3 (`@remix-run/fetch-router` + `@remix-run/ui`)             | [deno-remix-reference](https://github.com/kuboon/deno-remix-reference/tree/main/reference) の構成・バージョンピンをそのまま踏襲 |
| 永続化             | Deno KV + [`jsr:@kuboon/kv`](https://jsr.io/@kuboon/kv)            | `KvRepo` 抽象に対して書き、本番 `denoKv.ts` / テスト `memory.ts` を差し替え                                                     |
| リアルタイム       | WebSocket + `BroadcastChannel`                                     | [deno-pubsub](https://github.com/kuboon/deno-pubsub) の実装を参考にする(isolate 間配信 + 直近値の KV 保存)                      |
| スキーマ検証       | arktype                                                            | Action・API 入出力を単一定義から共有                                                                                            |
| CSS                | Tailwind CSS v4 + daisyUI v5                                       | daisyUI theme をスライドテーマとして使う(PLAN 要件)                                                                             |
| markdown           | **unified**(remark / rehype)                                       | md → html (multipage) を `@kuboon/zenpre/render.ts` として export                                                               |
| コードハイライト   | shiki(`@shikijs/rehype`)                                           | rehype プラグインとして同一 hast パイプラインに組み込み、AST 処理を最小化                                                       |
| 図                 | [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) | DOM 不要・同期 `renderMermaidSVG` → render.ts 内で SVG 化                                                                       |
| MCP                | `npm:@modelcontextprotocol/sdk`                                    | Streamable HTTP を `/mcp` にマウント                                                                                            |

**Deno Deploy 注意点**

- エントリポイントは `server/main.ts` で `Deno.serve(router.fetch)` を呼ぶ
  (ローカルは `deno serve -P ./server/router.ts` でも起動できるよう router は
  default export しておく)。
- WebSocket / BroadcastChannel / KV はいずれも Deploy でネイティブサポート。
- 静的アセット(client bundle, CSS)はビルド成果物 `bundled/` を
  `@remix-run/static-middleware` で配信する。

## 3. リポジトリ構成(Deno workspace)

```
deno.json                   # workspace ルート: members, tasks, unstable: [bundle, kv]
packages/
  zenpre/                   # JSR: @kuboon/zenpre — フロント機能の大半をここに置く
    deno.json               # name/version/exports(JSR publish 設定)
    mod.ts                  # 主要 API の re-export
    schemas.ts              # arktype: Slide, Talk, Action, ワイヤ envelope
    keys.ts                 # id/key 生成・ハッシュ化(WebCrypto のみ使用)
    render.ts               # md -> html (multipage)。unified + shiki + beautiful-mermaid
    relay_client.ts         # WS 再接続・envelope 型付け(server URL は設定可能)
    components/
      slide_viewer.ts       # <zen-slide-viewer> Web Component
      post_viewer.ts        # <zen-post-viewer>
      reaction_layer.ts     # <zen-reaction-layer>(絵文字アニメ + WebAudio)
      controller.ts         # presenter UI
      moderator_ui.ts       # <zen-moderator-ui>
    recorder.ts player.ts
    moderators/
      blacklist.ts          # BlacklistModerator
server/                     # zenpre.deno.dev 本体(@kuboon/zenpre に workspace 依存)
  main.ts                   # Deno Deploy エントリ
  router.ts / routes.ts     # Remix v3 fetch-router
  controllers/              # ページ SSR + API ハンドラ
  relay/
    relay.ts                # WebSocket ハブ(このファイルにロジック集約)
    rate_limit.ts           # token bucket
  repo/                     # KvRepo(@kuboon/kv)ベースの永続化層
    repos.ts                # slides / talks / timelines の KvRepo 構築
  mcp.ts                    # MCP サーバ定義(/mcp)
client/                     # 本体サイトの各ページ hydration エントリ(薄い glue のみ)
bundler/                    # Deno.bundle + tailwindcss ビルド -> bundled/
examples/
  gh-pages/                 # セルフホスト用テンプレート(静的 HTML + esm.sh 経由 import)
tests/                      # 結合テスト(relay を実ソケットで叩く)
```

方針:

- **ロジックは packages/zenpre に寄せる**。server と client(本体サイト)は
  `@kuboon/zenpre` の薄い利用者にする。`---` 分割・採番・権限判定・key 生成は
  すべて pure function にして `Deno.test` で固める。
- viewer 類は **フレームワーク非依存の Web Component**。本体サイト・player・
  セルフホスト GitHub Pages で同一実装を使い回す。
- ファイル名は snake_case、TypeScript strict、テストは `@std/assert`。

### `@kuboon/zenpre` の exports(packages/zenpre/deno.json)

```jsonc
{
  "name": "@kuboon/zenpre",
  "version": "0.1.0",
  "exports": {
    ".": "./mod.ts",
    "./render.ts": "./render.ts",
    "./schemas.ts": "./schemas.ts",
    "./relay_client.ts": "./relay_client.ts",
    "./components.ts": "./components.ts", // 全 custom element を register する副作用 import
    "./recorder.ts": "./recorder.ts",
    "./player.ts": "./player.ts"
  }
}
```

- JSR の slow types 制約を満たす(公開 API に明示的型注釈)。
- CI に `deno publish --dry-run` を組み込み、常に publish 可能な状態を保つ。
- ブラウザからは `https://esm.sh/jsr/@kuboon/zenpre` で直接 import できることを
  examples/gh-pages で保証する(bundler を要求しない)。

## 4. データモデルと KV スキーマ

```ts
// packages/zenpre/schemas.ts(arktype 定義から型を導出する)
type Slide = {
  slide_id: string; // 公開 ID(URL に載る)
  title: string; // markdown 先頭 h1 から自動抽出、なければ "Untitled"
  markdown: string; // 原文のまま保存(レンダリングは render.ts)
  css: string; // 追加 CSS
  theme: string; // daisyUI theme 名(default: "light")
  created_at: string;
  updated_at: string; // ISO8601
};

type Talk = {
  talk_id: string;
  slide_id: string | null; // セルフホスト(markdown を自サイトで供給)の場合は null
  begin_at: string; // ISO8601
  end_at: string | null;
  created_at: string;
};

type TimelineEntry = { t: number /* begin からの経過 ms */; action: Action };
```

永続化層は [`jsr:@kuboon/kv`](https://jsr.io/@kuboon/kv) の `KvRepo`
抽象で書く。 本番は `@kuboon/kv/denoKv.ts`、テストは `@kuboon/kv/memory.ts`
を注入する。

```ts
// server/repo/repos.ts
import type { KvRepo } from "@kuboon/kv";
import { DenoKvRepo } from "@kuboon/kv/denoKv.ts";

export type Repos = {
  slides: KvRepo<Slide>; //            prefix ["slides"],       key: slide_id
  slideKeys: KvRepo<KeyHash>; //       prefix ["slide_keys"],   key: slide_id
  talks: KvRepo<Talk>; //              prefix ["talks"],        key: talk_id
  talkKeys: KvRepo<TalkKeyHashes>; //  prefix ["talk_keys"],    key: talk_id
  timelines: (talk_id: string) => KvRepo<TimelineEntry[]>; // prefix ["timelines", talk_id], key: seq
  lastFocus: KvRepo<Action>; //        prefix ["last_focus"],   key: talk_id(expireIn: 24h)
};
```

- 書き込みは `repo.entry(id).update(() => value)`(楽観的並行制御は timeline
  chunk の追記で活用)。
- timeline は reaction を含むと 64KiB を超え得るため chunk 分割 (1 chunk ~500
  件、`for await` で全 chunk 復元)。
- `lastFocus` は deno-pubsub の「直近値を KV に保存して新規購読者へ返す」
  パターンの流用(§8)。
- slide の markdown が KV の 64KiB 値制限を超える場合は 400 を返す(v1
  は分割保存しない)。

**ID / key 生成**(`packages/zenpre/keys.ts`)

- `slide_id` / `talk_id` / `post_id`: `crypto.getRandomValues` → base58 8
  文字(公開・URL 用。`KvRepo.genKey()` の ULID は URL に長いため使わない)
- `slide_key` / `talk_key`(presenter)/ `moderator_key`: base58 26 文字(≈152bit)
- KV には **SHA-256 ハッシュのみ保存**。照合は `timingSafeEqual` 相当の比較。
- key はレスポンスで一度だけ返す。紛失時の再発行は v1 では非対応。

## 5. 権限モデル

すべて capability key。ロールは接続時に決まる:

| ロール    | 認証                                         | できること                                                                                             |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| presenter | `talk_key`                                   | focus の pub、level-0 post の受信、post の level 昇格 + `post_id` 発行、reaction/vote、timeline の保存 |
| moderator | `moderator_key`                              | level-0 post の受信、post の level 昇格 + `post_id` 発行(複数接続可)                                   |
| audience  | 不要(接続時に relay が `audience_id` を採番) | join / reaction / post(level 0 のみ)/ vote                                                             |

## 6. markdown → スライド変換(`@kuboon/zenpre/render.ts`)

**unified エコシステム**で md → html (multipage) を実装し、
`@kuboon/zenpre/render.ts` として export する。DOM 非依存で書き、
ブラウザ(SlideViewer 内)・サーバ(SSR)・GitHub Pages のビルド時、
どこでも同じ結果になるようにする。

```ts
export type RenderedSlide = {
  title: string; // 先頭 h1 のテキスト
  pages: string[]; // ページごとの HTML(1 起点は配列 index + 1)
  headings: { page: number; idx: number; depth: number; text: string }[];
};
export async function renderSlides(
  markdown: string,
  opts?: { theme?: string },
): Promise<RenderedSlide>;
```

**パイプライン(AST 処理を最小化する)**

shiki(`@shikijs/rehype`)は内部で unified/hast を使うので、 parse → 変換 →
stringify を **1 本のパイプラインに統合**し、 mdast/hast の走査回数を最小にする:

1. `remark-parse` + `remark-gfm` + `remark-frontmatter`(frontmatter は無視) →
   mdast(**parse は 1 回だけ**)
2. `remark-rehype` → hast(1 回)
3. `@shikijs/rehype` — コードブロックのハイライト。highlighter は render.ts 内の
   lazy singleton とし、言語はスライドに登場するもののみロード。
4. 独自 rehype プラグイン(1 パスで同時に処理):
   - `code.language-mermaid` → beautiful-mermaid の `renderMermaidSVG` で
     **その場で SVG に変換**(同期・DOM 不要)。色は焼き込まず CSS custom
     properties(bg/fg)参照で出力し、daisyUI theme の変数に
     追随させる(beautiful-mermaid の live theme switching 機構)。
   - heading(h1–h6)へ `data-idx` 付与(ページ内 1 起点。`idx=0` はページ先頭)。
5. hast root 直下の `<hr>`(mdast の thematicBreak = `---` 由来)で **hast
   を分割**して page 配列を作り、各ページを `rehype-stringify` で HTML 化。
   文字列 split をしないので、コードフェンス内の `---` を誤って
   ページ境界と扱う問題が構造的に起きない。

テスト: `renderSlides` は入力 markdown → `{pages, headings, title}` の
ユニットテストを最初に書く(フェンス内 `---`、frontmatter、heading なしページ、
mermaid / コードハイライトのスモーク)。

## 7. Action プロトコル(ワイヤ仕様)

```ts
type Action =
  | { type: "focus"; page: number; idx: number } // presenter のみ
  | { type: "reaction"; emoji: string } // 全員
  | { type: "join" } // 接続時に client が送る
  | { type: "post"; text: string; level: 0 } // audience 発
  | { type: "post"; text: string; level: number; post_id: string } // presenter/moderator が再配信(level >= 1)
  | { type: "vote"; post_id: string };

// relay が付与して配信する envelope
type Down =
  | {
    kind: "welcome";
    audience_id: string;
    role: Role;
    count: number;
    last_focus?: Action;
  }
  | { kind: "action"; action: Action; from: string; ts: number }
  | { kind: "count"; count: number } // 在室数(best-effort)
  | {
    kind: "error";
    code: "rate_limited" | "forbidden" | "invalid";
    detail?: string;
  };
```

- `text` は **50 文字以内**(graphemes)。超過は relay が `invalid` で拒否。
- `from` は relay が採番した `audience_id`(presenter は `"presenter"`、
  moderator は `"mod:<n>"`)。クライアントは vote の重複排除に使う。
- 検証は arktype の `ActionSchema` を relay 側で必ず通す。

## 8. Relay 設計(`server/relay/relay.ts`)

エンドポイント: `GET /api/talks/:talk_id/ws`(WebSocket upgrade)。 クエリ `?key=`
があれば presenter/moderator として認証、なければ audience。 実装は
[deno-pubsub](https://github.com/kuboon/deno-pubsub) の
`routes/api/topics/[topicId].ts` を下敷きにする (`Deno.upgradeWebSocket` +
`BroadcastChannel` + 直近値の KV 保存)。

**isolate 間配信**: トークごとに BroadcastChannel を 2 本使う。

- `talk:{talk_id}:stage` … 全員に配信するもの(focus / reaction / vote / level≥1
  の post / count)
- `talk:{talk_id}:mod` … **level-0 post 専用**。presenter / moderator の
  接続だけが購読する。→「audience の post は moderator を通ってから
  全員へ」の要件をチャンネル分離で実現する。

**メッセージフロー**

1. audience `post(level:0)` → relay が検証・rate limit → `mod` チャンネルへ。
   audience には配信されない。
2. presenter/moderator の PostViewer(ModeratorUi)に level-0 が溜まる。
   承認操作で `post(level:n, post_id: 新規採番)` を送信 → relay は
   ロールを確認して `stage` へ → 全員の PostViewer に載る。
3. `vote` は `stage` に流し、各クライアントが `(post_id, from)` で
   重複排除してローカル集計する(サーバは集計しない。真実は各画面の表示)。
4. `focus` は presenter ロールのみ `stage` へ。audience からは `forbidden`。
   同時に `lastFocus` repo へ保存(expireIn 24h)。**新規接続には welcome で
   `last_focus` を返す**ので、途中参加・再接続でも現在ページに追従できる
   (deno-pubsub の直近値 KV 保存パターン)。

**rate limit**(`rate_limit.ts`、isolate 内メモリの token bucket / 接続単位)

- post: 1 通 / 10 秒、reaction: 5 / 秒、vote: 1 / 秒。超過は `rate_limited`
  を返して破棄。isolate を跨ぐ厳密さは不要(スパム抑止が目的)。

**在室数**: isolate ごとの接続数を 10 秒周期で `stage` に gossip し、 各 isolate
が合算して `count` を配る(best-effort、TTL 30 秒で減算)。

**クロスオリジン**: セルフホスト(§14)から使えるよう、 WebSocket ハンドシェイクは
Origin を制限しない。REST API(§12)は CORS
を許可(`Access-Control-Allow-Origin: *`。認可はすべて capability key
で行うため、cookie を使わない = CSRF の懸念がない)。

**再接続**(`packages/zenpre/relay_client.ts`): 指数バックオフで自動再接続。
`new RelayClient({ server, talkId, key? })` の形で接続先 server URL を
設定可能にする(本体サイトでは同一 origin、セルフホストでは
`https://zenpre.deno.dev` を指定)。

## 9. フロントエンドコンポーネント(packages/zenpre/components/)

いずれも `@kuboon/zenpre` から提供する Web Component。
`import "@kuboon/zenpre/components.ts"` で custom element が register される。

### `<zen-slide-viewer>`(M1)

- 初期化: `viewer.load({ markdown, css, theme })`。内部で `renderSlides()` を
  呼び、Shadow DOM に横方向 scroll-snap のページ列を構築 (1 ページ = 100dvw ×
  100dvh、縦は各ページ内で overflow-y: auto)。
- 操作: 左右スワイプ / ←→キー / タップ左右端 でページ遷移。
- `viewer.apply(action)`:
  - `focus` → 該当ページへ snap 移動し `[data-idx]` へ scrollIntoView +
    一時ハイライト(outline アニメーション)。
  - `reaction` → 内包する `<zen-reaction-layer>` へ委譲。
- 発火イベント: `zen-navigate`(ユーザー自身のページ移動。presenter では
  Controller がこれを focus action に変換する)。
- **follow モード**: audience は既定で presenter の focus に追従。自分で
  スワイプしたら一時解除し、「追従に戻る」フローティングボタンを出す。
- スタイル: Shadow DOM に「tailwind+daisyUI のビルド済み CSS」
  「`data-theme={theme}`」「ユーザー css」の順で adoptedStyleSheets を適用。

### `<zen-reaction-layer>`(M2)

- 画面下部ランダム x 座標から絵文字がフワッと浮いて消える(CSS animation、 同時
  30 個で間引き)。
- WebAudio: 初回ユーザー操作で `AudioContext` を resume し、絵文字ごとに
  短い合成音(オシレータ)を鳴らす。ミュートトグルを viewer 右上に置く。

### `<zen-post-viewer>`(M3)

- `apply(action)` で post / vote を受けて `level 降順 → 票数降順` にソート表示。
- audience 向け: 50 文字入力フォーム + 送信、各 post に vote ボタン (自分の vote
  済みは disabled)。

### Controller(presenter ページ、M2〜M3)

- 上半分: SlideViewer(操作すると focus を pub)。
- 下半分タブ: 「Posts(ModeratorUi 兼用)」「Reactions テスト」「Recorder」。
- `talk_key` は URL fragment (`#key=...`) で受け取り localStorage に保存 (query
  に載せずサーバログに残さない)。

### `<zen-moderator-ui>`(M3)

- level-0 post のキュー表示。右スワイプ / `→` キーで level+1 して配信、
  左スワイプ / `←` で破棄。配信済み post の level は `↑↓` で再操作可。

## 10. Recorder & Player(M4)

- **Recorder**(presenter の Controller 内): 記録開始時刻を 0 として、 自分が pub
  した action と `stage` で受信した action を `{t, action}` で buffer。30 秒ごと
  & 終了時に `PUT /api/talks/:id/timeline`(presenter key 必須)で chunk 追記。
- **Player**(`/t/:talk_id/replay`): slide + timeline を fetch し、 `setTimeout`
  ベースのスケジューラで SlideViewer / PostViewer に
  `apply()`。再生/一時停止/シークバー(シークは t 以前の focus/post を
  リプレイして状態を再構築、reaction はスキップ)。 Recorder / Player とも
  `@kuboon/zenpre` の export。

## 11. Moderator の自動化

- **BlacklistModerator**(M3、`@kuboon/zenpre/moderators/blacklist.ts`):
  クライアント側モジュール。NG ワードリスト(talk 設定 or ローカル)に 非マッチの
  level-0 post を自動で level 1 に昇格して配信。 ModeratorUi
  と併用可(自動昇格を人が下げることもできる)。
- **ModeratorMcp**(M5): `/mcp` に `list_pending_posts(talk_id, moderator_key)` /
  `publish_post(talk_id, moderator_key, text, level)` ツールを追加し、 LLM
  がモデレーターとして参加できるようにする。level-0 post は relay 側で直近 100
  件をリングバッファに保持して MCP から取得可能にする。

## 12. Remote MCP と REST API(M5)

`server/mcp.ts` — `@modelcontextprotocol/sdk` の Streamable HTTP transport を
fetch-router のルート `/mcp` に接続。認可は tool 引数の key で行う(OAuth なし)。

| tool           | 引数                                           | 返り値                                                              |
| -------------- | ---------------------------------------------- | ------------------------------------------------------------------- |
| `upload_slide` | `markdown, css?, theme?`                       | `{ slide_id, slide_key, preview_url }`                              |
| `edit_slide`   | `slide_id, slide_key, markdown?, css?, theme?` | `{ ok, preview_url }`                                               |
| `create_talk`  | `slide_id?, slide_key?, begin_at, end_at?`     | `{ talk_id, talk_key, moderator_key, audience_url, presenter_url }` |

`create_talk` の `slide_id` は optional: セルフホスト(§14)では markdown を
自サイトから供給するため、**リレー機能だけのトーク**を作成できる。

REST API も同じ controller を共有する(MCP tool は薄い wrapper):

```
POST  /api/slides                      -> upload_slide 相当
PATCH /api/slides/:slide_id            -> edit_slide 相当(X-Slide-Key)
GET   /api/slides/:slide_id            -> {title, markdown, css, theme}(公開)
POST  /api/talks                      -> create_talk 相当(slide 紐付け時は X-Slide-Key)
GET   /api/talks/:talk_id            -> {slide_id, begin_at, end_at}(公開)
GET   /api/talks/:talk_id/ws         -> WebSocket upgrade
PUT   /api/talks/:talk_id/timeline   -> chunk 追記(X-Talk-Key)
GET   /api/talks/:talk_id/timeline   -> 全 chunk 結合(公開、end_at 後のみ)
```

全 API に CORS(`Access-Control-Allow-Origin: *`)を付ける(§8 参照)。

## 13. ページルーティング(本体サイト zenpre.deno.dev)

| path                         | 内容                                                        |
| ---------------------------- | ----------------------------------------------------------- |
| `/`                          | トップ: サービス説明 + slide_id/talk_id 入力 + MCP 接続手順 |
| `/s/:slide_id`               | スライド単体プレビュー(relay なし。作成直後の確認用)        |
| `/t/:talk_id`                | audience ビュー(SlideViewer + reaction 送信 + PostViewer)   |
| `/t/:talk_id/present#key=…`  | presenter Controller                                        |
| `/t/:talk_id/moderate#key=…` | ModeratorUi 単体                                            |
| `/t/:talk_id/replay`         | Player                                                      |

いずれのページも `@kuboon/zenpre` のコンポーネントを配置するだけの
薄い実装にする(セルフホストと同じコードパスを通す = dogfooding)。

## 14. セルフホスト(GitHub Pages)

ユーザが `@kuboon/zenpre` を組み込んだ静的サイト(GitHub Pages 等)を立ち上げ、
zenpre.deno.dev は **relay(と必要なら talk 管理)だけ**を提供する構成。

- `examples/gh-pages/` にテンプレートを置く。ビルド不要の 1 枚 HTML:

```html
<script type="module">
import "https://esm.sh/jsr/@kuboon/zenpre/components.ts";
const viewer = document.querySelector("zen-slide-viewer");
viewer.load({ markdown: await (await fetch("./slides.md")).text() });
viewer.connect({ server: "https://zenpre.deno.dev", talkId: "..." });
</script>
<zen-slide-viewer></zen-slide-viewer>
```

- markdown・css は自サイトに置く(server の KV には保存しない)。 talk は
  `create_talk`(slide_id なし)で発行し、relay のみ利用する。
- これを成立させる server 側要件は §8 / §12 で担保: Origin 制限なしの WS、CORS
  付き REST、slide なし talk。
- presenter ページも同テンプレートに含める(`#key=` を読んで Controller を出す)。

## 15. テスト・CI

- **unit**(packages/zenpre): `renderSlides`(分割・採番・shiki・mermaid)、 key
  生成/ハッシュ照合、rate limiter、arktype スキーマの受理/拒否表。
- **repo 層**: `@kuboon/kv/memory.ts` を注入してサーバ controller を KV
  実体なしでテスト。
- **relay 結合テスト**(tests/): `Deno.serve` を ephemeral port で立て、 実
  WebSocket を 3 本(presenter / audience×2)張って権限マトリクスを検証 (audience
  の focus が拒否される、level-0 が audience に届かない、 welcome で last_focus
  が返る、等)。
- **CI**(`.github/workflows/ci.yml`): `denoland/setup-deno@v2` →
  `deno task check` → `deno task test` → `deno task build`(bundler) →
  `deno publish --dry-run`(packages/zenpre)。
- **JSR publish**: tag push で `jsr publish`(GitHub Actions OIDC)。
- E2E(Playwright での swipe/描画確認)は M3 以降に smoke のみ追加。

## 16. マイルストーン

各マイルストーンは独立に main へマージ可能な単位。完了条件(DoD)を満たすこと。

- **M0 — 作り直しスキャフォールド** 既存 `lume/` `server/` `schemas.ts`
  `types.ts` を削除し、§3 の workspace を deno-remix-reference
  準拠で構築(packages/zenpre は空殻 + publish dry-run)。 CI・SessionStart
  hook・Deploy 設定。 _DoD: `deno task check` / `deno task test` /
  `deno publish --dry-run` green、 トップページが Deploy で 200。_
- **M1 — render.ts + SlideViewer + Slide API** schemas / keys /
  `render.ts`(unified + shiki + beautiful-mermaid)、
  `<zen-slide-viewer>`(採番・swipe/scroll・daisyUI theme)、 @kuboon/kv ベースの
  repo 層と slides API、`/s/:slide_id`。 _DoD: curl で入稿した markdown が
  `/s/:id` でスライド表示され、 renderSlides の unit test が通る。_
- **M2 — Talk + Relay + focus/reaction/join** talks API、relay(ロール認証・stage
  チャンネル・last_focus・rate limit・ count・CORS)、audience ページ、Controller
  v1(ページ送り = focus 配信)、 reaction layer。**`@kuboon/zenpre` 0.1.0 を JSR
  に初回リリース**。 _DoD: 2 ブラウザ間で focus 追従と reaction が動く。relay
  結合テスト green。_
- **M3 — post / vote / moderation** mod
  チャンネル、PostViewer、ModeratorUi、BlacklistModerator、vote 集計。 _DoD:
  audience の post が moderator 承認後にのみ全員へ届き、vote 順でソートされる。_
- **M4 — Recorder & Player** timeline chunk 保存
  API、Recorder、`/t/:id/replay`。 _DoD: 記録したプレゼンが replay
  でページ送り・post 含めて再現される。_
- **M5 — Remote MCP + ModeratorMcp** `/mcp`(upload_slide / edit_slide /
  create_talk / moderator tools)。 _DoD: Claude 等の MCP クライアントから slide
  作成 → talk 作成 → URL 取得が通る。_
- **M6 — セルフホスト example + 仕上げ** `examples/gh-pages/`(slide_id なし
  talk + esm.sh import で動くことを実証)、 WebAudio
  の音種追加、PWA(a2hs)、パフォーマンス。 _DoD: example をそのまま GitHub Pages
  に置いて zenpre.deno.dev の relay だけでプレゼンが成立する。_

## 17. 主要な設計判断の理由(要旨)

- **フロント機能を JSR パッケージに集約**: 本体サイト自身も `@kuboon/zenpre`
  の利用者として書くことで、セルフホストと本体のコードパスが常に一致し、
  パッケージの API が dogfooding で検証される。
- **render.ts を isomorphic に**: beautiful-mermaid が DOM 不要・同期、 shiki が
  rehype プラグインで提供されるため、ブラウザ/サーバ/静的ビルドの
  どこでも同一結果。プレビュー = 本番描画。
- **unified 1 パイプライン + hast 分割**: parse 1 回・変換 1 回に抑え、
  ページ分割は最終 hast の root 直下 `<hr>` で行う。文字列 split を避ける
  ことでコードフェンス内 `---` の誤分割が構造的に起きない。
- **KvRepo 抽象(@kuboon/kv)**: controller/relay を `KvRepo` 型に対して
  書き、テストは memory、本番は Deno KV。将来 Turso 等への移行余地も残る。
- **BroadcastChannel を 2 本に分離**: 「level-0 は配信されない」「moderator を
  通ってから全員へ」という要件を、購読権限の分離という最も単純な形で満たす。
- **直近 focus の KV 保存(deno-pubsub パターン)**: 途中参加者・再接続者が
  welcome だけで現在ページに同期でき、presenter の定期再送が不要。
- **vote はクライアント集計**: サーバ集計は isolate 間で整合を取るコストが
  高い。プレゼンの UX 上は best-effort で十分。
- **key はハッシュ保存 + 一度だけ返す**: KV 流出時にも presenter 権限を
  奪えない。アカウントレスの capability モデルと整合。cookie 不使用なので CORS
  全開放でも CSRF リスクがない。
