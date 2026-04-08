# ZenPre

'---' 区切りの markdown をそのままプレゼンにするAI時代のプレゼンツール
スマホフル画面の縦長表示ネイティブ 左右でページ遷移、上下はスクロール

## Architecture

deno deno deploy deno kv

## データ

- [x] slide
  - [x] markdown
    - [x] --- で区切って1pageから採番
    - [x] 各ページ内は heading ごとに idx を採番
    - [x] https://github.com/lukilabs/beautiful-mermaid に対応
    - [x] shiki code hilghter 対応
    - [ ] in slide actions 後述
  - [x] css
    - [x] daisyui theme対応
- [x] event
  - [x] start_at (begin_at)
  - [x] end_at
  - [ ] presenter key
  - [ ] moderator key (optional)
  - [x] slide_id
  - [ ] timeline
    - [ ] 開始何秒後にどのアクションを発生させるかを列挙したarray

## Actions

- [x] focus(page, idx)
- [x] reaction(emoji)
  - [x] 画面上にランダムにフワッと出て消える
  - [ ] webaudio で音も出す
- [ ] join
- [ ] post(string)
  - [ ] 50文字以内
  - [ ] PostViewer の list に溜まる
  - [ ] audience からの post は level 0, id なしで送られる
  - [ ] presenter は level を上げて id を付与して再配信する
- [ ] vote(id)
  - [ ] idのついた post に投票出来る

# components

### [x] SlideViewer

markdown で初期化 json で action を受け取って実行

- focus と reaction のみ担当

### [ ] PostViewer

post と vote のみ対応

### [ ] Controller

action をリアルタイムに生成するUI

## [x] Relay

同じプレゼンを見てるブラウザ全てに action をリアルタイムブロードキャスト 参考:
https://github.com/kuboon/deno-pubsub/blob/main/routes/api/topics/%5BtopicId%5D.ts

- 権限
  - [ ] presenter
    - [ ] event_key で認証
    - [ ] focus を pub 出来る
    - [ ] post level 0 を受け取れる
    - [ ] post level を上げて配信出来る
      - [ ] この時、 vote のためのidも発行する
  - [ ] audience
    - [ ] 接続時に audience_id をリレー内で付与し、pub に付与する
    - [ ] post は level 0 のみ pub 可能
    - [ ] level 0 の post は配信されない
    - [ ] 秒あたりの pub を制限し、spamming を抑止する

### [ ] Moderator

audience からの post は moderator だけがまず受け取り、 Moderator
を通してから全員へブロードキャストされる ask.level を操作する PostViewer
はlevel + poll で大きい順にソートして表示する 自動化してもいいし UI も提供する
複数接続可能

- [ ] BlacklistModerator
  - シンプルな自動モデレーター
- [ ] ModeratorMcp
- [ ] PostViewer ModeratorUi
  - swipe、キーボード操作で level を操作出来る

### [ ] Recorder & Player

- [ ] Recorder
  - [ ] presenter の端末上で動作する
  - [ ] Action を経過時間とともに記録する
- [ ] Player
  - [ ] 記録済みの timeline を再生して SlideViewer & PostViewer を自動操作

## [ ] remote mcp support

- [x] upload_slide(markdown, css)
  - [x] slide_id, slide_key が返される
- [ ] edit_slide
- [x] create_event(slide_id, datetime)
  - [x] event_id, event_key が返される
