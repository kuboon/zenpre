import type {
  KvKey,
  KvKeyPart,
  KvOptions,
  KvRepo,
  KvUpdateResult,
} from "./types.ts";
import { monotonicUlid } from "@std/ulid";

type CloudflareKvListResult = {
  keys: Array<{ name: string }>;
  list_complete: boolean;
  cursor?: string;
};

export type CloudflareKvNamespace = {
  get(key: string, type: "json"): Promise<unknown | null>;
  put(
    key: string,
    value: string,
    options?: { expirationTtl?: number },
  ): Promise<void>;
  delete(key: string): Promise<void>;
  list(
    options: { prefix: string; cursor?: string },
  ): Promise<CloudflareKvListResult>;
};

const expireIn = 40 * 60 * 1000; // 40分
const memoryCache = new Map<string, { data: unknown; expireAt: number }>();
const locks = new Map<string, Promise<void>>();

function serializePart(part: unknown): string {
  if (typeof part === "string") return `s:${encodeURIComponent(part)}`;
  if (typeof part === "number") return `n:${part}`;
  if (typeof part === "bigint") return `i:${part}`;
  if (typeof part === "boolean") return `b:${part ? "1" : "0"}`;
  throw new Error(`Unsupported key part type: ${typeof part}`);
}

function deserializePart(encoded: string): KvKeyPart {
  if (encoded.startsWith("s:")) return decodeURIComponent(encoded.slice(2));
  if (encoded.startsWith("n:")) return Number(encoded.slice(2));
  if (encoded.startsWith("i:")) return BigInt(encoded.slice(2));
  if (encoded.startsWith("b:")) return encoded.slice(2) === "1";
  throw new Error(`Unsupported key part encoding: ${encoded}`);
}

function keyToString(key: KvKey): string {
  return key.map(serializePart).join("/");
}

function stringToKey(serialized: string): KvKey {
  if (serialized.length === 0) return [];
  return serialized.split("/").map(deserializePart);
}

async function withKeyLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = locks.get(key) ?? Promise.resolve();
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  const queued = previous.then(() => current);
  locks.set(key, queued);
  await previous;
  try {
    return await fn();
  } finally {
    release();
    if (locks.get(key) === queued) {
      locks.delete(key);
    }
  }
}

export class CloudflareKvRepo<T> implements KvRepo<T> {
  constructor(
    private namespace: CloudflareKvNamespace,
    public prefix: KvKey = [],
  ) {}

  entry<TEntryVal = T>(key_: KvKey, options?: KvOptions) {
    const key = [...this.prefix, ...key_];
    const namespace = this.namespace;
    const strKey = keyToString(key);
    return {
      key,
      async get(): Promise<TEntryVal | null> {
        const cached = memoryCache.get(strKey);
        if (cached) {
          if (Date.now() < cached.expireAt) {
            return cached.data as TEntryVal;
          }
          memoryCache.delete(strKey);
        }
        const value = await namespace.get(strKey, "json") as TEntryVal | null;
        if (value !== null) {
          memoryCache.set(strKey, {
            data: value,
            expireAt: Date.now() + (options?.expireIn ?? expireIn),
          });
        }
        return value;
      },
      async set(value: TEntryVal, setOptions?: KvOptions): Promise<void> {
        const expireInMs = setOptions?.expireIn ?? options?.expireIn ??
          expireIn;
        memoryCache.set(strKey, {
          data: value,
          expireAt: Date.now() + expireInMs,
        });
        await namespace.put(strKey, JSON.stringify(value), {
          expirationTtl: Math.max(1, Math.ceil(expireInMs / 1000)),
        });
      },
      async update(
        updater: (current: TEntryVal | null) => TEntryVal | null,
      ): Promise<KvUpdateResult> {
        return await withKeyLock(strKey, async () => {
          const cached = memoryCache.get(strKey);
          let current: TEntryVal | null;
          if (cached && Date.now() < cached.expireAt) {
            current = cached.data as TEntryVal;
          } else {
            memoryCache.delete(strKey);
            current = await namespace.get(strKey, "json") as TEntryVal | null;
          }
          const updated = updater(current);
          if (updated === null) {
            memoryCache.delete(strKey);
            await namespace.delete(strKey);
            return { ok: true };
          }
          const expireInMs = options?.expireIn ?? expireIn;
          memoryCache.set(strKey, {
            data: updated,
            expireAt: Date.now() + expireInMs,
          });
          await namespace.put(strKey, JSON.stringify(updated), {
            expirationTtl: Math.max(1, Math.ceil(expireInMs / 1000)),
          });
          return { ok: true };
        });
      },
      async delete(): Promise<void> {
        memoryCache.delete(strKey);
        await namespace.delete(strKey);
      },
    };
  }

  list(options?: KvOptions) {
    const entryFn = (key: KvKey, entryOptions?: KvOptions) =>
      this.entry<T>(key, entryOptions);
    const namespace = this.namespace;
    const prefix = this.prefix;
    const prefixString = `${keyToString(prefix)}/`;
    return {
      async *[Symbol.asyncIterator](): AsyncIterableIterator<
        ReturnType<typeof entryFn>
      > {
        let cursor: string | undefined;
        do {
          const result = await namespace.list({ prefix: prefixString, cursor });
          for (const item of result.keys) {
            const fullKey = stringToKey(item.name);
            const key = fullKey.slice(prefix.length);
            yield entryFn(key, options);
          }
          cursor = result.list_complete ? undefined : result.cursor;
        } while (cursor);
      },
      async create(value: T, options?: KvOptions): Promise<KvKey | null> {
        let done = false;
        let ulid: string | null = null;
        while (!done) {
          ulid = monotonicUlid();
          const newKey = [...prefix, ulid];
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
export const test = { stringToKey, keyToString };
