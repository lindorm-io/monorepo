import { isObjectLike } from "@lindorm/is";
import type { IEntity } from "../../../interfaces";

/**
 * Brand symbol — used by the save pipeline to identify unresolved lazy
 * relation proxies without triggering the load.
 */
export const LAZY_RELATION = Symbol.for("proteus.lazy-relation");

/**
 * A thenable that triggers a lazy database load when `await`-ed.
 *
 * Implements the thenable protocol (object with a .then() method) so that
 * `await entity.relation` works transparently:
 *
 *   const author = await post.author;  // triggers DB query on first await
 *   const again  = await post.author;  // returns cached result (no query)
 *
 * After resolution, the thenable replaces itself on the owning entity with
 * the actual resolved value. Subsequent property access returns the plain value.
 */
export class LazyRelation<T extends IEntity> {
  public readonly [LAZY_RELATION] = true;

  private readonly _owner: IEntity;
  private readonly _key: string;
  private readonly _loader: () => Promise<T | null>;
  private _resolved: boolean;
  private _value: T | null;
  private _pending: Promise<T | null> | null;

  public constructor(owner: IEntity, key: string, loader: () => Promise<T | null>) {
    this._owner = owner;
    this._key = key;
    this._loader = loader;
    this._resolved = false;
    this._value = null;
    this._pending = null;
  }

  public then<TResult1 = T | null, TResult2 = never>(
    onfulfilled?: ((value: T | null) => TResult1 | PromiseLike<TResult1>) | null,
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

  public toJSON(): T | null | undefined {
    return this._resolved ? this._value : undefined;
  }
}

export const isLazyRelation = (value: unknown): value is LazyRelation<IEntity> =>
  isObjectLike(value) && (value as any)[LAZY_RELATION] === true;
