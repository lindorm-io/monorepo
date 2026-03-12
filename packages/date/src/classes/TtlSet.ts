import { Expiry, ReadableTime } from "../types";
import { expiresAt } from "../utils/expires-at";

export class TtlSet<T> {
  private readonly defaultTtl: ReadableTime;
  private readonly store = new Map<T, number>();

  public constructor(defaultTtl: ReadableTime) {
    this.defaultTtl = defaultTtl;
  }

  public get size(): number {
    this.cleanup();
    return this.store.size;
  }

  public get [Symbol.toStringTag](): string {
    return "TtlSet";
  }

  public add = (value: T, ttl?: Expiry): this => {
    this.store.set(value, expiresAt(ttl ?? this.defaultTtl).getTime());
    return this;
  };

  public has = (value: T): boolean => {
    const exp = this.store.get(value);
    if (exp === undefined) return false;

    if (Date.now() >= exp) {
      this.store.delete(value);
      return false;
    }

    return true;
  };

  public delete = (value: T): boolean => {
    return this.store.delete(value);
  };

  public clear = (): void => {
    this.store.clear();
  };

  public cleanup = (): void => {
    const now = Date.now();
    for (const [value, exp] of this.store) {
      if (now >= exp) {
        this.store.delete(value);
      }
    }
  };

  public forEach = (
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

  public *keys(): IterableIterator<T> {
    const now = Date.now();
    for (const [value, exp] of this.store) {
      if (now >= exp) {
        this.store.delete(value);
        continue;
      }
      yield value;
    }
  }

  public *values(): IterableIterator<T> {
    return yield* this.keys();
  }

  public *entries(): IterableIterator<[T, T]> {
    const now = Date.now();
    for (const [value, exp] of this.store) {
      if (now >= exp) {
        this.store.delete(value);
        continue;
      }
      yield [value, value];
    }
  }

  public [Symbol.iterator](): IterableIterator<T> {
    return this.keys();
  }
}
