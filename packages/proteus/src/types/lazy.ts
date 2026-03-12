/**
 * Represent a value that may be lazily loaded.
 *
 * When a relation is decorated with `@Lazy()`, its property type is `LazyType<T>` —
 * either the resolved value `T` or a `PromiseLike<T>` that resolves on first access.
 */
export type LazyType<T> = T | PromiseLike<T>;
