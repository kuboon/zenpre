/**
 * `BlacklistModerator` — level-0 post を自動審査する簡易モデレータ。
 *
 * ブラックリスト語を含まない post を自動で level 1 に昇格して配信するための
 * `ModeratedPostAction` を生成する。ModeratorUi(人手)と併用でき、
 * 依存を減らすため post_id の採番は呼び出し側から `genId` で注入する。
 *
 * @example
 * ```ts
 * import { genPublicId } from "@kuboon/zenpre/keys.ts";
 * const mod = new BlacklistModerator(["spam", "宣伝"]);
 * const action = mod.moderate("こんにちは", genPublicId);
 * if (action) relay.send(action); // level 1 で全員へ
 * ```
 *
 * @module
 */

/** 審査を通った post を再配信するための action(ModeratedPostAction 互換)。 */
export type ModeratedPost = {
  type: "post";
  text: string;
  level: number;
  post_id: string;
};

export class BlacklistModerator {
  #words: string[];

  constructor(words: string[] = []) {
    this.#words = words
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length > 0);
  }

  /** text がブラックリスト語を(部分一致で)含めば true。 */
  isBlocked(text: string): boolean {
    const t = text.toLowerCase();
    return this.#words.some((w) => t.includes(w));
  }

  /**
   * level-0 post を審査する。ブロックなら `null`、承認なら level 1 の
   * post action(post_id は `genId` で採番)を返す。
   */
  moderate(text: string, genId: () => string): ModeratedPost | null {
    const trimmed = text.trim();
    if (trimmed.length === 0 || this.isBlocked(trimmed)) return null;
    return { type: "post", text: trimmed, level: 1, post_id: genId() };
  }
}
