/**
 * 自動再生 timeline を URL に載せる短い文字列(play code)にする。
 *
 * `/s/:slide_id?play=<code>` で使う。サーバに保存せず URL だけで完結するので、
 * 録画は何本でも作れて、スライドの編集鍵も要らない。`?` のクエリにするのは、
 * X のクローラーやサーバに届かない `#` だとカード内で自動再生できないため。
 *
 * 形式: `"1"`(版)+ base64url(バイト列)。バイト列はエントリごとに
 *
 * ```
 * varint(前のエントリからの経過 / 10ms)  varint(tag)  ...
 *   tag 0              focus     → varint(page) varint(idx)
 *   tag 1..N           reaction  → PLAY_CODE_EMOJIS[tag - 1]
 *   tag 255            reaction  → varint(byte 長) UTF-8(emoji)
 * ```
 *
 * 30 イベント程度の録画で 100〜150 文字ほどになる。
 *
 * @module
 */
import type { Action, TimelineEntry } from "./schemas.ts";

/** play code の版(先頭 1 文字)。形式を変えるときに上げる。 */
const VERSION = "1";

/**
 * 1 バイトで表すリアクション絵文字。**並びは URL の互換性に関わるので、
 * 末尾への追加しかしてはいけない。**
 */
export const PLAY_CODE_EMOJIS: readonly string[] = [
  "👏",
  "❤️",
  "🎉",
  "😂",
  "🤔",
  "✨",
  "⚡",
  "🔥",
  "👍",
  "🙏",
  "😮",
  "💡",
];

const TAG_FOCUS = 0;
const TAG_EMOJI_RAW = 255;
/** 時刻の分解能(ms)。 */
const TICK_MS = 10;

/** play code にできるエントリの上限。 */
export const PLAY_CODE_MAX_ENTRIES = 2000;
/** 受け付ける play code の最大長(文字)。 */
export const PLAY_CODE_MAX_LENGTH = 8000;

/** play code に載せられる action(focus / reaction)。 */
export type PlayAction = Extract<Action, { type: "focus" | "reaction" }>;
export type PlayEntry = { t: number; action: PlayAction };

function pushVarint(out: number[], n: number): void {
  let v = Math.max(0, Math.floor(n));
  while (v >= 0x80) {
    out.push((v % 0x80) | 0x80);
    v = Math.floor(v / 0x80);
  }
  out.push(v);
}

/**
 * timeline を play code にする。focus / reaction 以外の action は捨てる。
 * 時刻は 10ms 単位に丸める。
 */
export function encodePlayCode(entries: readonly TimelineEntry[]): string {
  const playable = entries
    .filter((e): e is PlayEntry =>
      e.action.type === "focus" || e.action.type === "reaction"
    )
    .slice()
    .sort((a, b) => a.t - b.t)
    .slice(0, PLAY_CODE_MAX_ENTRIES);

  const bytes: number[] = [];
  let prevTick = 0;
  for (const { t, action } of playable) {
    const tick = Math.round(Math.max(0, t) / TICK_MS);
    pushVarint(bytes, tick - prevTick);
    prevTick = tick;
    if (action.type === "focus") {
      pushVarint(bytes, TAG_FOCUS);
      pushVarint(bytes, action.page);
      pushVarint(bytes, action.idx);
      continue;
    }
    const i = PLAY_CODE_EMOJIS.indexOf(action.emoji);
    if (i >= 0) {
      pushVarint(bytes, i + 1);
    } else {
      const utf8 = new TextEncoder().encode(action.emoji);
      pushVarint(bytes, TAG_EMOJI_RAW);
      pushVarint(bytes, utf8.length);
      bytes.push(...utf8);
    }
  }
  return VERSION +
    new Uint8Array(bytes).toBase64({
      alphabet: "base64url",
      omitPadding: true,
    });
}

/**
 * play code を timeline に戻す。形式が壊れていたら null(呼び出し側は
 * 自動再生しないだけでよい)。
 */
export function decodePlayCode(code: string): PlayEntry[] | null {
  if (!code.startsWith(VERSION) || code.length > PLAY_CODE_MAX_LENGTH) {
    return null;
  }
  let bytes: Uint8Array;
  try {
    bytes = Uint8Array.fromBase64(code.slice(VERSION.length), {
      alphabet: "base64url",
      lastChunkHandling: "loose",
    });
  } catch {
    return null;
  }

  let pos = 0;
  const varint = (): number => {
    let n = 0;
    let mul = 1;
    for (let i = 0; i < 5; i++) {
      if (pos >= bytes.length) throw new RangeError("truncated");
      const b = bytes[pos++];
      n += (b & 0x7f) * mul;
      if (b < 0x80) return n;
      mul *= 0x80;
    }
    throw new RangeError("varint too long");
  };

  const entries: PlayEntry[] = [];
  let tick = 0;
  try {
    while (pos < bytes.length) {
      if (entries.length >= PLAY_CODE_MAX_ENTRIES) return null;
      tick += varint();
      const t = tick * TICK_MS;
      const tag = varint();
      if (tag === TAG_FOCUS) {
        const page = varint();
        const idx = varint();
        if (page < 1) return null;
        entries.push({ t, action: { type: "focus", page, idx } });
      } else if (tag === TAG_EMOJI_RAW) {
        const len = varint();
        if (len < 1 || len > 16 || pos + len > bytes.length) return null;
        const emoji = new TextDecoder().decode(bytes.subarray(pos, pos + len));
        pos += len;
        entries.push({ t, action: { type: "reaction", emoji } });
      } else if (tag >= 1 && tag <= PLAY_CODE_EMOJIS.length) {
        entries.push({
          t,
          action: { type: "reaction", emoji: PLAY_CODE_EMOJIS[tag - 1] },
        });
      } else {
        return null;
      }
    }
  } catch {
    return null;
  }
  return entries.length ? entries : null;
}
