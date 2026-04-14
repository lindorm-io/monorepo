import { isObjectLike } from "@lindorm/is";
import type { IEntity } from "../../../interfaces";

/**
 * Brand symbol for lazy collection proxies.
 */
export const LAZY_COLLECTION = Symbol.for("proteus.lazy-collection");

/**
 * A thenable that lazily loads a collection of values.
 *
 * Originally built for relation collections (OneToMany, ManyToMany), but now
 * also used for primitive / embeddable element collections (@EmbeddedList).
 * The `T` parameter is unconstrained — the class body does not use entity
 * semantics, it only resolves to Array<T> via the provided loader.
 *
 * After resolution, replaces itself on the owning entity with the array.
 * Pre-resolution, `toJSON()` returns `undefined`.
 */
export class LazyCollection<T = unknown> {
  public readonly [LAZY_COLLECTION] = true;

  private readonly _owner: IEntity;
  private readonly _key: string;
  private readonly _loader: () => Promise<Array<T>>;
  private _resolved: boolean;
  private _value: Array<T>;
  private _pending: Promise<Array<T>> | null;

  public constructor(owner: IEntity, key: string, loader: () => Promise<Array<T>>) {
    this._owner = owner;
    this._key = key;
    this._loader = loader;
    this._resolved = false;
    this._value = [];
    this._pending = null;
  }

  public then<TResult1 = Array<T>, TResult2 = never>(
    onfulfilled?: ((value: Array<T>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): Promise<TResult1 | TResult2> {
    if (this._resolved) {
      return Promise.resolve(this._value).then(onfulfilled, onrejected);
    }

    if (this._pending) {
      return this._pending.then(onfulfilled, onrejected);
    }

    this._pending = this._loader().then(
      (value) => {
        this._resolved = true;
        this._value = value;
        this._pending = null;
        (this._owner as any)[this._key] = value;
        return value;
      },
      (err) => {
        this._pending = null;
        throw err;
      },
    );

    return this._pending.then(onfulfilled, onrejected);
  }

  public toJSON(): Array<T> | undefined {
    return this._resolved ? this._value : undefined;
  }
}

export const isLazyCollection = (value: unknown): value is LazyCollection<unknown> =>
  isObjectLike(value) && (value as any)[LAZY_COLLECTION] === true;
