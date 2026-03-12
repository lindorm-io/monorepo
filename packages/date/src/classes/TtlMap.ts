import { Expiry, ReadableTime } from "../types";
import { expiresAt } from "../utils/expires-at";

type TtlEntry<V> = { value: V; expiresAt: number };

export class TtlMap<K, V> {
  private readonly defaultTtl: ReadableTime;
  private readonly store = new Map<K, TtlEntry<V>>();

  public constructor(defaultTtl: ReadableTime) {
    this.defaultTtl = defaultTtl;
  }

  public get size(): number {
    this.cleanup();
    return this.store.size;
  }

  public get [Symbol.toStringTag](): string {
    return "TtlMap";
  }

  public set = (key: K, value: V, ttl?: Expiry): this => {
    this.store.set(key, {
      value,
      expiresAt: expiresAt(ttl ?? this.defaultTtl).getTime(),
    });
    return this;
  };

  public get = (key: K): V | undefined => {
    const entry = this.store.get(key);
    if (!entry) return undefined;

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return undefined;
    }

    return entry.value;
  };

  public has = (key: K): boolean => {
    const entry = this.store.get(key);
    if (!entry) return false;

    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return false;
    }

    return true;
  };

  public delete = (key: K): boolean => {
    return this.store.delete(key);
  };

  public clear = (): void => {
    this.store.clear();
  };

  public cleanup = (): void => {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
      }
    }
  };

  public forEach = (
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

  public *keys(): IterableIterator<K> {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
        continue;
      }
      yield key;
    }
  }

  public *values(): IterableIterator<V> {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
        continue;
      }
      yield entry.value;
    }
  }

  public *entries(): IterableIterator<[K, V]> {
    const now = Date.now();
    for (const [key, entry] of this.store) {
      if (now >= entry.expiresAt) {
        this.store.delete(key);
        continue;
      }
      yield [key, entry.value];
    }
  }

  public [Symbol.iterator](): IterableIterator<[K, V]> {
    return this.entries();
  }
}
