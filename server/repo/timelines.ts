/**
 * Timeline の永続化層。Recorder が chunk 追記し、Player が全 chunk を結合して
 * 再生する。
 *
 * KV レイアウト:
 * - `["timelines", talk_id, chunk_id]` → {@link TimelineEntry}[]
 *
 * reaction を含むと 1 chunk が KV の値制限(64KiB)を超え得るため、追記単位で
 * chunk を分ける(Recorder は 30 秒ごと & 終了時に flush する)。
 */
import type { KvRepo } from "@kuboon/kv";
import type { TimelineEntry } from "@kuboon/zenpre/schemas.ts";
import { genPublicId } from "@kuboon/zenpre/keys.ts";
import type { RepoFactory } from "./slides.ts";

export class Timelines {
  #make: RepoFactory;
  // talk ごとに同一 repo インスタンスを使う(memory バックエンドは
  // インスタンスごとにストアが独立するため、append と all で共有する必要がある)。
  #repos = new Map<string, KvRepo<TimelineEntry[]>>();

  constructor(make: RepoFactory) {
    this.#make = make;
  }

  #repo(talkId: string): KvRepo<TimelineEntry[]> {
    let repo = this.#repos.get(talkId);
    if (!repo) {
      repo = this.#make<TimelineEntry[]>(["timelines", talkId]);
      this.#repos.set(talkId, repo);
    }
    return repo;
  }

  /** chunk を 1 つ追記する。 */
  async append(talkId: string, entries: TimelineEntry[]): Promise<void> {
    if (entries.length === 0) return;
    const repo = this.#repo(talkId);
    await repo.entry(genPublicId()).update(() => entries);
  }

  /** 全 chunk を結合し、t 昇順にソートして返す。 */
  async all(talkId: string): Promise<TimelineEntry[]> {
    const repo = this.#repo(talkId);
    const merged: TimelineEntry[] = [];
    for await (const e of repo) {
      const chunk = await e.get();
      if (chunk) merged.push(...chunk);
    }
    merged.sort((a, b) => a.t - b.t);
    return merged;
  }
}
