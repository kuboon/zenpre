/** テスト用のオンメモリ KV バックエンド。 */
import { MemoryKvRepo } from "@kuboon/kv/memory.ts";
import type { KvKeyPart } from "@kuboon/kv";
import type { RepoFactory } from "./slides.ts";

export const memoryFactory: RepoFactory = <T>(prefix: KvKeyPart[]) =>
  new MemoryKvRepo<T>(prefix);
