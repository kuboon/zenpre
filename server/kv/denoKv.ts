import type { KvKey, KvOptions, KvRepo, KvUpdateResult } from "./types.ts";
import { monotonicUlid } from "@std/ulid";

export const kv = await Deno.openKv();
const expireIn = 40 * 60 * 1000; // 40分
const memoryCache = new Map<KvKey, { data: unknown; expireAt: number }>();

export class DenoKvRepo<T> implements KvRepo<T> {
  constructor(public prefix: KvKey = []) {
  }
  entry<TEntryVal = T>(key_: KvKey, options?: KvOptions) {
    const key = [...this.prefix, ...key_];
    return {
      key,
      async get(): Promise<TEntryVal | null> {
        if (memoryCache.has(key)) {
          const { data, expireAt } = memoryCache.get(key)!;
          if (Date.now() < expireAt) {
            return data as TEntryVal;
          } else {
            memoryCache.delete(key);
          }
        }
        const result = await kv.get<TEntryVal>(key);
        if (result.value !== null) {
          memoryCache.set(key, {
            data: result.value,
            expireAt: Date.now() + (options?.expireIn ?? expireIn),
          });
        }
        return result.value;
      },
      async set(value: TEntryVal, options?: KvOptions): Promise<void> {
        memoryCache.set(key, {
          data: value,
          expireAt: Date.now() + (options?.expireIn ?? expireIn),
        });
        await kv.set(key, value, options || { expireIn });
      },
      async update(
        updater: (current: TEntryVal | null) => TEntryVal | null,
      ): Promise<KvUpdateResult> {
        const current = await kv.get<TEntryVal>(key);
        const updated = updater(current.value);
        const atomic = kv.atomic().check(current);
        if (updated === null) {
          memoryCache.delete(key);
          const result = await atomic.delete(key).commit();
          return { ok: result.ok };
        }
        memoryCache.set(key, {
          data: updated,
          expireAt: Date.now() + (options?.expireIn ?? expireIn),
        });
        const result = await atomic.set(key, updated).commit();
        return { ok: result.ok };
      },
      async delete(): Promise<void> {
        memoryCache.delete(key);
        await kv.delete(key);
      },
    };
  }
  list(options?: KvOptions) {
    const entryFn = (key: KvKey, entryOptions?: KvOptions) =>
      this.entry<T>(key, entryOptions);
    const prefix = this.prefix;
    return {
      async *[Symbol.asyncIterator](): AsyncIterableIterator<
        ReturnType<typeof entryFn>
      > {
        const list = kv.list({ prefix: prefix });
        for await (const entry of list) {
          const fullKey = entry.key as KvKey;
          const key = fullKey.slice(prefix.length);
          yield entryFn(key, options);
        }
      },
      async create(value: T, options?: KvOptions): Promise<KvKey | null> {
        let done = false;
        let ulid: string | null = null;
        while (!done) {
          ulid = monotonicUlid();
          const newKey: KvKey = [...prefix, ulid];
          const entry = entryFn(newKey, options);
          const result = await entry.update((current) => {
            if (current !== null) return current;
            done = true;
            return value;
          });
          if (!result.ok) done = false;
        }
        return ulid ? [ulid] : null;
      },
      get(key: KvKey) {
        return entryFn(key, options);
      },
    };
  }
}
