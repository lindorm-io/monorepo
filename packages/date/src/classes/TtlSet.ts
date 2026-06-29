import type { Expiry, ReadableTime } from "../types/index.js";
import { expiresAt } from "../utils/expires-at.js";

export class TtlSet<T> {
  private readonly defaultTtl: ReadableTime;
  private readonly store = new Map<T, number>();

  constructor(defaultTtl: ReadableTime) {
    this.defaultTtl = defaultTtl;
  }

  get size(): number {
    this.cleanup();
    return this.store.size;
  }

  get [Symbol.toStringTag](): string {
    return "TtlSet";
  }

  add = (value: T, ttl?: Expiry): this => {
    this.store.set(value, expiresAt(ttl ?? this.defaultTtl).getTime());
    return this;
  };

  has = (value: T): boolean => {
    const exp = this.store.get(value);
    if (exp === undefined) return false;

    if (Date.now() >= exp) {
      this.store.delete(value);
      return false;
    }

    return true;
  };

  delete = (value: T): boolean => {
    return this.store.delete(value);
  };

  clear = (): void => {
    this.store.clear();
  };

  cleanup = (): void => {
    const now = Date.now();
    for (const [value, exp] of this.store) {
      if (now >= exp) {
        this.store.delete(value);
      }
    }
  };

  forEach = (
    callbackfn: (value: T, value2: T, set: TtlSet<T>) => void,
    thisArg?: unknown,
  ): void => {
    const now = Date.now();
    for (const [value, exp] of this.store) {
      if (now >= exp) {
        this.store.delete(value);
        continue;
      }
      callbackfn.call(thisArg, value, value, this);
    }
  };

  *keys(): IterableIterator<T> {
    const now = Date.now();
    for (const [value, exp] of this.store) {
      if (now >= exp) {
        this.store.delete(value);
        continue;
      }
      yield value;
    }
  }

  *values(): IterableIterator<T> {
    return yield* this.keys();
  }

  *entries(): IterableIterator<[T, T]> {
    const now = Date.now();
    for (const [value, exp] of this.store) {
      if (now >= exp) {
        this.store.delete(value);
        continue;
      }
      yield [value, value];
    }
  }

  [Symbol.iterator](): IterableIterator<T> {
    return this.keys();
  }
}
