import type { Expiry, ReadableTime } from "../types/index.js";
import { expiresAt } from "../utils/expires-at.js";

type TtlEntry<V> = { value: V; expiresAt: number };

export class TtlMap<K, V> {
  private readonly defaultTtl: ReadableTime;
  private readonly store = new Map<K, TtlEntry<V>>();

  constructor(defaultTtl: ReadableTime) {
    this.defaultTtl = defaultTtl;
  }

  get size(): number {
    this.cleanup();
    return this.store.size;
  }

  get [Symbol.toStringTag](): string {
    return "TtlMap";
  }

  set = (key: K, value: V, ttl?: Expiry): this => {
    this.store.set(key, {
      value,
      expiresAt: expiresAt(ttl ?? this.defaultTtl).getTime(),
    });
    return this;
  };

  get = (key: K): V | undefined => {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  };

  has = (key: K): boolean => {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  };

  delete = (key: K): boolean => {
    return this.store.delete(key);
  };

  clear = (): void => {
    this.store.clear();
  };

  cleanup = (): void => {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
      }
    }
  };

  forEach = (
    callbackfn: (value: V, key: K, map: TtlMap<K, V>) => void,
    thisArg?: unknown,
  ): void => {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
        continue;
      }
      callbackfn.call(thisArg, entry.value, key, this);
    }
  };

  *keys(): IterableIterator<K> {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
        continue;
      }
      yield key;
    }
  }

  *values(): IterableIterator<V> {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
        continue;
      }
      yield entry.value;
    }
  }

  *entries(): IterableIterator<[K, V]> {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
        continue;
      }
      yield [key, entry.value];
    }
  }

  [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }
}
