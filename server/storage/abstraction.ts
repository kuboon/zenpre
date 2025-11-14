/**
 * Storage abstraction interface for data persistence
 * Enables future migration from Deno KV to other storage solutions
 */

export interface StorageAbstraction<T> {
  /**
   * Store data with optional expiration
   */
  set(key: string[], value: T, expiresIn?: number): Promise<void>;

  /**
   * Retrieve data by key
   */
  get(key: string[]): Promise<T | null>;

  /**
   * Delete data by key
   */
  delete(key: string[]): Promise<void>;

  /**
   * Check if key exists
   */
  has(key: string[]): Promise<boolean>;
}
