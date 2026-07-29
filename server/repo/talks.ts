/**
 * Talk(プレゼン開催枠)の永続化層。`@kuboon/kv` の {@link KvRepo} 抽象に
 * 対して書き、バックエンドは {@link RepoFactory} で注入する。
 *
 * KV レイアウト:
 * - `["talks", talk_id]`       → {@link Talk}
 * - `["talk_keys", talk_id]`   → `{ presenter_hash, moderator_hash }`
 * - `["last_focus", talk_id]`  → 直近の focus {@link Action}(expireIn 24h)
 */
import type { KvKeyPart, KvRepo } from "@kuboon/kv";
import type { Action, Talk } from "@kuboon/zenpre/schemas.ts";
import {
  genPublicId,
  genSecretKey,
  hashKey,
  verifyKey,
} from "@kuboon/zenpre/keys.ts";
import type { RepoFactory } from "./slides.ts";

type TalkKeyHashes = { presenter_hash: string; moderator_hash: string };

/** relay が接続時に確定するロール(key 無しは audience)。 */
export type KeyedRole = "presenter" | "moderator";

const LAST_FOCUS_TTL_MS = 24 * 60 * 60 * 1000;

/** Talk の作成・取得と、capability key の照合・直近 focus の保存。 */
export class Talks {
  #talks: KvRepo<Talk>;
  #keys: KvRepo<TalkKeyHashes>;
  #lastFocus: KvRepo<Action>;

  constructor(make: RepoFactory) {
    this.#talks = make<Talk>(["talks"]);
    this.#keys = make<TalkKeyHashes>(["talk_keys"]);
    this.#lastFocus = make<Action>(["last_focus"]);
  }

  /**
   * Talk を新規作成する。`event_key`(presenter)/`moderator_key` は戻り値で
   * のみ返し、KV にはハッシュだけを保存する。
   */
  async create(input: {
    slide_id?: string | null;
    begin_at?: string;
    end_at?: string | null;
  }): Promise<{ talk: Talk; event_key: string; moderator_key: string }> {
    const talk_id = genPublicId();
    const event_key = genSecretKey();
    const moderator_key = genSecretKey();
    const now = new Date().toISOString();
    const talk: Talk = {
      talk_id,
      slide_id: input.slide_id ?? null,
      begin_at: input.begin_at ?? now,
      end_at: input.end_at ?? null,
      created_at: now,
    };
    const [presenter_hash, moderator_hash] = await Promise.all([
      hashKey(event_key),
      hashKey(moderator_key),
    ]);
    await this.#talks.entry(talk_id).update(() => talk);
    await this.#keys.entry(talk_id).update(() => ({
      presenter_hash,
      moderator_hash,
    }));
    return { talk, event_key, moderator_key };
  }

  /** Talk を取得する(存在しなければ null)。 */
  get(talk_id: string): Promise<Talk | null> {
    return this.#talks.entry(talk_id).get();
  }

  /**
   * key がこの Talk の presenter / moderator のどちらかに一致すればその
   * ロールを、しなければ null を返す。
   */
  async roleOf(talk_id: string, key: string): Promise<KeyedRole | null> {
    const stored = await this.#keys.entry(talk_id).get();
    if (!stored) return null;
    if (await verifyKey(key, stored.presenter_hash)) return "presenter";
    if (await verifyKey(key, stored.moderator_hash)) return "moderator";
    return null;
  }

  /** 直近の focus を保存する(新規接続者の welcome に返すため)。 */
  async saveLastFocus(talk_id: string, action: Action): Promise<void> {
    await this.#lastFocus.entry(talk_id).update(() => action, {
      expireIn: LAST_FOCUS_TTL_MS,
    });
  }

  /** 直近の focus を取得する(無ければ null)。 */
  getLastFocus(talk_id: string): Promise<Action | null> {
    return this.#lastFocus.entry(talk_id).get();
  }
}

/** `KvKeyPart` を re-export(呼び出し側の型注釈用)。 */
export type { KvKeyPart };
