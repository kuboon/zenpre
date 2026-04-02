export type KvKeyPart = string | number | bigint | boolean;
export type KvKey = KvKeyPart[];

export type KvOptions = {
  expireIn?: number;
};

export type KvUpdateResult = {
  ok: boolean;
};

interface KvEntryInterface<TVal, TKey = KvKey> {
  key: TKey;
  get(): Promise<TVal | null>;
  set(value: TVal, options?: KvOptions): Promise<void>;
  update(
    updater: (current: TVal | null) => TVal | null,
  ): Promise<KvUpdateResult>;
  delete(): Promise<void>;
}

interface KvListEntryInterface<
  TVal,
  TKey,
  TEntry extends KvEntryInterface<TVal, TKey> = KvEntryInterface<TVal, TKey>,
> extends AsyncIterable<TEntry> {
  create(value: TVal, options?: KvOptions): Promise<TKey | null>;
  get(key: TKey): TEntry;
}

export interface KvRepo<TVal, TKey = KvKey> {
  prefix: TKey;
  list(options?: KvOptions): KvListEntryInterface<TVal, TKey>;
  entry<TEntryVal = TVal>(
    key: TKey,
    options?: KvOptions,
  ): KvEntryInterface<TEntryVal, TKey>;
}
