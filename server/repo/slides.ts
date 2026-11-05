/**
 * Slide の永続化層。`@kuboon/kv` の {@link KvRepo} 抽象に対して書き、
 * バックエンド(本番 Deno KV / テスト memory)は {@link RepoFactory} で注入する。
 *
 * KV レイアウト:
 * - `["slides", slide_id]`      → {@link Slide}
 * - `["slide_keys", slide_id]`  → `{ key_hash }`(SHA-256(slide_key))
 */
import type { KvKeyPart, KvRepo } from "@kuboon/kv";
import type { Slide } from "@kuboon/zenpre/schemas.ts";
import {
  genPublicId,
  genSecretKey,
  hashKey,
  verifyKey,
} from "@kuboon/zenpre/keys.ts";

/** prefix から {@link KvRepo} を作るバックエンド注入点。 */
export type RepoFactory = <T>(prefix: KvKeyPart[]) => KvRepo<T>;

type KeyHash = { key_hash: string };

/** Slide の作成・取得・更新。 */
export class Slides {
  #slides: KvRepo<Slide>;
  #keys: KvRepo<KeyHash>;

  constructor(make: RepoFactory) {
    this.#slides = make<Slide>(["slides"]);
    this.#keys = make<KeyHash>(["slide_keys"]);
  }

  /**
   * Slide を新規作成する。`slide_key` は戻り値でのみ返し、KV には
   * ハッシュだけを保存する。
   */
  async create(input: {
    markdown: string;
    css?: string;
    theme?: string;
  }): Promise<{ slide: Slide; slide_key: string }> {
    const slide_id = genPublicId();
    const slide_key = genSecretKey();
    const now = new Date().toISOString();
    const slide: Slide = {
      slide_id,
      title: extractTitle(input.markdown),
      markdown: input.markdown,
      css: input.css ?? "",
      theme: input.theme ?? "light",
      created_at: now,
      updated_at: now,
    };
    const key_hash = await hashKey(slide_key);
    await this.#slides.entry(slide_id).update(() => slide);
    await this.#keys.entry(slide_id).update(() => ({ key_hash }));
    return { slide, slide_key };
  }

  /** Slide を取得する(存在しなければ null)。 */
  get(slide_id: string): Promise<Slide | null> {
    return this.#slides.entry(slide_id).get();
  }

  /**
   * `slide_key` を検証し、一致すれば patch を適用して更新する。
   * 戻り値は更新後の Slide、認証失敗時は `"forbidden"`、不在時は `"not_found"`。
   */
  async update(
    slide_id: string,
    slide_key: string,
    patch: { markdown?: string; css?: string; theme?: string },
  ): Promise<Slide | "forbidden" | "not_found"> {
    const stored = await this.#keys.entry(slide_id).get();
    if (!stored) return "not_found";
    if (!(await verifyKey(slide_key, stored.key_hash))) return "forbidden";
    const current = await this.#slides.entry(slide_id).get();
    if (!current) return "not_found";
    const next: Slide = {
      ...current,
      markdown: patch.markdown ?? current.markdown,
      css: patch.css ?? current.css,
      theme: patch.theme ?? current.theme,
      title: patch.markdown ? extractTitle(patch.markdown) : current.title,
      updated_at: new Date().toISOString(),
    };
    await this.#slides.entry(slide_id).update(() => next);
    return next;
  }
}

/** markdown 先頭の h1 テキストを title として抽出する(無ければ "Untitled")。 */
export function extractTitle(markdown: string): string {
  for (const line of markdown.split("\n")) {
    const m = /^#\s+(.+?)\s*$/.exec(line);
    if (m) return m[1];
  }
  return "Untitled";
}
