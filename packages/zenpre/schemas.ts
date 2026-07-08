/**
 * ZenPre の主要データ構造。arktype 定義を唯一のソースとして、
 * server(API / relay)と client(components / relay_client)の両方が
 * ここから型とバリデータを import する。
 *
 * @module
 */
import { type } from "arktype";

/** ISO 8601 のタイムスタンプ文字列。 */
export const IsoDate = type("string.date.iso");

// ---------------------------------------------------------------------------
// 永続データ(Deno KV に保存されるレコード)
// ---------------------------------------------------------------------------

/**
 * スライド本体。markdown は原文のまま保存し、レンダリングは
 * `@kuboon/zenpre/render.ts`(クライアント/サーバ共通)で行う。
 */
export const SlideSchema = type({
  /** 公開 ID(URL に載る)。base58 8 文字。 */
  slide_id: "string",
  /** markdown 先頭 h1 から自動抽出。なければ "Untitled"。 */
  title: "string",
  markdown: "string",
  /** 追加 CSS。 */
  css: "string",
  /** daisyUI theme 名(default: "light")。 */
  theme: "string",
  created_at: IsoDate,
  updated_at: IsoDate,
});
export type Slide = typeof SlideSchema.infer;

/**
 * プレゼンイベント。`slide_id: null` は「リレー機能だけのイベント」
 * (セルフホスト構成で markdown を自サイトから供給する場合)。
 */
export const ZenEventSchema = type({
  event_id: "string",
  slide_id: "string | null",
  begin_at: IsoDate,
  end_at: IsoDate.or("null"),
  created_at: IsoDate,
});
export type ZenEvent = typeof ZenEventSchema.infer;

// ---------------------------------------------------------------------------
// Action(リアルタイムに relay を流れる操作)
// ---------------------------------------------------------------------------

/** presenter による「今ここを見て」。idx=0 はページ先頭、1 以降は heading。 */
export const FocusAction = type({
  type: "'focus'",
  /** ページ番号(1 起点)。 */
  page: "number.integer >= 1",
  /** ページ内 heading 番号(0 = ページ先頭)。 */
  idx: "number.integer >= 0",
});

/** 画面上にフワッと浮かぶ絵文字リアクション。 */
export const ReactionAction = type({
  type: "'reaction'",
  emoji: "string <= 16",
});

/** 接続直後に client が送る参加通知。 */
export const JoinAction = type({ type: "'join'" });

/**
 * audience 発の post。level は常に 0 で、moderator / presenter にのみ
 * 届く(全体には配信されない)。
 */
export const AudiencePostAction = type({
  type: "'post'",
  /**
   * 上限は {@link POST_TEXT_MAX_GRAPHEMES}(50 grapheme)を relay が enforce。
   * スキーマ上は絵文字等の多バイト grapheme を考慮して code unit 200 まで許容。
   */
  text: "string <= 200",
  level: "0",
});

/**
 * presenter / moderator が level を上げて再配信する post。
 * このとき vote 用の post_id が発行される。
 */
export const ModeratedPostAction = type({
  type: "'post'",
  text: "string <= 200",
  level: "number.integer >= 1",
  post_id: "string",
});

/** post_id 付きの post への投票。 */
export const VoteAction = type({
  type: "'vote'",
  post_id: "string",
});

export const ActionSchema = FocusAction
  .or(ReactionAction)
  .or(JoinAction)
  .or(AudiencePostAction)
  .or(ModeratedPostAction)
  .or(VoteAction);
export type Action = typeof ActionSchema.infer;

/** post 本文の上限(grapheme 数)。relay が enforce する。 */
export const POST_TEXT_MAX_GRAPHEMES = 50;

// ---------------------------------------------------------------------------
// Relay ワイヤ仕様(WebSocket)
// ---------------------------------------------------------------------------

/** 接続時に確定するロール。 */
export const RoleSchema = type("'presenter' | 'moderator' | 'audience'");
export type Role = typeof RoleSchema.infer;

/** client → relay。Action をそのまま送る。 */
export const UpSchema = ActionSchema;
export type Up = typeof UpSchema.infer;

/** relay → client の envelope。 */
export const DownSchema = type({
  kind: "'welcome'",
  /** relay が採番した自分の ID。 */
  audience_id: "string",
  role: RoleSchema,
  /** 在室数(best-effort)。 */
  count: "number.integer >= 0",
  /** 直近の focus(deno-pubsub パターンで KV 保存されたもの)。 */
  "last_focus?": FocusAction,
}).or({
  kind: "'action'",
  action: ActionSchema,
  /** 送信者(audience_id / "presenter" / "mod:<n>")。vote の重複排除に使う。 */
  from: "string",
  /** relay が付与した epoch ms。 */
  ts: "number",
}).or({
  kind: "'count'",
  count: "number.integer >= 0",
}).or({
  kind: "'error'",
  code: "'rate_limited' | 'forbidden' | 'invalid'",
  "detail?": "string",
});
export type Down = typeof DownSchema.infer;

// ---------------------------------------------------------------------------
// Timeline(Recorder が保存し Player が再生する)
// ---------------------------------------------------------------------------

/** begin からの経過 ms とともに記録された Action。 */
export const TimelineEntrySchema = type({
  /** 経過ミリ秒(>= 0)。 */
  t: "number >= 0",
  action: ActionSchema,
});
export type TimelineEntry = typeof TimelineEntrySchema.infer;
