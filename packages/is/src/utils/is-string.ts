/**
 * `T` is constrained to `string` because the only evidence behind the predicate
 * is `typeof input === "string"`. Unconstrained, it narrowed to whatever the
 * caller named — `isString<{ nope: true }>(value)` compiled, was true for every
 * string, and handed the rest of the program an object that never existed.
 *
 * The constraint keeps the legitimate use — narrowing to a string LITERAL UNION —
 * but note that membership in that union is still NOT checked here. A guard that
 * must reject values outside the union belongs next to the union itself.
 */
export const isString = <T extends string = string>(input?: any): input is T =>
  typeof input === "string";
