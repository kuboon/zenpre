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
  同じイベントを見ている全ブラウザにリアルタイム反映される。
- presenter の操作を timeline として記録し、後から再生できる。
- LLM から remote MCP でスライド作成・イベント作成ができる。

**非ゴール(v1 では作らない)**

- ユーザーアカウント・ログイン(すべて capability key 方式で認可する)
- スライドの WYSIWYG エディタ(markdown は MCP または API で入稿)
- 動画配信(音声・映像は扱わない。画面同期のみ)

## 2. 技術スタック

| 領域               | 採用                                                               | 備考                                                                                                                                                         |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ランタイム         | Deno(package.json なし、`deno.json` のみ)                          | Deno Deploy にデプロイ                                                                                                                                       |
| Web フレームワーク | Remix v3 (`@remix-run/fetch-router` + `@remix-run/ui`)             | [deno-remix-reference](https://github.com/kuboon/deno-remix-reference/tree/main/reference) の構成・バージョンピンをそのまま踏襲                              |
| 永続化             | Deno KV                                                            | slide / event / timeline                                                                                                                                     |
| リアルタイム       | WebSocket + `BroadcastChannel`                                     | [deno-pubsub](https://github.com/kuboon/deno-pubsub/blob/main/routes/api/topics/%5BtopicId%5D.ts) 方式。BroadcastChannel で Deploy の isolate 間を跨いで配信 |
| スキーマ検証       | arktype                                                            | Action・API 入出力を単一定義から共有                                                                                                                         |
| CSS                | Tailwind CSS v4 + daisyUI v5                                       | daisyUI theme をスライドテーマとして使う(PLAN 要件)                                                                                                          |
| markdown           | micromark or markdown-it(`npm:`)                                   | `---` 分割は独自前処理                                                                                                                                       |
| コードハイライト   | shiki                                                              | 言語は遅延ロード                                                                                                                                             |
| 図                 | [beautiful-mermaid](https://github.com/lukilabs/beautiful-mermaid) | mermaid ブロックがあるページのみ遅延ロード                                                                                                                   |
| MCP                | `npm:@modelcontextprotocol/sdk`                                    | Streamable HTTP を `/mcp` にマウント                                                                                                                         |

**Deno Deploy 注意点**

- エントリポイントは `server/main.ts` で `Deno.serve(router.fetch)` を呼ぶ
  (ローカルは `deno serve -P ./server/router.ts` でも起動できるよう router は
  default export しておく)。
- WebSocket / BroadcastChannel / KV はいずれも Deploy でネイティブサポート。
- 静的アセット(client bundle, CSS)はビルド成果物 `bundled/` を
  `@remix-run/static-middleware` で配信する。

## 3. リポジトリ構成(Deno workspace)

```
deno.json                 # workspace ルート: members, tasks, unstable: [bundle, kv]
packages/
  core/                   # 環境非依存の共有コード(server/client 双方から import)
    schemas.ts            # arktype: Slide, Event, Action, ワイヤ envelope
    md/
      split.ts            # '---' 分割・page/heading 採番(pure, テスト対象)
      render.ts           # page markdown -> HTML(shiki/mermaid はフック注入)
    keys.ts               # id/key 生成・ハッシュ化(WebCrypto のみ使用)
server/
  main.ts                 # Deno Deploy エントリ
  router.ts / routes.ts   # Remix v3 fetch-router
  controllers/            # ページ SSR + API ハンドラ
  relay/
    relay.ts              # WebSocket ハブ(このファイルにロジック集約)
    rate_limit.ts         # token bucket
  repo/
    kv.ts                 # KV 接続
    slides.ts events.ts timelines.ts
  mcp.ts                  # MCP サーバ定義(/mcp)
client/
  components/
    slide_viewer.ts       # <zen-slide-viewer> Web Component
    post_viewer.ts        # <zen-post-viewer>
    reaction_layer.ts     # <zen-reaction-layer>(絵文字アニメ + WebAudio)
    controller.ts         # presenter UI
    moderator_ui.ts       # <zen-moderator-ui>
  relay_client.ts         # WS 再接続・envelope 型付け
  recorder.ts player.ts
  pages/                  # 各ページの hydration エントリ
bundler/                  # Deno.bundle + tailwindcss ビルド -> bundled/
tests/                    # 結合テスト(relay を実ソケットで叩く)
```

方針:

- **ドメインロジックは packages/core に寄せる**。`---` 分割・採番・権限判定・
  key 生成はすべて pure function にして `Deno.test` で固める。
- viewer 類は **フレームワーク非依存の Web Component**。audience ページ・
  presenter ページ・player・(将来)埋め込みで同一実装を使い回す。
- ファイル名は snake_case、TypeScript strict、テストは `@std/assert`。

## 4. データモデルと KV スキーマ

```ts
// packages/core/schemas.ts(arktype 定義から型を導出する)
type Slide = {
  slide_id: string; // 公開 ID(URL に載る)
  title: string; // markdown 先頭 h1 から自動抽出、なければ "Untitled"
  markdown: string; // 原文のまま保存(パースはクライアント)
  css: string; // 追加 CSS。daisyui theme 名は css 内 `/* theme: dark */` ではなく theme フィールドに分離
  theme: string; // daisyUI theme 名(default: "light")
  created_at: string;
  updated_at: string; // ISO8601
};

type ZenEvent = {
  event_id: string;
  slide_id: string;
  begin_at: string; // ISO8601
  end_at: string | null;
  created_at: string;
};

type TimelineEntry = { t: number /* begin からの経過 ms */; action: Action };
```

KV キー設計(値は上記レコード。key 認証情報は本体と分離して保存):

| key                                    | value                                | 備考                                                                             |
| -------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------- |
| `["slides", slide_id]`                 | `Slide`                              | markdown は 64KiB 制限に注意 → 超過時は 400 を返す(v1 は分割保存しない)          |
| `["slide_keys", slide_id]`             | `{ key_hash: string }`               | SHA-256(slide_key)                                                               |
| `["events", event_id]`                 | `ZenEvent`                           |                                                                                  |
| `["event_keys", event_id]`             | `{ presenter_hash, moderator_hash }` | moderator_key は常に発行(使うかは任意)                                           |
| `["slide_events", slide_id, event_id]` | `true`                               | slide からの逆引き                                                               |
| `["timelines", event_id, seq]`         | `TimelineEntry[]`(~500 件/chunk)     | reaction を含むと 64KiB を超え得るため chunk 分割。`list({ prefix })` で全件復元 |

**ID / key 生成**(`packages/core/keys.ts`)

- `slide_id` / `event_id` / `post_id`: `crypto.getRandomValues` → base58 8
  文字(公開・URL 用)
- `slide_key` / `event_key`(presenter)/ `moderator_key`: base58 26 文字(≈152bit)
- KV には **SHA-256 ハッシュのみ保存**。照合は `timingSafeEqual` 相当の比較。
- key はレスポンスで一度だけ返す。紛失時の再発行は v1 では非対応。

## 5. 権限モデル

すべて capability key。ロールは接続時に決まる:

| ロール    | 認証                                         | できること                                                                                             |
| --------- | -------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| presenter | `event_key`                                  | focus の pub、level-0 post の受信、post の level 昇格 + `post_id` 発行、reaction/vote、timeline の保存 |
| moderator | `moderator_key`                              | level-0 post の受信、post の level 昇格 + `post_id` 発行(複数接続可)                                   |
| audience  | 不要(接続時に relay が `audience_id` を採番) | join / reaction / post(level 0 のみ)/ vote                                                             |

## 6. markdown → スライド変換パイプライン

パースは **クライアント側**(SlideViewer 内)で行う。サーバは markdown を
そのまま保存・配信するだけにして、プレビューと本番の描画差異をなくす。

1. **ページ分割**(`core/md/split.ts`): トップレベルの thematic break (`---`
   単独行)で分割し、**page は 1 から採番**。
   - コードフェンス内の `---`
     は分割しない(フェンス深度を追跡する行スキャナで実装)。
   - 先頭が YAML frontmatter の場合は無視して本文から開始。
2. **heading 採番**: 各ページ内で h1〜h6 を出現順に **idx = 1 から採番**。
   `idx = 0` はページ先頭を意味する。レンダリング時に
   `data-page="3" data-idx="2"` を heading 要素へ付与。
3. **レンダリング**: micromark で HTML 化。
   - `` ```mermaid `` ブロック → プレースホルダ `<div data-mermaid>` を出力し、
     ページ表示時に beautiful-mermaid を動的 import して描画。
   - その他のコードブロック → shiki(`createHighlighter` を遅延生成、
     言語もオンデマンドロード)。ハイライト完了前はプレーン `<pre>` を表示。
4. **テーマ**: Shadow DOM 内に「tailwind+daisyUI のビルド済み CSS」
   「`data-theme={slide.theme}`」「`slide.css`」の順で adoptedStyleSheets
   を適用。

テスト: split/採番は入力 markdown → `{pages, headings}` のスナップショット的
ユニットテストを最初に書く(フェンス内 `---`、frontmatter、heading
なしページ等)。

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
  | { kind: "welcome"; audience_id: string; role: Role; count: number }
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

エンドポイント: `GET /api/events/:event_id/ws`(WebSocket upgrade)。 クエリ
`?key=` があれば presenter/moderator として認証、なければ audience。

**isolate 間配信**: イベントごとに BroadcastChannel を 2 本使う。

- `evt:{event_id}:stage` … 全員に配信するもの(focus / reaction / vote / level≥1
  の post / count)
- `evt:{event_id}:mod` … **level-0 post 専用**。presenter / moderator の
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

**rate limit**(`rate_limit.ts`、isolate 内メモリの token bucket / 接続単位)

- post: 1 通 / 10 秒、reaction: 5 / 秒、vote: 1 / 秒。超過は `rate_limited`
  を返して破棄。isolate を跨ぐ厳密さは不要(スパム抑止が目的)。

**在室数**: isolate ごとの接続数を 10 秒周期で `stage` に gossip し、 各 isolate
が合算して `count` を配る(best-effort、TTL 30 秒で減算)。

**再接続**(`client/relay_client.ts`): 指数バックオフで自動再接続し、 再接続時に
`join` を送り直す。relay は状態を持たない(直近 focus の 追従はプレゼン進行中の
presenter が定期 re-broadcast することで解決: 30 秒ごと、または新規 join
を見たときに現在の focus を再送)。

## 9. フロントエンドコンポーネント

### `<zen-slide-viewer>`(M1)

- 初期化: `viewer.load({ markdown, css, theme })`。Shadow DOM に 横方向
  scroll-snap のページ列を構築(1 ページ = 100dvw × 100dvh、 縦は各ページ内で
  overflow-y: auto)。
- 操作: 左右スワイプ / ←→キー / タップ左右端 でページ遷移。
- `viewer.apply(action)`:
  - `focus` → 該当ページへ snap 移動し `[data-idx]` へ scrollIntoView +
    一時ハイライト(outline アニメーション)。
  - `reaction` → 内包する `<zen-reaction-layer>` へ委譲。
- 発火イベント: `zen-navigate`(ユーザー自身のページ移動。presenter では
  Controller がこれを focus action に変換する)。
- **follow モード**: audience は既定で presenter の focus に追従。自分で
  スワイプしたら一時解除し、「追従に戻る」フローティングボタンを出す。

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
- `event_key` は URL fragment (`#key=...`) で受け取り localStorage に保存 (query
  に載せずサーバログに残さない)。

### `<zen-moderator-ui>`(M3)

- level-0 post のキュー表示。右スワイプ / `→` キーで level+1 して配信、
  左スワイプ / `←` で破棄。配信済み post の level は `↑↓` で再操作可。

## 10. Recorder & Player(M4)

- **Recorder**(presenter の Controller 内): 記録開始時刻を 0 として、 自分が pub
  した action と `stage` で受信した action を `{t, action}` で buffer。30 秒ごと
  & 終了時に `PUT /api/events/:id/timeline`(presenter key 必須)で chunk 追記。
- **Player**(`/e/:event_id/replay`): slide + timeline を fetch し、 `setTimeout`
  ベースのスケジューラで SlideViewer / PostViewer に
  `apply()`。再生/一時停止/シークバー(シークは t 以前の focus/post を
  リプレイして状態を再構築、reaction はスキップ)。

## 11. Moderator の自動化

- **BlacklistModerator**(M3): クライアント側モジュール。NG ワードリスト (event
  設定 or ローカル)に非マッチの level-0 post を自動で level 1 に
  昇格して配信。ModeratorUi と併用可(自動昇格を人が下げることもできる)。
- **ModeratorMcp**(M5): `/mcp` に `list_pending_posts(event_id, moderator_key)`
  / `publish_post(event_id, moderator_key, text, level)` ツールを追加し、 LLM
  がモデレーターとして参加できるようにする。level-0 post は relay 側で直近 100
  件をリングバッファに保持して MCP から取得可能にする。

## 12. Remote MCP(M5)

`server/mcp.ts` — `@modelcontextprotocol/sdk` の Streamable HTTP transport を
fetch-router のルート `/mcp` に接続。認可は tool 引数の key で行う(OAuth なし)。

| tool           | 引数                                           | 返り値                                                                |
| -------------- | ---------------------------------------------- | --------------------------------------------------------------------- |
| `upload_slide` | `markdown, css?, theme?`                       | `{ slide_id, slide_key, preview_url }`                                |
| `edit_slide`   | `slide_id, slide_key, markdown?, css?, theme?` | `{ ok, preview_url }`                                                 |
| `create_event` | `slide_id, slide_key, begin_at, end_at?`       | `{ event_id, event_key, moderator_key, audience_url, presenter_url }` |

REST API も同じ controller を共有する(MCP tool は薄い wrapper):

```
POST  /api/slides                      -> upload_slide 相当
PATCH /api/slides/:slide_id            -> edit_slide 相当(X-Slide-Key)
GET   /api/slides/:slide_id            -> {title, markdown, css, theme}(公開)
POST  /api/events                      -> create_event 相当(X-Slide-Key)
GET   /api/events/:event_id            -> {slide_id, begin_at, end_at}(公開)
GET   /api/events/:event_id/ws         -> WebSocket upgrade
PUT   /api/events/:event_id/timeline   -> chunk 追記(X-Event-Key)
GET   /api/events/:event_id/timeline   -> 全 chunk 結合(公開、end_at 後のみ)
```

## 13. ページルーティング

| path                          | 内容                                                         |
| ----------------------------- | ------------------------------------------------------------ |
| `/`                           | トップ: サービス説明 + slide_id/event_id 入力 + MCP 接続手順 |
| `/s/:slide_id`                | スライド単体プレビュー(relay なし。作成直後の確認用)         |
| `/e/:event_id`                | audience ビュー(SlideViewer + reaction 送信 + PostViewer)    |
| `/e/:event_id/present#key=…`  | presenter Controller                                         |
| `/e/:event_id/moderate#key=…` | ModeratorUi 単体                                             |
| `/e/:event_id/replay`         | Player                                                       |

## 14. テスト・CI

- **unit**(packages/core): md 分割・採番、key 生成/ハッシュ照合、 rate
  limiter、arktype スキーマの受理/拒否表。
- **relay 結合テスト**(tests/): `Deno.serve` を ephemeral port で立て、 実
  WebSocket を 3 本(presenter / audience×2)張って権限マトリクスを検証 (audience
  の focus が拒否される、level-0 が audience に届かない、等)。
- **CI**(`.github/workflows/ci.yml`): `denoland/setup-deno@v2` →
  `deno task check` → `deno task test` → `deno task build`(bundler)。
- E2E(Playwright での swipe/描画確認)は M3 以降に smoke のみ追加。

## 15. マイルストーン

各マイルストーンは独立に main へマージ可能な単位。完了条件(DoD)を満たすこと。

- **M0 — 作り直しスキャフォールド** 既存 `lume/` `server/` `schemas.ts`
  `types.ts` を削除し、§3 の workspace を deno-remix-reference
  準拠で構築。CI・SessionStart hook・Deploy 設定。 _DoD: `deno task check` /
  `deno task test` green、トップページが Deploy で 200。_
- **M1 — Slide ドメイン + SlideViewer** schemas / keys / KV repo / slides
  API、md パイプライン、`<zen-slide-viewer>`
  (分割・採番・swipe/scroll・shiki・mermaid・daisyUI theme)、`/s/:slide_id`。
  _DoD: curl で入稿した markdown が `/s/:id` でスライド表示され、md 系 unit test
  が通る。_
- **M2 — Event + Relay + focus/reaction/join** events
  API、relay(ロール認証・stage チャンネル・rate limit・count)、 audience
  ページ、Controller v1(ページ送り = focus 配信)、reaction layer。 _DoD: 2
  ブラウザ間で focus 追従と reaction が動く。relay 結合テスト green。_
- **M3 — post / vote / moderation** mod
  チャンネル、PostViewer、ModeratorUi、BlacklistModerator、vote 集計。 _DoD:
  audience の post が moderator 承認後にのみ全員へ届き、vote 順でソートされる。_
- **M4 — Recorder & Player** timeline chunk 保存
  API、Recorder、`/e/:id/replay`。 _DoD: 記録したプレゼンが replay
  でページ送り・post 含めて再現される。_
- **M5 — Remote MCP + ModeratorMcp** `/mcp`(upload_slide / edit_slide /
  create_event / moderator tools)。 _DoD: Claude 等の MCP クライアントから slide
  作成 → event 作成 → URL 取得が通る。_
- **M6 — 仕上げ(任意)** WebAudio の音種追加、focus
  再送の調整、PWA(a2hs)、パフォーマンス。

## 16. 主要な設計判断の理由(要旨)

- **markdown をクライアントでパース**: サーバ保存は原文のみ。プレビュー =
  本番描画、サーバは静的配信 + relay に徹してスケールと単純さを取る。
- **BroadcastChannel を 2 本に分離**: 「level-0 は配信されない」「moderator を
  通ってから全員へ」という要件を、購読権限の分離という最も単純な形で満たす。
- **vote はクライアント集計**: サーバ集計は isolate 間で整合を取るコストが
  高い。プレゼンの UX 上は best-effort で十分。
- **key はハッシュ保存 + 一度だけ返す**: KV 流出時にも presenter 権限を
  奪えない。アカウントレスの capability モデルと整合。
