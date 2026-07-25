/**
 * A typed `Array.prototype.includes` that also NARROWS. Given a readonly array of a literal
 * subtype `T` and a `value` of the wider type `V` those literals belong to, it answers whether
 * `value` is one of the array's members and, on `true`, narrows it to `T`.
 *
 * Reach for it to test a wide value (a `string`, a broad union) against a small `as const` set
 * WITHOUT casting the set to `readonly string[]` or the value to a literal — the friction where
 * a const array's own `.includes` accepts only its own literal members. The array widens to
 * `ReadonlyArray<V>` for free (covariance, since `T extends V`), so `.includes` accepts the
 * wide value with no cast; the `value is T` predicate narrows the caller's value on a match.
 *
 * @example
 * const METHODS = ["GET", "POST"] as const;
 * if (arrayIncludes(METHODS, request.method)) {
 *   request.method; // narrowed to "GET" | "POST"
 * }
 */
export const arrayIncludes = <T extends V, V>(
  haystack: ReadonlyArray<T>,
  value: V,
): value is T => (haystack as ReadonlyArray<V>).includes(value);
