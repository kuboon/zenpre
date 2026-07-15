/**
 * 本番用の Deno KV バックエンド。
 *
 * `@kuboon/kv/denoKv.ts` はモジュール読み込み時に `Deno.openKv()` を呼ぶ
 * 副作用を持つため、このモジュールはサーバ起動パス(main.ts)からのみ import
 * する。テストは `./memory.ts` を注入して KV を開かない。
 */
import { DenoKvRepo } from "@kuboon/kv/denoKv.ts";
import type { KvKeyPart } from "@kuboon/kv";
import type { RepoFactory } from "./slides.ts";

export const denoKvFactory: RepoFactory = <T>(prefix: KvKeyPart[]) =>
  new DenoKvRepo<T>(prefix);
