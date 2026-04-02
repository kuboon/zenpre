// deno-lint-ignore-file require-await
import type { KvKey, KvOptions, KvRepo, KvUpdateResult } from "./types.ts";
import { monotonicUlid } from "@std/ulid";

type Entry<T> = { value: T; expireAt: number | null };

function keyToString(key: KvKey): string {
  return JSON.stringify(key);
}

export class MemoryKvRepo<T> implements KvRepo<T> {
  private store = new Map<string, Entry<T>>();

  constructor(public prefix: KvKey = []) {}

  private fullKey(key: KvKey): KvKey {
    return [...this.prefix, ...key];
  }

  private isExpired(entry: Entry<T>): boolean {
    return entry.expireAt !== null && Date.now() >= entry.expireAt;
  }

  entry<TEntryVal = T>(key_: KvKey, options?: KvOptions) {
    const key = this.fullKey(key_);
    const strKey = keyToString(key);
    const store = this.store;
    const isExpired = this.isExpired.bind(this);

    return {
      key,
      async get(): Promise<TEntryVal | null> {
        const entry = store.get(strKey);
        if (!entry || isExpired(entry)) {
          store.delete(strKey);
          return null;
        }
        return entry.value as unknown as TEntryVal;
      },
      async set(value: TEntryVal, setOptions?: KvOptions): Promise<void> {
        const expireIn = setOptions?.expireIn ?? options?.expireIn;
        store.set(strKey, {
          value: value as unknown as T,
          expireAt: expireIn != null ? Date.now() + expireIn : null,
        });
      },
      async update(
        updater: (current: TEntryVal | null) => TEntryVal | null,
      ): Promise<KvUpdateResult> {
        const entry = store.get(strKey);
        const current = entry && !isExpired(entry)
          ? entry.value as unknown as TEntryVal
          : null;
        const updated = updater(current);
        if (updated === null) {
          store.delete(strKey);
        } else {
          const expireIn = options?.expireIn;
          store.set(strKey, {
            value: updated as unknown as T,
            expireAt: expireIn != null ? Date.now() + expireIn : null,
          });
        }
        return { ok: true };
      },
      async delete(): Promise<void> {
        store.delete(strKey);
      },
    };
  }

  list(options?: KvOptions) {
    const entryFn = (key: KvKey, entryOptions?: KvOptions) =>
      this.entry<T>(key, entryOptions);
    const prefix = this.prefix;
    const prefixStr = keyToString(prefix);
    const store = this.store;
    const isExpired = this.isExpired.bind(this);

    return {
      async *[Symbol.asyncIterator](): AsyncIterableIterator<
        ReturnType<typeof entryFn>
      > {
        for (const [strKey, entry] of store) {
          if (isExpired(entry)) {
            store.delete(strKey);
            continue;
          }
          const fullKey = JSON.parse(strKey) as KvKey;
          if (
            fullKey.length > prefix.length &&
            keyToString(fullKey.slice(0, prefix.length)) === prefixStr
          ) {
            const key = fullKey.slice(prefix.length);
            yield entryFn(key, options);
          }
        }
      },
      async create(value: T, createOptions?: KvOptions): Promise<KvKey | null> {
        const ulid = monotonicUlid();
        const key = [...prefix, ulid];
        const strKey = keyToString(key);
        const expireIn = createOptions?.expireIn ?? options?.expireIn;
        store.set(strKey, {
          value,
          expireAt: expireIn != null ? Date.now() + expireIn : null,
        });
        return [ulid];
      },
      get(key: KvKey) {
        return entryFn(key, options);
      },
    };
  }
}
