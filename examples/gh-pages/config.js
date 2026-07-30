/**
 * このデモの設定。自分のトークに合わせて書き換える。
 *
 * talkId は relay 専用トーク(slide 紐付けなし)を 1 つ作って得る:
 *   curl -X POST https://zenpre.deno.dev/api/talks -d '{}'
 * 返ってくる talk_id / event_key(presenter)/ moderator_key を控える。
 * 詳しくは README.md 参照。
 */
globalThis.ZENPRE = {
  /** relay を提供する ZenPre サーバ(本体サイト)。 */
  server: "https://zenpre.deno.dev",
  /** 上で作った talk_id に置き換える。 */
  talkId: "REPLACE_WITH_TALK_ID",
  /** スライドの daisyUI テーマ。 */
  theme: "synthwave",
};
