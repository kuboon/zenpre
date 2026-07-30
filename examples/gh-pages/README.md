# ZenPre セルフホスト例(GitHub Pages)

`@kuboon/zenpre` を組み込んだ **ビルド不要の静的サイト**。スライド本文
(`slides.md`)は自分のサイトに置き、**リアルタイム同期だけ**を
`zenpre.deno.dev` の relay に借りる構成です(PLAN §14)。

```
examples/gh-pages/
├── index.html      客席(audience): focus 追従 + reaction + 質問
├── present.html    発表者(presenter): ページ送り = focus 配信 + 承認
├── slides.md       スライド本文(ここを書き換える)
├── config.js       server / talkId / theme(ここを書き換える)
├── manifest.webmanifest / icon.svg / sw.js   PWA(ホーム画面に追加)
└── README.md
```

## 仕組み

- `@kuboon/zenpre/components.ts` を esm.sh 経由で読み込み、Web Component
  (`<zen-slide-viewer>` など)を登録する。
- `viewer.load({ markdown })` が `renderSlides()` を動的 import して描画。
- `viewer.connect({ server, talkId })` が relay に WebSocket 接続し、presenter の
  focus 追従・reaction 表示・post 集計まで面倒を見る。
- Tailwind+daisyUI のビルド済み CSS は relay 本体サイト(`/style.css`)から借りる。

markdown・CSS は自サイトに置き、サーバの KV には保存しません。relay 専用の
トーク(`slide_id` なし)を使うので、本体サイトはスライド内容を一切持ちません。

## 使い方

### 1. relay 専用トークを作る

`slide_id` なしのトークを 1 つ作成し、`talk_id` と鍵を控えます。

```sh
curl -X POST https://zenpre.deno.dev/api/talks \
  -H 'content-type: application/json' -d '{}'
# => { "talk_id": "...", "event_key": "...", "moderator_key": "...",
#      "audience_url": "...", "presenter_url": "...", "moderator_url": "..." }
```

MCP クライアント(Claude 等)からなら `create_talk` ツールでも同じものが得られます。

### 2. 設定を書き換える

`config.js` の `talkId` を上で得た `talk_id` に変更します(必要なら `server` も)。
`slides.md` を自分のスライドに差し替えます。

### 3. GitHub Pages に公開する

このディレクトリの中身をリポジトリの Pages 対象(例: `docs/` や `gh-pages`
ブランチ)に置くだけです。ビルド手順はありません。

- 客席: `https://<you>.github.io/<repo>/`(= `index.html`)
- 発表者: `https://<you>.github.io/<repo>/present.html#key=<event_key>`
  - `#key=` はフラグメントなのでサーバには送られません。初回に localStorage へ
    退避して URL からは消えます。
- モデレーター(任意): 発表者ページ相当に `moderator_key` を使って接続すれば、
  未承認 post のキュー(`<zen-moderator-ui>`)から承認できます。

## メモ

- relay の WebSocket は Origin 制限なし、REST は CORS 全開放なので、任意の
  オリジンから利用できます(認可はすべて capability key)。
- `@kuboon/zenpre` が JSR に公開されるとバージョン付き URL
  (`esm.sh/jsr/@kuboon/zenpre@x.y.z`)が解決されます。import map の
  バージョンを合わせてください。
