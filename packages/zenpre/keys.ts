/**
 * 公開 ID と capability key の生成・検証。
 *
 * - 公開 ID(slide_id / talk_id / post_id): base58 8 文字。URL に載る。
 * - secret key(slide_key / talk_key / moderator_key): base58 26 文字(≈152bit)。
 *   発行時に一度だけ返し、サーバは SHA-256 ハッシュのみ保存する。
 *
 * WebCrypto のみ使用(ブラウザ / Deno / edge で同一動作)。
 *
 * @module
 */

/** base58(Bitcoin alphabet)。0/O/I/l を含まない。 */
const ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

export const PUBLIC_ID_LENGTH = 8;
export const SECRET_KEY_LENGTH = 26;

/** 剰余バイアスを避けつつ base58 のランダム文字列を生成する。 */
function randomBase58(length: number): string {
  // 256 % 58 = 24 なので、232 以上のバイトを棄却すれば一様になる。
  const limit = 256 - (256 % ALPHABET.length); // 232
  const out: string[] = [];
  const buf = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (const byte of buf) {
      if (byte >= limit) continue;
      out.push(ALPHABET[byte % ALPHABET.length]);
      if (out.length === length) break;
    }
  }
  return out.join("");
}

/** 公開 ID(slide_id / talk_id / post_id)を生成する。 */
export function genPublicId(): string {
  return randomBase58(PUBLIC_ID_LENGTH);
}

/** secret key(slide_key / talk_key / moderator_key)を生成する。 */
export function genSecretKey(): string {
  return randomBase58(SECRET_KEY_LENGTH);
}

/** key の SHA-256 を hex で返す。KV にはこれだけを保存する。 */
export async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(key),
  );
  return Array.from(
    new Uint8Array(digest),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
}

/**
 * 提示された key が保存済みハッシュと一致するか検証する。
 * 比較は全桁を走査する定数時間風の実装(早期 return しない)。
 */
export async function verifyKey(
  key: string,
  storedHash: string,
): Promise<boolean> {
  const actual = await hashKey(key);
  if (actual.length !== storedHash.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i++) {
    diff |= actual.charCodeAt(i) ^ storedHash.charCodeAt(i);
  }
  return diff === 0;
}
