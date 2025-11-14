/**
 * Deno KV implementation of the storage abstraction
 */

import type { StorageAbstraction } from "./abstraction.ts";

export class KVStorage<T> implements StorageAbstraction<T> {
  private kv: Deno.Kv;

  private constructor(kv: Deno.Kv) {
    this.kv = kv;
  }

  static async create<T>(): Promise<KVStorage<T>> {
    const kv = await Deno.openKv();
    return new KVStorage<T>(kv);
  }

  async set(key: string[], value: T, expiresIn?: number): Promise<void> {
    const options = expiresIn ? { expireIn: expiresIn } : undefined;
    await this.kv.set(key, value, options);
  }

  async get(key: string[]): Promise<T | null> {
    const result = await this.kv.get<T>(key);
    return result.value;
  }

  async delete(key: string[]): Promise<void> {
    await this.kv.delete(key);
  }

  async has(key: string[]): Promise<boolean> {
    const result = await this.kv.get(key);
    return result.value !== null;
  }

  /**
   * Close the KV connection
   */
  close(): void {
    this.kv.close();
  }
}
